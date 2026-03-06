import { tool } from "ai";
import { z } from "zod";
import { addCrawl, type CrawledPage, type BrokenLink, type Redirect } from "@/lib/stores/crawls";
import { addActivity } from "@/lib/stores/activity";
import * as cheerio from "cheerio";

async function fetchWithStatus(url: string, maxRedirects = 5): Promise<{ finalUrl: string; status: number; html: string; redirectChain: string[] }> {
  const redirectChain: string[] = [];
  let currentUrl = url;

  for (let i = 0; i < maxRedirects; i++) {
    const resp = await fetch(currentUrl, {
      redirect: "manual",
      headers: { "User-Agent": "DevClient-Crawler/1.0", Accept: "text/html" },
    });

    if (resp.status >= 300 && resp.status < 400) {
      redirectChain.push(currentUrl);
      const location = resp.headers.get("location");
      if (!location) break;
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }

    const html = resp.status < 400 ? await resp.text() : "";
    return { finalUrl: currentUrl, status: resp.status, html, redirectChain };
  }

  return { finalUrl: currentUrl, status: 302, html: "", redirectChain };
}

function extractLinks(html: string, baseUrl: string): { internal: string[]; external: string[] } {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const internal: string[] = [];
  const external: string[] = [];

  $("a[href]").each((_, el) => {
    try {
      const href = $(el).attr("href") ?? "";
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const resolved = new URL(href, baseUrl);
      if (resolved.hostname === base.hostname) {
        internal.push(resolved.href);
      } else {
        external.push(resolved.href);
      }
    } catch { /* skip invalid URLs */ }
  });

  return { internal: [...new Set(internal)], external: [...new Set(external)] };
}

export const crawlTools = {
  crawl_site: tool({
    description: "Crawl a website starting from the given URL. Discovers pages, records status codes, titles, meta descriptions, word counts, and links. Respects rate limits.",
    inputSchema: z.object({
      url: z.string().url().describe("The root URL to start crawling from"),
      maxPages: z.number().default(20).describe("Maximum number of pages to crawl (default 20)"),
      projectId: z.string().optional().describe("Optional project ID to associate this crawl with"),
    }),
    execute: async ({ url, maxPages, projectId }) => {
      const base = new URL(url);
      const visited = new Set<string>();
      const queue: string[] = [url];
      const pages: CrawledPage[] = [];
      const brokenLinks: BrokenLink[] = [];
      const redirects: Redirect[] = [];

      while (queue.length > 0 && pages.length < maxPages) {
        const currentUrl = queue.shift()!;
        const normalized = new URL(currentUrl).href;
        if (visited.has(normalized)) continue;
        visited.add(normalized);

        try {
          const { finalUrl, status, html, redirectChain } = await fetchWithStatus(currentUrl);

          if (redirectChain.length > 0) {
            redirects.push({
              from: currentUrl,
              to: finalUrl,
              statusCode: 301,
              chain: [...redirectChain, finalUrl],
            });
          }

          if (status >= 400) {
            brokenLinks.push({
              url: currentUrl,
              statusCode: status,
              foundOn: url,
              linkText: "",
            });
            continue;
          }

          const $ = cheerio.load(html);
          const title = $("title").text().trim();
          const metaDescription = $('meta[name="description"]').attr("content") ?? "";
          const bodyText = $("body").text().replace(/\s+/g, " ").trim();
          const wordCount = bodyText.split(" ").filter(Boolean).length;
          const { internal, external } = extractLinks(html, finalUrl);

          pages.push({
            url: finalUrl,
            statusCode: status,
            title,
            metaDescription,
            wordCount,
            internalLinks: internal,
            externalLinks: external,
          });

          for (const link of internal) {
            const linkHost = new URL(link).hostname;
            if (linkHost === base.hostname && !visited.has(link)) {
              queue.push(link);
            }
          }

          // Rate limit: 1 request per second
          await new Promise((r) => setTimeout(r, 1000));
        } catch {
          brokenLinks.push({
            url: currentUrl,
            statusCode: 0,
            foundOn: url,
            linkText: "Connection error",
          });
        }
      }

      const crawl = await addCrawl({
        rootUrl: url,
        pages,
        totalPages: pages.length,
        brokenLinks,
        redirects,
        projectId,
      });

      await addActivity("crawl_run", `Crawled ${url}: ${pages.length} pages, ${brokenLinks.length} broken links`, { crawlId: crawl.id });

      return {
        message: `Crawl complete for ${url}`,
        totalPages: pages.length,
        brokenLinkCount: brokenLinks.length,
        redirectCount: redirects.length,
        crawlId: crawl.id,
        pages: pages.map((p) => ({
          url: p.url,
          status: p.statusCode,
          title: p.title,
          wordCount: p.wordCount,
        })),
        brokenLinks,
        redirects,
      };
    },
  }),

  find_broken_links: tool({
    description: "Find all broken links (404s, timeouts) on a webpage by checking every link on the page.",
    inputSchema: z.object({
      url: z.string().url().describe("The page URL to check for broken links"),
    }),
    execute: async ({ url }) => {
      const { html, status } = await fetchWithStatus(url);
      if (status >= 400) {
        return { message: `The page itself returned status ${status}`, brokenLinks: [] };
      }

      const $ = cheerio.load(html);
      const links: { href: string; text: string }[] = [];
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href") ?? "";
        if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
        try {
          const resolved = new URL(href, url).href;
          links.push({ href: resolved, text: $(el).text().trim().slice(0, 50) });
        } catch { /* skip */ }
      });

      const uniqueLinks = [...new Map(links.map((l) => [l.href, l])).values()];
      const broken: BrokenLink[] = [];

      for (const link of uniqueLinks.slice(0, 50)) {
        try {
          const resp = await fetch(link.href, {
            method: "HEAD",
            headers: { "User-Agent": "DevClient-LinkChecker/1.0" },
            redirect: "follow",
          });
          if (resp.status >= 400) {
            broken.push({
              url: link.href,
              statusCode: resp.status,
              foundOn: url,
              linkText: link.text,
            });
          }
        } catch {
          broken.push({
            url: link.href,
            statusCode: 0,
            foundOn: url,
            linkText: link.text,
          });
        }
        await new Promise((r) => setTimeout(r, 500));
      }

      return {
        message: `Checked ${uniqueLinks.length} links on ${url}, found ${broken.length} broken`,
        totalLinks: uniqueLinks.length,
        brokenLinks: broken,
      };
    },
  }),

  check_redirects: tool({
    description: "Trace redirect chains for a URL, detecting redirect loops and excessive redirects.",
    inputSchema: z.object({
      url: z.string().url().describe("The URL to trace redirects for"),
    }),
    execute: async ({ url }) => {
      const chain: { url: string; status: number }[] = [];
      let currentUrl = url;
      const seen = new Set<string>();

      for (let i = 0; i < 10; i++) {
        if (seen.has(currentUrl)) {
          return {
            message: `Redirect loop detected at ${currentUrl}`,
            chain,
            loop: true,
          };
        }
        seen.add(currentUrl);

        const resp = await fetch(currentUrl, {
          redirect: "manual",
          headers: { "User-Agent": "DevClient-RedirectChecker/1.0" },
        });

        chain.push({ url: currentUrl, status: resp.status });

        if (resp.status >= 300 && resp.status < 400) {
          const location = resp.headers.get("location");
          if (!location) break;
          currentUrl = new URL(location, currentUrl).href;
          continue;
        }
        break;
      }

      return {
        message: chain.length > 1
          ? `${chain.length - 1} redirect(s) for ${url}`
          : `No redirects for ${url}`,
        chain,
        loop: false,
        totalRedirects: chain.length - 1,
      };
    },
  }),

  generate_sitemap: tool({
    description: "Generate an XML sitemap from discovered pages. Crawls the site first if no crawl data exists.",
    inputSchema: z.object({
      url: z.string().url().describe("The root URL to generate a sitemap for"),
      maxPages: z.number().default(50).describe("Maximum pages to include"),
    }),
    execute: async ({ url, maxPages }) => {
      // Quick crawl to discover pages
      const base = new URL(url);
      const visited = new Set<string>();
      const queue: string[] = [url];
      const urls: string[] = [];

      while (queue.length > 0 && urls.length < maxPages) {
        const currentUrl = queue.shift()!;
        const normalized = new URL(currentUrl).href;
        if (visited.has(normalized)) continue;
        visited.add(normalized);

        try {
          const resp = await fetch(currentUrl, {
            headers: { "User-Agent": "DevClient-Sitemap/1.0", Accept: "text/html" },
          });
          if (!resp.ok) continue;

          urls.push(normalized);
          const html = await resp.text();
          const $ = cheerio.load(html);

          $("a[href]").each((_, el) => {
            try {
              const href = $(el).attr("href") ?? "";
              const resolved = new URL(href, currentUrl);
              if (resolved.hostname === base.hostname && !visited.has(resolved.href)) {
                queue.push(resolved.href);
              }
            } catch { /* skip */ }
          });

          await new Promise((r) => setTimeout(r, 500));
        } catch { /* skip */ }
      }

      const today = new Date().toISOString().split("T")[0];
      const urlEntries = urls
        .map((u) => `  <url>\n    <loc>${u}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
        .join("\n");

      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>`;

      await addActivity("sitemap_generated", `Generated sitemap for ${url} with ${urls.length} URLs`);

      return {
        message: `Generated sitemap for ${url} with ${urls.length} URLs`,
        urlCount: urls.length,
        sitemap,
      };
    },
  }),
};
