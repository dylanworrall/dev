import { tool } from "ai";
import { z } from "zod";
import { getWorkspaceRoot } from "@/lib/workspace";

export const screenshotTools = {
  take_screenshot: tool({
    description: "Take a real browser screenshot of a URL using Playwright. Returns the screenshot as a base64 image plus page analysis. Use this to see what you built and iterate on design.",
    inputSchema: z.object({
      url: z.string().describe("URL to screenshot (e.g., http://localhost:3002)"),
      fullPage: z.boolean().optional().describe("Capture full page scroll (default: false, viewport only)"),
      width: z.number().optional().describe("Viewport width (default: 1280)"),
      height: z.number().optional().describe("Viewport height (default: 720)"),
    }),
    execute: async ({ url, fullPage, width, height }) => {
      try {
        const { chromium } = await import("playwright-core");

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage({
          viewport: { width: width || 1280, height: height || 720 },
        });

        await page.goto(url, { waitUntil: "networkidle", timeout: 15_000 });
        // Wait a bit for any client-side rendering
        await page.waitForTimeout(1500);

        // Take screenshot
        const screenshotBuffer = await page.screenshot({
          fullPage: fullPage || false,
          type: "png",
        });
        const base64 = screenshotBuffer.toString("base64");

        // Also grab page info
        const title = await page.title();
        const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
        const errors = await page.evaluate(() => {
          const errs: string[] = [];
          document.querySelectorAll("[class*=error], [class*=Error], #__next_error__").forEach((el) => {
            errs.push(el.textContent?.slice(0, 200) || "");
          });
          return errs;
        });

        // Save screenshot to workspace for accessibility
        const { writeFileSync, existsSync: ssExists, mkdirSync: ssMkdir } = await import("node:fs");
        const { join } = await import("node:path");
        const ssDir = join(getWorkspaceRoot(), ".screenshots");
        if (!ssExists(ssDir)) ssMkdir(ssDir, { recursive: true });
        const screenshotPath = join(ssDir, `screenshot-${Date.now()}.png`);
        writeFileSync(screenshotPath, screenshotBuffer);

        await browser.close();

        return {
          message: `Screenshot of ${url} (${width || 1280}x${height || 720})`,
          title,
          textPreview: bodyText,
          errors: errors.filter(Boolean),
          screenshotPath,
          screenshotBase64: base64.slice(0, 100) + "...", // Don't send full base64 to LLM
          hasErrors: errors.length > 0,
          suggestion: errors.length > 0
            ? "There are visible errors on the page. Fix them before continuing."
            : "Screenshot captured. Review the page and iterate on the design if needed.",
        };
      } catch (e: unknown) {
        // Fallback to HTML analysis if Playwright fails
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
          if (!res.ok) return { message: `Page returned ${res.status}` };
          const html = await res.text();
          const { load } = await import("cheerio");
          const $ = load(html);
          $("script, style").remove();

          return {
            message: `Playwright unavailable, using HTML analysis for ${url}`,
            title: $("title").text().trim(),
            headings: $("h1, h2, h3").map((_, el) => $(el).text().trim().slice(0, 80)).get(),
            textPreview: $("body").text().replace(/\s+/g, " ").trim().slice(0, 500),
            errors: html.includes("error") ? ["Possible errors detected in HTML"] : [],
            fallback: true,
          };
        } catch (fallbackErr: unknown) {
          return { message: `Screenshot failed: ${(e as Error).message}` };
        }
      }
    },
  }),
};
