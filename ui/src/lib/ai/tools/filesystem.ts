import { tool } from "ai";
import { z } from "zod";
import { readFile, writeFile, readdir, stat, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { resolveSafePath, getWorkspaceRoot, getRelativePath } from "@/lib/workspace";

const DEV_CLIENT_SRC = "OneDrive/Desktop/dev/ui/src";

function isSelfEdit(filePath: string): boolean {
  return filePath.includes(DEV_CLIENT_SRC);
}

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp", ".avif",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".mp3", ".mp4", ".avi", ".mov", ".webm",
  ".exe", ".dll", ".so", ".dylib", ".bin",
  ".pyc", ".class", ".o", ".obj",
]);

function isBinary(filepath: string): boolean {
  return BINARY_EXTENSIONS.has(extname(filepath).toLowerCase());
}

export const filesystemTools = {
  read_file: tool({
    description: "Read a file from the workspace. Returns file content with line numbers.",
    inputSchema: z.object({
      path: z.string().describe("File path relative to workspace root"),
      offset: z.number().optional().describe("Start reading from this line number (1-based)"),
      limit: z.number().optional().describe("Maximum number of lines to read"),
    }),
    execute: async ({ path, offset, limit }) => {
      try {
        const fullPath = resolveSafePath(path);
        if (!existsSync(fullPath)) return { message: `File not found: ${path}` };
        if (isBinary(fullPath)) {
          const info = await stat(fullPath);
          return { message: `Binary file: ${path} (${info.size} bytes)`, binary: true, size: info.size };
        }

        const content = await readFile(fullPath, "utf-8");
        const lines = content.split("\n");
        const startLine = (offset || 1) - 1;
        const endLine = limit ? startLine + limit : lines.length;
        const slice = lines.slice(startLine, endLine);

        const numbered = slice
          .map((line, i) => `${String(startLine + i + 1).padStart(5)}  ${line}`)
          .join("\n");

        return {
          message: `${path} (${lines.length} lines)`,
          content: numbered,
          totalLines: lines.length,
          shownLines: slice.length,
        };
      } catch (e: unknown) {
        return { message: `Error reading file: ${(e as Error).message}` };
      }
    },
  }),

  write_file: tool({
    description: "Write content to a file in the workspace. Creates directories if needed.",
    inputSchema: z.object({
      path: z.string().describe("File path relative to workspace root"),
      content: z.string().describe("File content to write"),
    }),
    execute: async ({ path, content }) => {
      try {
        const fullPath = resolveSafePath(path);
        if (isSelfEdit(fullPath)) return { message: "Blocked: cannot modify the dev client's own source code." };
        const dir = join(fullPath, "..");
        if (!existsSync(dir)) await mkdir(dir, { recursive: true });
        await writeFile(fullPath, content, "utf-8");
        return { message: `Written: ${path} (${content.split("\n").length} lines, ${content.length} chars)` };
      } catch (e: unknown) {
        return { message: `Error writing file: ${(e as Error).message}` };
      }
    },
  }),

  edit_file: tool({
    description: "Edit a file by replacing specific text. Tries exact match first, then fuzzy match (ignoring whitespace differences). If you struggle with exact matching, use write_file to rewrite the entire file instead.",
    inputSchema: z.object({
      path: z.string().describe("File path relative to workspace root"),
      old_text: z.string().describe("Text to find and replace — tries exact match first, then fuzzy (whitespace-tolerant)"),
      new_text: z.string().describe("Replacement text"),
      replace_all: z.boolean().optional().describe("Replace all occurrences (default: false)"),
    }),
    execute: async ({ path, old_text, new_text, replace_all }) => {
      try {
        const fullPath = resolveSafePath(path);
        if (isSelfEdit(fullPath)) return { message: "Blocked: cannot modify the dev client's own source code." };
        if (!existsSync(fullPath)) return { message: `File not found: ${path}` };

        const content = await readFile(fullPath, "utf-8");

        // Try exact match first
        if (content.includes(old_text)) {
          const occurrences = content.split(old_text).length - 1;
          if (occurrences > 1 && !replace_all) {
            return { message: `Found ${occurrences} occurrences. Set replace_all=true or provide more context.` };
          }
          const newContent = replace_all
            ? content.split(old_text).join(new_text)
            : content.replace(old_text, new_text);
          await writeFile(fullPath, newContent, "utf-8");
          return { message: `Edited ${path}: replaced ${replace_all ? `all ${occurrences}` : "1"} occurrence(s)` };
        }

        // Fuzzy match: normalize whitespace and try again
        const normalize = (s: string) => s.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n /g, "\n").trim();
        const normalizedContent = normalize(content);
        const normalizedOld = normalize(old_text);

        if (normalizedContent.includes(normalizedOld)) {
          // Find the actual text in the original by matching line-by-line
          const oldLines = old_text.trim().split("\n").map(l => l.trim()).filter(Boolean);
          const contentLines = content.split("\n");

          // Find start line
          let startIdx = -1;
          for (let i = 0; i < contentLines.length; i++) {
            if (contentLines[i].trim() === oldLines[0]) {
              // Check if subsequent lines match
              let match = true;
              let endIdx = i;
              let oldLineIdx = 0;
              for (let j = i; j < contentLines.length && oldLineIdx < oldLines.length; j++) {
                const trimmed = contentLines[j].trim();
                if (trimmed === "") continue; // skip blank lines
                if (trimmed === oldLines[oldLineIdx]) {
                  oldLineIdx++;
                  endIdx = j;
                } else {
                  match = false;
                  break;
                }
              }
              if (match && oldLineIdx === oldLines.length) {
                startIdx = i;
                // Replace lines startIdx..endIdx with new_text
                const before = contentLines.slice(0, startIdx);
                const after = contentLines.slice(endIdx + 1);
                const newContent = [...before, new_text, ...after].join("\n");
                await writeFile(fullPath, newContent, "utf-8");
                return { message: `Edited ${path}: fuzzy-matched and replaced (lines ${startIdx + 1}-${endIdx + 1})` };
              }
            }
          }
        }

        // Neither exact nor fuzzy match worked
        // Show nearby content to help the agent
        const lines = content.split("\n");
        const preview = lines.slice(0, Math.min(30, lines.length)).map((l, i) => `${i + 1}: ${l}`).join("\n");
        return {
          message: `Text not found in ${path} (exact or fuzzy). Here are the first 30 lines to help you find the right text:\n${preview}`,
        };
      } catch (e: unknown) {
        return { message: `Error editing file: ${(e as Error).message}` };
      }
    },
  }),

  list_directory: tool({
    description: "List files and directories at a path in the workspace.",
    inputSchema: z.object({
      path: z.string().optional().describe("Directory path relative to workspace root (default: root)"),
      recursive: z.boolean().optional().describe("List recursively (default: false, max depth 3)"),
    }),
    execute: async ({ path, recursive }) => {
      try {
        const fullPath = resolveSafePath(path || ".");
        const items = await readdir(fullPath, { withFileTypes: true });

        const entries = await Promise.all(
          items.map(async (item) => {
            const itemPath = join(fullPath, item.name);
            const relPath = getRelativePath(itemPath);
            if (item.isDirectory()) {
              if (item.name.startsWith(".") || item.name === "node_modules") {
                return { name: item.name, type: "dir" as const, path: relPath };
              }
              if (recursive) {
                try {
                  const subItems = await readdir(itemPath, { withFileTypes: true });
                  return {
                    name: item.name,
                    type: "dir" as const,
                    path: relPath,
                    children: subItems.slice(0, 20).map((s) => ({
                      name: s.name,
                      type: s.isDirectory() ? "dir" : "file",
                    })),
                  };
                } catch {
                  return { name: item.name, type: "dir" as const, path: relPath };
                }
              }
              return { name: item.name, type: "dir" as const, path: relPath };
            }
            const info = await stat(itemPath);
            return {
              name: item.name,
              type: "file" as const,
              path: relPath,
              size: info.size,
            };
          })
        );

        return {
          message: `${entries.length} item(s) in ${path || "."}`,
          entries: entries.sort((a, b) => {
            if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
            return a.name.localeCompare(b.name);
          }),
        };
      } catch (e: unknown) {
        return { message: `Error listing directory: ${(e as Error).message}` };
      }
    },
  }),

  search_files: tool({
    description: "Search for files by name pattern (glob) in the workspace.",
    inputSchema: z.object({
      pattern: z.string().describe("Glob pattern (e.g., '**/*.ts', 'src/**/*.tsx')"),
      path: z.string().optional().describe("Directory to search in (default: workspace root)"),
    }),
    execute: async ({ pattern, path }) => {
      try {
        const { executeShell } = await import("@/lib/executor");
        const searchRoot = resolveSafePath(path || ".");

        // Use find/dir command to search for files matching the pattern
        const isWindows = process.platform === "win32";
        let cmd: string;
        if (isWindows) {
          // Convert glob to a simpler pattern for dir command, or use PowerShell
          cmd = `powershell -Command "Get-ChildItem -Recurse -File -Filter '${pattern.replace(/\*\*\//g, "")}' -Exclude node_modules,.git,.next,dist | Select-Object -First 100 -ExpandProperty FullName"`;
        } else {
          const namePattern = pattern.replace(/\*\*\//g, "");
          cmd = `find . -name "${namePattern}" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.next/*" -type f | head -100`;
        }

        const result = await executeShell(cmd, { cwd: searchRoot, timeout: 15_000 });
        const files = result.stdout.split("\n").filter(Boolean).map((f) => f.trim());

        return {
          message: `${files.length} file(s) matching "${pattern}"`,
          files,
        };
      } catch (e: unknown) {
        return { message: `Search error: ${(e as Error).message}` };
      }
    },
  }),

  search_content: tool({
    description: "Search for text patterns in file contents across the workspace (like grep/ripgrep).",
    inputSchema: z.object({
      pattern: z.string().describe("Search pattern (regex supported)"),
      path: z.string().optional().describe("Directory to search in (default: workspace root)"),
      filePattern: z.string().optional().describe("File glob to filter (e.g., '*.ts')"),
      maxResults: z.number().optional().describe("Maximum results (default: 30)"),
    }),
    execute: async ({ pattern, path, filePattern, maxResults }) => {
      try {
        const { executeShell } = await import("@/lib/executor");
        const searchRoot = resolveSafePath(path || ".");
        const limit = maxResults || 30;

        // Try ripgrep first, fall back to grep
        let cmd: string;
        const globArg = filePattern ? `--glob "${filePattern}"` : "";
        cmd = `rg --no-heading --line-number --max-count 5 ${globArg} "${pattern.replace(/"/g, '\\"')}" . 2>/dev/null || grep -rn --include="${filePattern || "*"}" "${pattern.replace(/"/g, '\\"')}" . 2>/dev/null`;

        const result = await executeShell(cmd, { cwd: searchRoot, timeout: 15_000 });
        const lines = result.stdout.split("\n").filter(Boolean).slice(0, limit);

        const matches = lines.map((line) => {
          const colonIdx = line.indexOf(":");
          const secondColon = line.indexOf(":", colonIdx + 1);
          if (colonIdx > -1 && secondColon > -1) {
            return {
              file: line.slice(0, colonIdx),
              line: parseInt(line.slice(colonIdx + 1, secondColon)) || 0,
              content: line.slice(secondColon + 1).trim(),
            };
          }
          return { file: "", line: 0, content: line };
        });

        return {
          message: `${matches.length} match(es) for "${pattern}"`,
          matches,
        };
      } catch (e: unknown) {
        return { message: `Search error: ${(e as Error).message}` };
      }
    },
  }),
};
