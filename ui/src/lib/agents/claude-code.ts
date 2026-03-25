import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { AgentAdapter, AgentEvent, AgentHealth, AgentTask, AgentCapability } from "./types";

function buildCleanEnv(): NodeJS.ProcessEnv {
  const { CLAUDECODE: _, ...cleanEnv } = process.env;
  return {
    ...cleanEnv,
    PATH: `${homedir()}\\.local\\bin;${cleanEnv.PATH || ""}`,
  };
}

const DESIGN_SYSTEM = `You are an elite frontend developer who ships polished, production-grade UIs.

STACK: Vite + React 19 + Tailwind CSS v4 + shadcn/ui components + lucide-react icons.
- Tailwind v4: uses @import "tailwindcss" and @theme inline {} in CSS. NO tailwind.config file.
- Path alias: @/ maps to /src/
- shadcn components are pre-installed at @/components/ui/. USE THEM:
  - Button: import { Button } from "@/components/ui/button" — variants: default, secondary, outline, ghost, destructive. Sizes: default, sm, lg, icon.
  - Input: import { Input } from "@/components/ui/input"
  - Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter: import from "@/components/ui/card"
  - Badge: import { Badge } from "@/components/ui/badge" — variants: default, secondary, destructive, outline.
- cn() utility: import { cn } from "@/lib/utils" for conditional classes.
- Icons: import from "lucide-react". Use className="size-5" for inline, "size-4" in buttons.

DESIGN RULES:
- Dark theme: bg-background for pages, bg-card for surfaces. CSS vars are pre-configured.
- Use the semantic color vars: text-foreground, text-muted-foreground, bg-primary, border-border, etc.
- Primary color is orange (#f97316). Already set as --color-primary in CSS.
- Typography: text-4xl+ font-bold tracking-tight for headings. text-muted-foreground for secondary text.
- Spacing: generous (p-6+, gap-4+). Never cramped.
- ALWAYS use shadcn Button/Input/Card instead of raw HTML elements.
- Layout: max-w-2xl mx-auto for content pages. min-h-screen. Center with flex.
- Transitions: all interactive elements need transition-colors or transition-all.
- NEVER placeholder text. Write real, contextual content.
- NEVER leave TODO comments. Complete, working code only.
- All components in a single App.jsx unless routing is requested.
- Make sure code compiles without errors.

LOCKED FILES (do NOT modify): vite.config.js, src/main.jsx, src/lib/utils.js`;

const MAX_FILE_SIZE = 100_000; // 100KB — skip binary/huge files
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".vite", ".next"]);

/**
 * Snapshot all files with their mtimes before agent runs.
 */
function snapshotFiles(cwd: string): Map<string, number> {
  const snapshot = new Map<string, number>();

  function walk(dir: string, prefix: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const fullPath = join(dir, entry.name);
        const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          walk(fullPath, relPath);
        } else {
          try {
            const stat = statSync(fullPath);
            if (stat.size <= MAX_FILE_SIZE) {
              snapshot.set(relPath, stat.mtimeMs);
            }
          } catch { /* skip */ }
        }
      }
    } catch { /* skip */ }
  }

  walk(cwd, "");
  return snapshot;
}

/**
 * Find files that are new or modified since the snapshot.
 * Compares file mtimes — works without git.
 */
function getChangedFiles(
  cwd: string,
  beforeSnapshot: Map<string, number>
): Array<{ path: string; content: string }> {
  const changed: Array<{ path: string; content: string }> = [];

  function walk(dir: string, prefix: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const fullPath = join(dir, entry.name);
        const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          walk(fullPath, relPath);
        } else {
          try {
            const stat = statSync(fullPath);
            if (stat.size > MAX_FILE_SIZE) continue;

            const prevMtime = beforeSnapshot.get(relPath);
            // New file or modified file
            if (prevMtime === undefined || stat.mtimeMs > prevMtime) {
              const content = readFileSync(fullPath, "utf-8");
              changed.push({ path: relPath.replace(/\\/g, "/"), content });
            }
          } catch { /* skip */ }
        }
      }
    } catch { /* skip */ }
  }

  walk(cwd, "");
  return changed;
}

export class ClaudeCodeAdapter implements AgentAdapter {
  readonly name = "claude-code";
  readonly type = "sync" as const;
  readonly capabilities: AgentCapability[] = [
    "file-read", "file-write", "shell-execute", "git-operations",
  ];

  private runningProcs = new Map<string, ReturnType<typeof spawn>>();

  async *execute(task: AgentTask): AsyncIterable<AgentEvent> {
    yield { type: "task.accepted", taskId: task.id, agent: this.name };
    yield { type: "task.progress", taskId: task.id, message: "Claude Code working..." };

    // Snapshot file mtimes BEFORE agent runs (for change detection)
    const beforeSnapshot = snapshotFiles(task.cwd);

    const claudeModel = task.model === "opus" ? "claude-opus-4-6" : "claude-sonnet-4-6";
    const systemAppend = DESIGN_SYSTEM + (task.appendPrompt ? "\n\n" + task.appendPrompt : "");

    const args = [
      "-p",
      "--output-format", "json",
      "--dangerously-skip-permissions",
      "--model", claudeModel,
      "--append-system-prompt", systemAppend,
    ];

    const maxDuration = task.constraints?.maxDuration ?? 600_000;

    // Run Claude Code as subprocess and collect result
    const { success, parsed, error } = await new Promise<{
      success: boolean;
      parsed?: Record<string, unknown>;
      error?: string;
    }>((resolve) => {
      let stdout = "";
      let stderr = "";
      let killed = false;

      const proc = spawn("claude", args, {
        cwd: task.cwd,
        shell: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: buildCleanEnv(),
      });

      this.runningProcs.set(task.id, proc);
      proc.stdin.write(task.prompt);
      proc.stdin.end();

      const timeout = setTimeout(() => {
        killed = true;
        proc.kill("SIGTERM");
        setTimeout(() => { try { proc.kill("SIGKILL"); } catch {} }, 5000);
      }, maxDuration);

      proc.stdout.on("data", (d) => { stdout += d.toString(); });
      proc.stderr.on("data", (d) => { stderr += d.toString(); });

      proc.on("close", (code) => {
        clearTimeout(timeout);
        this.runningProcs.delete(task.id);

        if (killed) {
          resolve({ success: false, error: "Claude Code timed out" });
          return;
        }

        try {
          const p = JSON.parse(stdout);
          if (p.is_error || p.subtype?.startsWith("error")) {
            resolve({ success: false, error: p.result || p.errors?.join(", ") || "Unknown error" });
          } else {
            resolve({ success: true, parsed: p });
          }
        } catch {
          if (code === 0 && stdout.trim()) {
            resolve({ success: true, parsed: { result: stdout.slice(-3000) } });
          } else {
            resolve({ success: false, error: stderr.slice(-500) || stdout.slice(-500) || "No output" });
          }
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timeout);
        this.runningProcs.delete(task.id);
        resolve({ success: false, error: `Cannot find claude CLI: ${err.message}` });
      });
    });

    if (!success) {
      yield {
        type: "task.failed",
        taskId: task.id,
        error: error || "Unknown error",
        recoverable: true,
        suggestion: error?.includes("Cannot find")
          ? "Install Claude Code: npm i -g @anthropic-ai/claude-code"
          : "Try a simpler or more specific task.",
      };
      return;
    }

    // ── Bridge: compare file mtimes to find what the agent changed ──
    // Compares current files against the pre-agent snapshot.
    // This is how file changes get from the server (local disk) to the
    // client (WebContainer in the browser) via the SSE stream.
    yield { type: "task.progress", taskId: task.id, message: "Syncing file changes..." };

    const changedFiles = getChangedFiles(task.cwd, beforeSnapshot);
    const filePaths: string[] = [];

    for (const file of changedFiles) {
      filePaths.push(file.path);
      yield {
        type: "file.modified",
        taskId: task.id,
        path: file.path,
        content: file.content,
      };
    }

    yield {
      type: "task.completed",
      taskId: task.id,
      summary: (parsed?.result as string)?.slice(0, 3000) || "Done",
      filesChanged: filePaths,
      duration: parsed?.duration_ms as number | undefined,
      turns: parsed?.num_turns as number | undefined,
      sessionId: parsed?.session_id as string | undefined,
    };
  }

  async cancel(taskId: string): Promise<void> {
    const proc = this.runningProcs.get(taskId);
    if (proc) {
      proc.kill("SIGTERM");
      this.runningProcs.delete(taskId);
    }
  }

  async healthCheck(): Promise<AgentHealth> {
    return new Promise((resolve) => {
      const proc = spawn("claude", ["--version"], {
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: buildCleanEnv(),
      });

      const timeout = setTimeout(() => {
        proc.kill();
        resolve({ available: false, error: "Health check timed out" });
      }, 5000);

      proc.on("close", (code) => {
        clearTimeout(timeout);
        resolve({ available: code === 0, error: code !== 0 ? "claude CLI not available" : undefined });
      });

      proc.on("error", () => {
        clearTimeout(timeout);
        resolve({ available: false, error: "claude CLI not installed" });
      });
    });
  }
}
