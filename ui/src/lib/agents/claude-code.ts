import { spawn, execSync } from "node:child_process";
import { homedir } from "node:os";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { AgentAdapter, AgentEvent, AgentHealth, AgentTask, AgentCapability } from "./types";

function buildCleanEnv(): NodeJS.ProcessEnv {
  const { CLAUDECODE: _, ...cleanEnv } = process.env;
  return {
    ...cleanEnv,
    PATH: `${homedir()}\\.local\\bin;${cleanEnv.PATH || ""}`,
  };
}

const DESIGN_SYSTEM = `You are a senior frontend developer. Follow these rules:
- Use Tailwind CSS v4 syntax (@import "tailwindcss", @theme block, no @apply)
- Dark mode: zinc-950 background, zinc-900 cards, zinc-800 borders
- Gradients: from-violet-500 to-indigo-500 for accents
- Typography: text-5xl+ for heroes, tracking-tight on headings
- Cards: rounded-2xl, border border-zinc-800, backdrop-blur
- Animations: hover:scale-105 transition-transform
- NEVER use placeholder text like "Project Title 1"
- NEVER use single quotes for strings with apostrophes
- Make sure code compiles without errors`;

const MAX_FILE_SIZE = 100_000; // 100KB — skip binary/huge files

/**
 * Read changed files from disk after Claude Code finishes.
 * Uses git diff if available, falls back to checking common paths.
 */
function getChangedFiles(cwd: string): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];

  try {
    // Try git diff to find changed/new files
    const diffOutput = execSync(
      "git diff --name-only HEAD 2>/dev/null || git diff --name-only 2>/dev/null || git status --porcelain --short 2>/dev/null",
      { cwd, encoding: "utf-8", timeout: 5000 }
    ).trim();

    if (!diffOutput) return files;

    const paths = diffOutput
      .split("\n")
      .map((line) => line.replace(/^[MADRCU?\s]+/, "").trim()) // strip git status prefixes
      .filter(Boolean)
      .filter((p) => !p.includes("node_modules") && !p.includes(".git/"));

    for (const relPath of paths) {
      const absPath = join(cwd, relPath);
      try {
        if (!existsSync(absPath)) continue;
        const stat = statSync(absPath);
        if (stat.isDirectory() || stat.size > MAX_FILE_SIZE) continue;
        const content = readFileSync(absPath, "utf-8");
        files.push({ path: relPath.replace(/\\/g, "/"), content });
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // git not available — no file recovery
  }

  return files;
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

    // ── Bridge: read changed files from disk and emit file events ──
    // This is how file changes get from the server (local disk) to the
    // client (WebContainer in the browser) via the SSE stream.
    yield { type: "task.progress", taskId: task.id, message: "Syncing file changes..." };

    const changedFiles = getChangedFiles(task.cwd);
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
