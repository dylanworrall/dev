import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { AgentAdapter, AgentEvent, AgentHealth, AgentTask, AgentCapability } from "./types";

const MAX_FILE_SIZE = 100_000;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".vite"]);

/** Read file content from disk if the JSONL event didn't include it */
function readFileIfMissing(cwd: string, relPath: string, content: string | undefined): string {
  if (content && content.length > 0) return content;
  try {
    const abs = join(cwd, relPath);
    if (!existsSync(abs)) return "";
    const stat = statSync(abs);
    if (stat.isDirectory() || stat.size > MAX_FILE_SIZE) return "";
    return readFileSync(abs, "utf-8");
  } catch {
    return "";
  }
}

/** Snapshot all files with mtimes */
function snapshotFiles(cwd: string): Map<string, number> {
  const snapshot = new Map<string, number>();
  function walk(dir: string, prefix: string) {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const full = join(dir, entry.name);
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) { walk(full, rel); }
        else {
          try { const s = statSync(full); if (s.size <= MAX_FILE_SIZE) snapshot.set(rel, s.mtimeMs); } catch {}
        }
      }
    } catch {}
  }
  walk(cwd, "");
  return snapshot;
}

/** Find files changed since snapshot that weren't in JSONL events */
function findMissingChangedFiles(
  cwd: string,
  beforeSnapshot: Map<string, number>,
  alreadyTracked: Set<string>
): Array<{ path: string; content: string }> {
  const changed: Array<{ path: string; content: string }> = [];
  function walk(dir: string, prefix: string) {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const full = join(dir, entry.name);
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) { walk(full, rel); }
        else if (!alreadyTracked.has(rel)) {
          try {
            const s = statSync(full);
            if (s.size > MAX_FILE_SIZE) continue;
            const prev = beforeSnapshot.get(rel);
            if (prev === undefined || s.mtimeMs > prev) {
              changed.push({ path: rel.replace(/\\/g, "/"), content: readFileSync(full, "utf-8") });
            }
          } catch {}
        }
      }
    } catch {}
  }
  walk(cwd, "");
  return changed;
}

export class CodexAdapter implements AgentAdapter {
  readonly name = "codex";
  readonly type = "sync" as const;
  readonly capabilities: AgentCapability[] = [
    "file-read", "file-write", "shell-execute",
  ];

  private runningProcs = new Map<string, ReturnType<typeof spawn>>();

  async *execute(task: AgentTask): AsyncIterable<AgentEvent> {
    yield { type: "task.accepted", taskId: task.id, agent: this.name };

    // Snapshot before agent runs
    const beforeSnapshot = snapshotFiles(task.cwd);

    const args = [
      "exec",
      "--json",
      "--full-auto",
      "-C", task.cwd,
      "--ephemeral",
    ];

    if (task.model) {
      args.push("-m", task.model);
    }

    args.push(task.prompt);

    const maxDuration = task.constraints?.maxDuration ?? 300_000;

    // We need to yield from inside async callbacks, so collect events via a channel
    const events: AgentEvent[] = [];
    let done = false;
    let resolveWait: (() => void) | null = null;

    const push = (event: AgentEvent) => {
      events.push(event);
      if (resolveWait) {
        resolveWait();
        resolveWait = null;
      }
    };

    const proc = spawn("codex", args, {
      cwd: task.cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CODEX_API_KEY: process.env.CODEX_API_KEY || process.env.OPENAI_API_KEY || "" },
    });

    this.runningProcs.set(task.id, proc);

    const timeout = setTimeout(() => {
      proc.kill();
      push({ type: "task.failed", taskId: task.id, error: "Codex timed out", recoverable: true });
      done = true;
    }, maxDuration);

    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });

    // Parse JSONL stream from stdout
    const rl = createInterface({ input: proc.stdout });

    rl.on("line", (line) => {
      if (!line.trim()) return;
      try {
        const event = JSON.parse(line) as {
          type: string;
          item?: {
            type?: string;
            command?: string;
            path?: string;
            content?: string;
            text?: string;
            exitCode?: number;
            id?: string;
          };
          usage?: { input_tokens?: number; output_tokens?: number };
          message?: string;
          thread_id?: string;
        };

        switch (event.type) {
          case "item.started":
            if (event.item?.type === "command_execution") {
              push({ type: "command.started", taskId: task.id, command: event.item.command || "" });
            } else if (event.item?.type === "agent_message") {
              push({ type: "task.progress", taskId: task.id, message: event.item.text || "Working..." });
            }
            break;

          case "item.completed":
            if (event.item?.type === "file_modification") {
              const filePath = event.item.path || "";
              const content = readFileIfMissing(task.cwd, filePath, event.item.content);
              push({ type: "file.modified", taskId: task.id, path: filePath, content });
            } else if (event.item?.type === "command_execution") {
              push({ type: "command.completed", taskId: task.id, command: event.item.command || "", exitCode: event.item.exitCode ?? 0 });
            } else if (event.item?.type === "agent_message") {
              push({ type: "task.progress", taskId: task.id, message: event.item.text || "" });
            }
            break;

          case "turn.completed": {
            // Sweep for files changed on disk but not in JSONL events
            const trackedPaths = new Set(
              events
                .filter((e): e is Extract<AgentEvent, { type: "file.modified" }> => e.type === "file.modified")
                .map(e => e.path)
            );
            const missing = findMissingChangedFiles(task.cwd, beforeSnapshot, trackedPaths);
            for (const f of missing) {
              push({ type: "file.modified", taskId: task.id, path: f.path, content: f.content });
              trackedPaths.add(f.path);
            }

            push({
              type: "task.completed",
              taskId: task.id,
              summary: "Codex execution complete",
              filesChanged: [...trackedPaths],
            });
            break;
          }

          case "turn.failed":
          case "error":
            push({ type: "task.failed", taskId: task.id, error: event.message || "Codex error", recoverable: true });
            break;
        }
      } catch {
        // Non-JSON line, ignore
      }
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      this.runningProcs.delete(task.id);

      // If no completion event was emitted, synthesize one
      const hasTerminal = events.some(e => e.type === "task.completed" || e.type === "task.failed");
      if (!hasTerminal) {
        if (code === 0) {
          push({ type: "task.completed", taskId: task.id, summary: "Codex completed", filesChanged: [] });
        } else {
          push({ type: "task.failed", taskId: task.id, error: stderr.slice(-500) || `Codex exited (code ${code})`, recoverable: true });
        }
      }
      done = true;
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      this.runningProcs.delete(task.id);
      push({ type: "task.failed", taskId: task.id, error: `Codex not found: ${err.message}`, recoverable: false, suggestion: "Install: npm i -g @openai/codex" });
      done = true;
    });

    // Yield events as they arrive
    let cursor = 0;
    while (!done || cursor < events.length) {
      if (cursor < events.length) {
        yield events[cursor++];
      } else {
        await new Promise<void>((r) => { resolveWait = r; });
      }
    }
    // Drain remaining
    while (cursor < events.length) {
      yield events[cursor++];
    }
  }

  async cancel(taskId: string): Promise<void> {
    const proc = this.runningProcs.get(taskId);
    if (proc) {
      proc.kill("SIGTERM");
      this.runningProcs.delete(taskId);
    }
  }

  async healthCheck(): Promise<AgentHealth> {
    const hasKey = !!(process.env.CODEX_API_KEY || process.env.OPENAI_API_KEY);
    if (!hasKey) {
      return { available: false, error: "No CODEX_API_KEY or OPENAI_API_KEY set" };
    }

    return new Promise((resolve) => {
      const proc = spawn("codex", ["--version"], {
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const timeout = setTimeout(() => {
        proc.kill();
        resolve({ available: false, error: "Health check timed out" });
      }, 5000);

      proc.on("close", (code) => {
        clearTimeout(timeout);
        resolve({ available: code === 0 });
      });

      proc.on("error", () => {
        clearTimeout(timeout);
        resolve({ available: false, error: "codex CLI not installed" });
      });
    });
  }
}
