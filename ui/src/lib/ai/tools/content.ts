import { tool } from "ai";
import { z } from "zod";
import * as cheerio from "cheerio";

async function fetchHtml(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: { "User-Agent": "DevClient-Content/1.0", Accept: "text/html" },
  });
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  return resp.text();
}

function fleschKincaid(text: string): { score: number; gradeLevel: number; readability: string } {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter(Boolean);
  const syllables = words.reduce((count, word) => {
    return count + countSyllables(word);
  }, 0);

  if (words.length === 0 || sentences.length === 0) {
    return { score: 0, gradeLevel: 0, readability: "N/A" };
  }

  const score = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length);
  const gradeLevel = 0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59;

  let readability = "Very Difficult";
  if (score >= 90) readability = "Very Easy";
  else if (score >= 80) readability = "Easy";
  else if (score >= 70) readability = "Fairly Easy";
  else if (score >= 60) readability = "Standard";
  else if (score >= 50) readability = "Fairly Difficult";
  else if (score >= 30) readability = "Difficult";

  return {
    score: Math.round(score * 10) / 10,
    gradeLevel: Math.round(gradeLevel * 10) / 10,
    readability,
  };
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;
  const vowels = word.match(/[aeiouy]+/g);
  let count = vowels ? vowels.length : 1;
  if (word.endsWith("e")) count--;
  return Math.max(count, 1);
}

export const contentTools = {
  analyze_content_seo: tool({
    description: "Analyze page content for SEO: word count, keyword density, image alt text audit, internal/external link ratio, heading keyword usage.",
    inputSchema: z.object({
      url: z.string().url().describe("The URL to analyze"),
      targetKeyword: z.string().optional().describe("Optional target keyword to check density for"),
    }),
    execute: async ({ url, targetKeyword }) => {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);

      const bodyText = $("body").text().replace(/\s+/g, " ").trim();
      const words = bodyText.split(" ").filter(Boolean);
      const wordCount = words.length;

      const images: { src: string; alt: string; hasAlt: boolean }[] = [];
      $("img").each((_, el) => {
        const src = $(el).attr("src") ?? "";
        const alt = $(el).attr("alt") ?? "";
        images.push({ src: src.slice(0, 100), alt, hasAlt: alt.length > 0 });
      });

      const imagesWithAlt = images.filter((i) => i.hasAlt).length;
      const imagesWithoutAlt = images.filter((i) => !i.hasAlt).length;

      const internalLinks: string[] = [];
      const externalLinks: string[] = [];
      const base = new URL(url);
      $("a[href]").each((_, el) => {
        try {
          const href = $(el).attr("href") ?? "";
          if (href.startsWith("#") || href.startsWith("mailto:")) return;
          const resolved = new URL(href, url);
          if (resolved.hostname === base.hostname) internalLinks.push(resolved.href);
          else externalLinks.push(resolved.href);
        } catch { /* skip */ }
      });

      let keywordAnalysis = null;
      if (targetKeyword) {
        const kw = targetKeyword.toLowerCase();
        const textLower = bodyText.toLowerCase();
        const occurrences = textLower.split(kw).length - 1;
        const density = wordCount > 0 ? (occurrences / wordCount) * 100 : 0;

        const headings = $("h1, h2, h3").map((_, el) => $(el).text().toLowerCase()).get();
        const inHeadings = headings.some((h) => h.includes(kw));
        const inTitle = $("title").text().toLowerCase().includes(kw);
        const inMetaDesc = ($('meta[name="description"]').attr("content") ?? "").toLowerCase().includes(kw);

        keywordAnalysis = {
          keyword: targetKeyword,
          occurrences,
          density: Math.round(density * 100) / 100,
          inTitle,
          inMetaDescription: inMetaDesc,
          inHeadings,
        };
      }

      return {
        message: `Content analysis for ${url}`,
        wordCount,
        images: { total: images.length, withAlt: imagesWithAlt, withoutAlt: imagesWithoutAlt },
        links: {
          internal: internalLinks.length,
          external: externalLinks.length,
          ratio: externalLinks.length > 0
            ? Math.round((internalLinks.length / externalLinks.length) * 100) / 100
            : internalLinks.length,
        },
        keywordAnalysis,
      };
    },
  }),

  suggest_keywords: tool({
    description: "Analyze page content and suggest related keywords and topics for SEO optimization. Uses the page content to identify key themes.",
    inputSchema: z.object({
      url: z.string().url().describe("The URL to analyze for keyword suggestions"),
    }),
    execute: async ({ url }) => {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);

      const title = $("title").text().trim();
      const metaDesc = $('meta[name="description"]').attr("content") ?? "";
      const headings = $("h1, h2, h3").map((_, el) => $(el).text().trim()).get();
      const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 2000);

      // Extract word frequency for 2-3 word phrases
      const words = bodyText.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const freq: Record<string, number> = {};
      for (const word of words) {
        const clean = word.replace(/[^a-z]/g, "");
        if (clean.length > 3) freq[clean] = (freq[clean] ?? 0) + 1;
      }
      const topWords = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([word, count]) => ({ word, count }));

      return {
        message: `Keyword analysis for ${url}`,
        pageContext: { title, metaDescription: metaDesc, headings: headings.slice(0, 10) },
        topWords,
        suggestion: "Use these high-frequency terms as a basis. The AI can suggest related long-tail keywords and semantic variations based on this content analysis.",
      };
    },
  }),

  check_readability: tool({
    description: "Calculate Flesch-Kincaid readability score for a page's content, with suggestions for improvement.",
    inputSchema: z.object({
      url: z.string().url().describe("The URL to check readability for"),
    }),
    execute: async ({ url }) => {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);

      // Remove scripts and styles
      $("script, style, nav, footer, header").remove();
      const bodyText = $("body").text().replace(/\s+/g, " ").trim();

      const words = bodyText.split(/\s+/).filter(Boolean);
      const sentences = bodyText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      const { score, gradeLevel, readability } = fleschKincaid(bodyText);

      const avgSentenceLength = sentences.length > 0
        ? Math.round(words.length / sentences.length)
        : 0;

      const longSentences = sentences.filter((s) => s.trim().split(/\s+/).length > 25).length;

      return {
        message: `Readability analysis for ${url}`,
        fleschKincaid: { score, gradeLevel, readability },
        stats: {
          wordCount: words.length,
          sentenceCount: sentences.length,
          avgSentenceLength,
          longSentences,
        },
        recommendations:
          score < 60
            ? [
                "Shorten sentences (aim for under 20 words)",
                "Use simpler words where possible",
                "Break up long paragraphs",
                "Use bullet points and lists",
              ]
            : ["Content readability is good"],
      };
    },
  }),
};
