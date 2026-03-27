"use client";

import type { WebContainer } from "@webcontainer/api";
import type { Terminal as XTerm } from "@xterm/xterm";
import { TEMPLATE_FILES } from "./template/files";
import { writeFiles, runCommand } from "./fs-sync";

export type BootstrapState =
  | "idle"
  | "writing-files"
  | "installing"
  | "starting-server"
  | "ready"
  | "error";

export interface BootstrapCallbacks {
  onStateChange: (state: BootstrapState) => void;
  onTerminalOutput?: (data: string) => void;
}

/**
 * Bootstrap a WebContainer with the starter template.
 * Like Chef's snapshot loading but file-based.
 *
 * 1. Write template files to WebContainer FS
 * 2. Run npm install
 * 3. Start dev server (npm run dev)
 *
 * Returns the dev server process (so caller can pipe output).
 */
export async function bootstrapProject(
  wc: WebContainer,
  callbacks: BootstrapCallbacks
): Promise<void> {
  try {
    // 1. Write template files
    callbacks.onStateChange("writing-files");
    await writeFiles(wc, TEMPLATE_FILES);

    // 2. npm install
    callbacks.onStateChange("installing");
    const install = await runCommand(wc, "npm", ["install", "--no-fund"], (data) => {
      callbacks.onTerminalOutput?.(data);
    });

    if (install.exitCode !== 0) {
      callbacks.onStateChange("error");
      return;
    }

    // 3. Start dev server
    callbacks.onStateChange("starting-server");
    const devProc = await wc.spawn("npm", ["run", "dev"]);
    devProc.output.pipeTo(
      new WritableStream({
        write(data) {
          callbacks.onTerminalOutput?.(data);
        },
      })
    );

    // Server-ready event is handled by the onServerReady listener in the page
    callbacks.onStateChange("ready");
  } catch (err) {
    callbacks.onStateChange("error");
    throw err;
  }
}

/**
 * Read all user-editable files from WebContainer for sending as context.
 * Skips node_modules, .git, locked infrastructure files.
 */
export async function readProjectFiles(
  wc: WebContainer,
  basePath = ""
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const SKIP = new Set(["node_modules", ".git", "dist", ".vite"]);
  const MAX_FILE = 50_000; // 50KB

  async function walk(dir: string) {
    try {
      const entries = await wc.fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const path = dir ? `${dir}/${entry.name}` : entry.name;
        if (SKIP.has(entry.name)) continue;

        if (entry.isDirectory()) {
          await walk(path);
        } else {
          try {
            const content = await wc.fs.readFile(path, "utf-8");
            if (content.length <= MAX_FILE) {
              files[path] = content;
            }
          } catch {
            // Skip unreadable
          }
        }
      }
    } catch {
      // Skip unreadable dirs
    }
  }

  await walk(basePath);
  return files;
}

/**
 * Format project files as context string for the agent prompt.
 * Follows the <boltArtifact> pattern from Chef/bolt.diy.
 */
/**
 * Only include App.jsx and user-created files as context.
 * Component library source code is EXCLUDED — the design system prompt
 * tells the agent what's available. This keeps the prompt short so
 * layout and spacing rules don't get buried under 1000+ lines of
 * component source code the agent doesn't need to see.
 */
export function formatFilesAsContext(files: Record<string, string>): string {
  const parts: string[] = [
    "## Current App Code\n",
  ];

  // Only include user-editable files, NOT the component library
  for (const [path, content] of Object.entries(files)) {
    // Skip component library internals — agent already knows about them
    if (path.includes("components/ui/")) continue;
    if (path.includes("lib/utils")) continue;
    if (path === "vite.config.js") continue;
    if (path === "src/main.jsx") continue;

    parts.push(`--- ${path} ---`);
    parts.push(content);
    parts.push("");
  }

  parts.push("---\n");
  parts.push("ONLY edit src/App.jsx (or create new page/component files outside of components/ui/).");
  parts.push("Return COMPLETE file contents for every file you change.");
  parts.push("A full component library exists at @/components/ui — import and USE those components.");
  parts.push("NEVER rewrite, modify, or duplicate components in src/components/ui/.");

  return parts.join("\n");
}
