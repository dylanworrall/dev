import { tool } from "ai";
import { z } from "zod";
import { loadDevEnv } from "@/lib/env";

export const webSearchTools = {
  web_search: tool({
    description: "Search the web for information. Uses Brave Search API if configured, otherwise uses a basic fetch approach.",
    inputSchema: z.object({
      query: z.string().describe("Search query"),
      count: z.number().optional().describe("Number of results (default: 5, max: 20)"),
    }),
    execute: async ({ query, count }) => {
      loadDevEnv();
      const braveKey = process.env.BRAVE_API_KEY;
      const limit = Math.min(count || 5, 20);

      if (braveKey) {
        try {
          const res = await fetch(
            `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`,
            { headers: { "X-Subscription-Token": braveKey, Accept: "application/json" } }
          );
          if (!res.ok) throw new Error(`Brave API error: ${res.status}`);

          const data = await res.json() as {
            web?: { results: Array<{ title: string; url: string; description: string }> };
          };

          const results = (data.web?.results || []).map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.description,
          }));

          return { message: `${results.length} result(s) for "${query}"`, results };
        } catch (e: unknown) {
          return { message: `Search error: ${(e as Error).message}` };
        }
      }

      // Fallback: use Google's custom search or return guidance
      return {
        message: "Web search not configured. Set BRAVE_API_KEY for web search capability.",
        tip: "Get a free Brave Search API key at https://brave.com/search/api/",
      };
    },
  }),

  web_fetch: tool({
    description: "Fetch a web page and extract its text content.",
    inputSchema: z.object({
      url: z.string().describe("URL to fetch"),
      selector: z.string().optional().describe("CSS selector to extract specific content"),
      maxLength: z.number().optional().describe("Max content length (default: 10000 chars)"),
    }),
    execute: async ({ url, selector, maxLength }) => {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "DevClient/1.0 (Web Audit Tool)" },
          signal: AbortSignal.timeout(15_000),
        });

        if (!res.ok) return { message: `Fetch failed: ${res.status} ${res.statusText}` };

        const html = await res.text();
        const { load } = await import("cheerio");
        const $ = load(html);

        // Remove scripts, styles, nav, footer
        $("script, style, nav, footer, header, aside, [role=navigation]").remove();

        let text: string;
        if (selector) {
          text = $(selector).text().trim();
        } else {
          text = $("article, main, [role=main]").text().trim() || $("body").text().trim();
        }

        // Clean up whitespace
        text = text.replace(/\s+/g, " ").trim();
        const limit = maxLength || 10_000;
        if (text.length > limit) {
          text = text.slice(0, limit) + "... (truncated)";
        }

        const title = $("title").text().trim();
        const description = $('meta[name="description"]').attr("content") || "";

        return {
          message: `Fetched: ${title || url}`,
          title,
          description,
          content: text,
          contentLength: text.length,
        };
      } catch (e: unknown) {
        return { message: `Fetch error: ${(e as Error).message}` };
      }
    },
  }),
};
