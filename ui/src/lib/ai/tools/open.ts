import { tool } from "ai";
import { z } from "zod";
import { executeShell } from "@/lib/executor";
import { resolveSafePath } from "@/lib/workspace";

export const openTools = {
  open_browser: tool({
    description: "Open a URL or file in the user's default browser. Use this after building web apps, HTML files, or starting dev servers.",
    inputSchema: z.object({
      target: z.string().describe("URL (http://localhost:3000) or file path to open"),
    }),
    execute: async ({ target }) => {
      try {
        const isUrl = target.startsWith("http://") || target.startsWith("https://");
        const toOpen = isUrl ? target : resolveSafePath(target);

        if (process.platform === "win32") {
          // Use PowerShell Start-Process to avoid cmd.exe quoting issues
          await executeShell(`powershell -Command "Start-Process '${toOpen.replace(/'/g, "''")}'\"`, { timeout: 10_000 });
        } else if (process.platform === "darwin") {
          await executeShell(`open "${toOpen}"`, { timeout: 10_000 });
        } else {
          await executeShell(`xdg-open "${toOpen}"`, { timeout: 10_000 });
        }

        return {
          message: `Opened: ${target}`,
          opened: true,
        };
      } catch (e: unknown) {
        return { message: `Failed to open: ${(e as Error).message}` };
      }
    },
  }),

  serve_file: tool({
    description: "Start a simple HTTP server to serve a directory or file, then open it in the browser. Great for quick HTML/JS demos.",
    inputSchema: z.object({
      path: z.string().optional().describe("Directory to serve (default: workspace root)"),
      port: z.number().optional().describe("Port to serve on (default: 8080)"),
    }),
    execute: async ({ path, port }) => {
      const servePort = port || 8080;
      const serveDir = path ? resolveSafePath(path) : undefined;

      try {
        // Start a simple python or npx http server in background
        const cwd = serveDir || resolveSafePath(".");
        const cmd = process.platform === "win32"
          ? `start /b npx -y serve -l ${servePort} -s "${cwd}" >nul 2>&1`
          : `npx -y serve -l ${servePort} -s "${cwd}" > /dev/null 2>&1 &`;

        await executeShell(cmd, { timeout: 10_000 });

        // Give it a moment to start, then open browser
        await new Promise((r) => setTimeout(r, 2000));

        if (process.platform === "win32") {
          await executeShell(`powershell -Command "Start-Process 'http://localhost:${servePort}'"`, { timeout: 5_000 });
        } else if (process.platform === "darwin") {
          await executeShell(`open "http://localhost:${servePort}"`, { timeout: 5_000 });
        } else {
          await executeShell(`xdg-open "http://localhost:${servePort}"`, { timeout: 5_000 });
        }

        return {
          message: `Serving at http://localhost:${servePort} — opened in browser`,
          url: `http://localhost:${servePort}`,
          port: servePort,
        };
      } catch (e: unknown) {
        return { message: `Failed to serve: ${(e as Error).message}` };
      }
    },
  }),
};
