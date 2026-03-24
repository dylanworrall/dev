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
export function formatFilesAsContext(files: Record<string, string>): string {
  const parts: string[] = [
    "Here are the current project files:\n",
  ];

  for (const [path, content] of Object.entries(files)) {
    parts.push(`--- ${path} ---`);
    parts.push(content);
    parts.push("");
  }

  parts.push("---\n");
  parts.push("Modify the files above to fulfill the user's request. Return COMPLETE file contents for every file you change.");
  parts.push("Stack: Vite + React 19 + Tailwind CSS v4 + lucide-react.");
  parts.push("Tailwind v4: uses @import 'tailwindcss' and @theme inline {} in CSS. No tailwind.config file.");
  parts.push("Do NOT modify vite.config.js or src/main.jsx — these are locked infrastructure files.");
  parts.push("Do NOT use placeholder text. Write real content. Make the UI look polished and professional.");

  return parts.join("\n");
}
