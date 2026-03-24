// ── Agent Protocol Types ──
// Structured contract between the orchestrator and any agent backend.

export interface AgentTask {
  id: string;
  prompt: string;
  cwd: string;
  model?: string;
  appendPrompt?: string;
  constraints?: {
    maxDuration?: number; // ms
    sandbox?: boolean;
  };
  metadata?: {
    projectId?: string;
    parentTaskId?: string;
    retryOf?: string;
    preferredAgent?: string;
    repo?: string; // GitHub repo for Jules (e.g. "owner/repo")
  };
}

// Events emitted by agents back to the orchestrator
export type AgentEvent =
  | { type: "task.accepted"; taskId: string; agent: string }
  | { type: "task.progress"; taskId: string; message: string; percent?: number }
  | { type: "file.modified"; taskId: string; path: string; content: string }
  | { type: "file.created"; taskId: string; path: string; content: string }
  | { type: "file.deleted"; taskId: string; path: string }
  | { type: "command.started"; taskId: string; command: string }
  | { type: "command.output"; taskId: string; output: string }
  | { type: "command.completed"; taskId: string; command: string; exitCode: number }
  | { type: "preview.ready"; taskId: string; url: string; port: number }
  | { type: "task.completed"; taskId: string; summary: string; filesChanged: string[]; duration?: number; turns?: number; sessionId?: string }
  | { type: "task.failed"; taskId: string; error: string; recoverable: boolean; suggestion?: string }
  | { type: "task.cancelled"; taskId: string };

export type AgentCapability =
  | "file-read"
  | "file-write"
  | "shell-execute"
  | "git-operations"
  | "web-search"
  | "screenshot"
  | "deploy"
  | "native-binaries"
  | "database-access";

export interface AgentHealth {
  available: boolean;
  latency?: number;
  rateLimited?: boolean;
  rateLimitResetAt?: number;
  error?: string;
}

export type AgentType = "sync" | "async";

export interface AgentAdapter {
  readonly name: string;
  readonly type: AgentType;
  readonly capabilities: AgentCapability[];

  execute(task: AgentTask): AsyncIterable<AgentEvent>;
  cancel(taskId: string): Promise<void>;
  healthCheck(): Promise<AgentHealth>;
}

// Result type for tool consumers who just want the final outcome
export type AgentResult = {
  [key: string]: unknown;
  success: boolean;
  message: string;
  result?: string;
  error?: string;
  suggestion?: string;
  filesChanged?: string[];
  duration?: string;
  turns?: number;
  sessionId?: string;
  agent: string;
};

// Collect events into a final result
export function collectResult(events: AgentEvent[]): AgentResult {
  const completed = events.find((e): e is Extract<AgentEvent, { type: "task.completed" }> => e.type === "task.completed");
  const failed = events.find((e): e is Extract<AgentEvent, { type: "task.failed" }> => e.type === "task.failed");
  const accepted = events.find((e): e is Extract<AgentEvent, { type: "task.accepted" }> => e.type === "task.accepted");
  const agent = accepted?.agent ?? "unknown";

  if (completed) {
    return {
      success: true,
      message: `${agent} completed (${completed.turns ?? "?"} turns, ${completed.duration ? Math.round(completed.duration / 1000) + "s" : "?"})`,
      result: completed.summary.slice(0, 3000),
      filesChanged: completed.filesChanged,
      duration: completed.duration ? `${Math.round(completed.duration / 1000)}s` : undefined,
      turns: completed.turns,
      sessionId: completed.sessionId,
      agent,
    };
  }

  if (failed) {
    return {
      success: false,
      message: `${agent} failed: ${failed.error}`,
      error: failed.error,
      suggestion: failed.suggestion,
      agent,
    };
  }

  return { success: false, message: "Agent returned no completion event", agent };
}
