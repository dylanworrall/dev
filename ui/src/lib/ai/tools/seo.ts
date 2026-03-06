import { tool } from "ai";
import { z } from "zod";
import * as cheerio from "cheerio";
import { addActivity } from "@/lib/stores/activity";

async function fetchHtml(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "DevClient-SEO-Analyzer/1.0",
      "Accept": "text/html",
    },
  });
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  return resp.text();
}

export const seoTools = {
  analyze_seo: tool({
    description: "Full SEO analysis of a page: title, meta description, canonical URL, robots directives, Open Graph tags, Twitter cards, heading structure, and structured data.",
    inputSchema: z.object({
      url: z.string().url().describe("The URL to analyze"),
    }),
    execute: async ({ url }) => {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);

      const title = $("title").text().trim();
      const metaDescription = $('meta[name="description"]').attr("content") ?? "";
      const canonical = $('link[rel="canonical"]').attr("href") ?? "";
      const robots = $('meta[name="robots"]').attr("content") ?? "";

      const ogTags: Record<string, string> = {};
      $('meta[property^="og:"]').each((_, el) => {
        const prop = $(el).attr("property") ?? "";
        ogTags[prop] = $(el).attr("content") ?? "";
      });

      const twitterCards: Record<string, string> = {};
      $('meta[name^="twitter:"]').each((_, el) => {
        const name = $(el).attr("name") ?? "";
        twitterCards[name] = $(el).attr("content") ?? "";
      });

      const headings: { level: number; text: string }[] = [];
      $("h1, h2, h3, h4, h5, h6").each((_, el) => {
        const tag = $(el).prop("tagName")?.toLowerCase() ?? "h1";
        headings.push({
          level: parseInt(tag.charAt(1)),
          text: $(el).text().trim().slice(0, 100),
        });
      });

      const jsonLd: unknown[] = [];
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          jsonLd.push(JSON.parse($(el).html() ?? ""));
        } catch { /* skip invalid */ }
      });

      const issues: string[] = [];
      if (!title) issues.push("Missing title tag");
      else if (title.length > 60) issues.push(`Title too long (${title.length} chars, max 60)`);
      else if (title.length < 30) issues.push(`Title too short (${title.length} chars, min 30)`);
      if (!metaDescription) issues.push("Missing meta description");
      else if (metaDescription.length > 160) issues.push(`Meta description too long (${metaDescription.length} chars, max 160)`);
      if (!canonical) issues.push("Missing canonical URL");
      if (headings.filter((h) => h.level === 1).length === 0) issues.push("Missing H1 tag");
      if (headings.filter((h) => h.level === 1).length > 1) issues.push("Multiple H1 tags found");
      if (Object.keys(ogTags).length === 0) issues.push("Missing Open Graph tags");
      if (jsonLd.length === 0) issues.push("No structured data (JSON-LD) found");

      await addActivity("seo_analysis", `SEO analysis for ${url}: ${issues.length} issues found`);

      return {
        message: `SEO analysis for ${url}`,
        title: { value: title, length: title.length },
        metaDescription: { value: metaDescription, length: metaDescription.length },
        canonical,
        robots,
        openGraph: ogTags,
        twitterCards,
        headings: headings.slice(0, 30),
        structuredData: jsonLd,
        issues,
        issueCount: issues.length,
      };
    },
  }),

  check_meta_tags: tool({
    description: "Check all meta tags on a page and return them organized by type.",
    inputSchema: z.object({
      url: z.string().url().describe("The URL to check"),
    }),
    execute: async ({ url }) => {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);

      const metaTags: { name?: string; property?: string; httpEquiv?: string; content?: string; charset?: string }[] = [];
      $("meta").each((_, el) => {
        metaTags.push({
          name: $(el).attr("name"),
          property: $(el).attr("property"),
          httpEquiv: $(el).attr("http-equiv"),
          content: $(el).attr("content"),
          charset: $(el).attr("charset"),
        });
      });

      return {
        message: `Found ${metaTags.length} meta tags on ${url}`,
        metaTags,
      };
    },
  }),

  check_headings: tool({
    description: "Analyze the heading structure (H1-H6 hierarchy) of a page for proper SEO structure.",
    inputSchema: z.object({
      url: z.string().url().describe("The URL to check"),
    }),
    execute: async ({ url }) => {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);

      const headings: { level: number; text: string }[] = [];
      $("h1, h2, h3, h4, h5, h6").each((_, el) => {
        const tag = $(el).prop("tagName")?.toLowerCase() ?? "h1";
        headings.push({
          level: parseInt(tag.charAt(1)),
          text: $(el).text().trim().slice(0, 100),
        });
      });

      const issues: string[] = [];
      const h1Count = headings.filter((h) => h.level === 1).length;
      if (h1Count === 0) issues.push("No H1 tag found");
      if (h1Count > 1) issues.push(`Multiple H1 tags found (${h1Count})`);

      for (let i = 1; i < headings.length; i++) {
        if (headings[i].level > headings[i - 1].level + 1) {
          issues.push(`Skipped heading level: H${headings[i - 1].level} → H${headings[i].level}`);
        }
      }

      return {
        message: `Found ${headings.length} headings on ${url}`,
        headings,
        h1Count,
        issues,
      };
    },
  }),

  check_schema_markup: tool({
    description: "Detect and validate JSON-LD structured data / schema markup on a page.",
    inputSchema: z.object({
      url: z.string().url().describe("The URL to check"),
    }),
    execute: async ({ url }) => {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);

      const schemas: { type: string; data: unknown }[] = [];
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const data = JSON.parse($(el).html() ?? "");
          const type = data["@type"] ?? "Unknown";
          schemas.push({ type, data });
        } catch { /* skip invalid */ }
      });

      return {
        message: schemas.length > 0
          ? `Found ${schemas.length} schema markup(s) on ${url}`
          : `No JSON-LD structured data found on ${url}`,
        schemas,
        types: schemas.map((s) => s.type),
      };
    },
  }),
};
