import { tool } from "ai";
import { z } from "zod";
import { addAudit } from "@/lib/stores/audits";
import { addActivity } from "@/lib/stores/activity";

const PAGESPEED_API = "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed";

async function fetchPageSpeed(url: string, categories: string[]) {
  const params = new URLSearchParams({ url });
  for (const cat of categories) {
    params.append("category", cat);
  }
  const apiKey = process.env.GOOGLE_API_KEY;
  if (apiKey) params.set("key", apiKey);

  const resp = await fetch(`${PAGESPEED_API}?${params}`);
  if (!resp.ok) throw new Error(`PageSpeed API error: ${resp.status} ${resp.statusText}`);
  try {
    return await resp.json();
  } catch {
    throw new Error(`PageSpeed API returned invalid JSON for ${url}`);
  }
}

function extractScores(data: Record<string, unknown>): { performance: number; seo: number; accessibility: number; bestPractices: number } {
  const cats = (data as { lighthouseResult?: { categories?: Record<string, { score?: number }> } })
    .lighthouseResult?.categories ?? {};
  return {
    performance: Math.round((cats.performance?.score ?? 0) * 100),
    seo: Math.round((cats.seo?.score ?? 0) * 100),
    accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((cats["best-practices"]?.score ?? 0) * 100),
  };
}

function extractIssues(data: Record<string, unknown>): { id: string; title: string; description: string; score: number | null; priority: "high" | "medium" | "low"; category: string }[] {
  const auditsMap = (data as { lighthouseResult?: { audits?: Record<string, { id: string; title: string; description: string; score: number | null }> } })
    .lighthouseResult?.audits ?? {};
  const issues: { id: string; title: string; description: string; score: number | null; priority: "high" | "medium" | "low"; category: string }[] = [];

  for (const [id, audit] of Object.entries(auditsMap)) {
    if (audit.score !== null && audit.score < 0.9) {
      issues.push({
        id,
        title: audit.title,
        description: audit.description?.slice(0, 200) ?? "",
        score: audit.score !== null ? Math.round(audit.score * 100) : null,
        priority: audit.score < 0.5 ? "high" : audit.score < 0.7 ? "medium" : "low",
        category: "general",
      });
    }
  }

  return issues.sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, 20);
}

function extractCoreWebVitals(data: Record<string, unknown>) {
  const metrics = (data as { loadingExperience?: { metrics?: Record<string, { percentile?: number; category?: string }> } })
    .loadingExperience?.metrics;
  if (!metrics) return undefined;

  const ratingMap = (cat: string | undefined): "good" | "needs-improvement" | "poor" => {
    if (cat === "FAST") return "good";
    if (cat === "AVERAGE") return "needs-improvement";
    return "poor";
  };

  return {
    lcp: {
      value: metrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? 0,
      rating: ratingMap(metrics.LARGEST_CONTENTFUL_PAINT_MS?.category),
    },
    inp: {
      value: metrics.INTERACTION_TO_NEXT_PAINT?.percentile ?? 0,
      rating: ratingMap(metrics.INTERACTION_TO_NEXT_PAINT?.category),
    },
    cls: {
      value: (metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile ?? 0) / 100,
      rating: ratingMap(metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.category),
    },
  };
}

export const auditTools = {
  run_lighthouse: tool({
    description: "Run a full Lighthouse audit via PageSpeed Insights API. Returns performance, SEO, accessibility, and best practices scores plus top issues and recommendations.",
    inputSchema: z.object({
      url: z.string().url().describe("The URL to audit"),
      projectId: z.string().optional().describe("Optional project ID to associate this audit with"),
    }),
    execute: async ({ url, projectId }) => {
      const data = await fetchPageSpeed(url, ["performance", "seo", "accessibility", "best-practices"]);
      const scores = extractScores(data);
      const issues = extractIssues(data);
      const coreWebVitals = extractCoreWebVitals(data);

      const audit = await addAudit({
        url,
        source: "pagespeed",
        scores,
        issues,
        coreWebVitals,
        projectId,
      });

      await addActivity("audit_run", `Lighthouse audit for ${url}: Performance ${scores.performance}, SEO ${scores.seo}`, { auditId: audit.id });

      return {
        message: `Audit complete for ${url}`,
        audit,
      };
    },
  }),

  get_pagespeed: tool({
    description: "Get PageSpeed Insights data for any URL, including Core Web Vitals from real users and lab data scores.",
    inputSchema: z.object({
      url: z.string().url().describe("The URL to check"),
    }),
    execute: async ({ url }) => {
      const data = await fetchPageSpeed(url, ["performance", "seo", "accessibility", "best-practices"]);
      const scores = extractScores(data);
      const coreWebVitals = extractCoreWebVitals(data);

      return {
        message: `PageSpeed results for ${url}`,
        scores,
        coreWebVitals,
      };
    },
  }),

  check_core_web_vitals: tool({
    description: "Check Core Web Vitals (LCP, INP, CLS) for a URL using real user data from PageSpeed Insights.",
    inputSchema: z.object({
      url: z.string().url().describe("The URL to check"),
    }),
    execute: async ({ url }) => {
      const data = await fetchPageSpeed(url, ["performance"]);
      const cwv = extractCoreWebVitals(data);

      if (!cwv) {
        return {
          message: `No real user data available for ${url}. The site may not have enough traffic for Chrome UX Report data.`,
          coreWebVitals: null,
        };
      }

      return {
        message: `Core Web Vitals for ${url}`,
        coreWebVitals: cwv,
        thresholds: {
          lcp: { good: "≤2500ms", poor: ">4000ms" },
          inp: { good: "≤200ms", poor: ">500ms" },
          cls: { good: "≤0.1", poor: ">0.25" },
        },
      };
    },
  }),
};
