"use client";

import type { AgentAdapter, AgentEvent, AgentHealth, AgentTask, AgentCapability } from "./types";
import { getWebContainer, onServerReady } from "@/lib/webcontainer/instance";
import { syncEventToFS, runCommand } from "@/lib/webcontainer/fs-sync";

interface FileOp {
  type: "write-file";
  path: string;
  content: string;
}

interface ShellOp {
  type: "shell";
  command: string;
  args?: string[];
}

export type WebContainerOp = FileOp | ShellOp;

/**
 * WebContainer adapter — executes operations directly in the browser.
 * Unlike Claude Code / Codex, this doesn't call an LLM.
 * It receives pre-planned operations from the orchestrator and applies them
 * to the in-browser WebContainer for instant preview.
 */
export class WebContainerAdapter implements AgentAdapter {
  readonly name = "webcontainer";
  readonly type = "sync" as const;
  readonly capabilities: AgentCapability[] = [
    "file-read", "file-write", "shell-execute",
  ];

  private activeTasks = new Set<string>();

  /**
   * Execute a list of operations in the WebContainer.
   * The task prompt is ignored — use task.metadata.operations instead.
   */
  async *execute(task: AgentTask & { operations?: WebContainerOp[] }): AsyncIterable<AgentEvent> {
    yield { type: "task.accepted", taskId: task.id, agent: this.name };
    this.activeTasks.add(task.id);

    const wc = await getWebContainer();
    const operations = task.operations ?? [];
    const filesChanged: string[] = [];

    try {
      for (const op of operations) {
        if (!this.activeTasks.has(task.id)) {
          yield { type: "task.cancelled", taskId: task.id };
          return;
        }

        if (op.type === "write-file") {
          const event: AgentEvent = {
            type: "file.created",
            taskId: task.id,
            path: op.path,
            content: op.content,
          };
          await syncEventToFS(wc, event);
          filesChanged.push(op.path);
          yield event;
        }

        if (op.type === "shell") {
          const args = op.args ?? op.command.split(" ").slice(1);
          const cmd = op.args ? op.command : op.command.split(" ")[0];

          yield { type: "command.started", taskId: task.id, command: op.command };

          const result = await runCommand(wc, cmd, args, (output) => {
            // Could stream output here in future
          });

          yield {
            type: "command.completed",
            taskId: task.id,
            command: op.command,
            exitCode: result.exitCode,
          };
        }
      }

      // Check if a server started
      let previewUrl: string | undefined;
      const unsub = onServerReady((_port, url) => {
        previewUrl = url;
      });

      // Give the server a moment to start if last op was a shell command
      if (operations.length > 0 && operations[operations.length - 1].type === "shell") {
        await new Promise((r) => setTimeout(r, 2000));
      }

      unsub();

      if (previewUrl) {
        yield { type: "preview.ready", taskId: task.id, url: previewUrl, port: 0 };
      }

      yield {
        type: "task.completed",
        taskId: task.id,
        summary: `Applied ${operations.length} operations in WebContainer`,
        filesChanged,
      };
    } catch (err) {
      yield {
        type: "task.failed",
        taskId: task.id,
        error: err instanceof Error ? err.message : "WebContainer error",
        recoverable: true,
      };
    } finally {
      this.activeTasks.delete(task.id);
    }
  }

  async cancel(taskId: string): Promise<void> {
    this.activeTasks.delete(taskId);
  }

  async healthCheck(): Promise<AgentHealth> {
    // WebContainer is available if we're in a browser with SharedArrayBuffer
    if (typeof window === "undefined") {
      return { available: false, error: "Not in browser" };
    }
    if (typeof SharedArrayBuffer === "undefined") {
      return { available: false, error: "SharedArrayBuffer not available (needs COOP/COEP headers)" };
    }
    return { available: true };
  }
}
