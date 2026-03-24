import type { AgentAdapter, AgentEvent, AgentHealth, AgentTask, AgentCapability } from "./types";

const JULES_API = "https://jules.googleapis.com/v1alpha";

interface JulesSession {
  name: string;
  state: "CREATING" | "PLANNING" | "PLAN_PENDING" | "CODING" | "EDITING" | "COMPLETED" | "FAILED" | "CANCELLED";
  outputs?: Array<{
    pullRequest?: {
      url: string;
      title: string;
      description: string;
    };
  }>;
}

export class JulesAdapter implements AgentAdapter {
  readonly name = "jules";
  readonly type = "async" as const;
  readonly capabilities: AgentCapability[] = [
    "file-read", "file-write", "shell-execute", "git-operations", "native-binaries",
  ];

  private activeSessions = new Map<string, string>(); // taskId -> sessionName
  private pollInterval = 15_000; // 15s

  private get apiKey(): string {
    return process.env.JULES_API_KEY || "";
  }

  private async apiCall(path: string, options?: RequestInit): Promise<Response> {
    return fetch(`${JULES_API}${path}`, {
      ...options,
      headers: {
        "X-Goog-Api-Key": this.apiKey,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
  }

  async *execute(task: AgentTask): AsyncIterable<AgentEvent> {
    yield { type: "task.accepted", taskId: task.id, agent: this.name };

    // Extract repo from metadata or cwd
    const repo = task.metadata?.repo;
    if (!repo) {
      yield {
        type: "task.failed",
        taskId: task.id,
        error: "Jules requires a GitHub repo. Set task.metadata.repo (e.g. 'owner/repo')",
        recoverable: false,
      };
      return;
    }

    // Create session
    let session: JulesSession;
    try {
      const res = await this.apiCall("/sessions", {
        method: "POST",
        body: JSON.stringify({
          prompt: task.prompt,
          sourceContext: {
            source: `sources/github/${repo}`,
            githubRepoContext: { startingBranch: "main" },
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        yield {
          type: "task.failed",
          taskId: task.id,
          error: `Jules API error (${res.status}): ${text.slice(0, 200)}`,
          recoverable: res.status === 429,
        };
        return;
      }

      session = await res.json();
      this.activeSessions.set(task.id, session.name);
    } catch (err) {
      yield {
        type: "task.failed",
        taskId: task.id,
        error: `Jules API call failed: ${err instanceof Error ? err.message : "unknown"}`,
        recoverable: true,
      };
      return;
    }

    yield { type: "task.progress", taskId: task.id, message: `Jules session created: ${session.name}` };

    // Poll for completion
    const maxDuration = task.constraints?.maxDuration ?? 600_000; // 10 min default
    const deadline = Date.now() + maxDuration;

    while (Date.now() < deadline) {
      // Check if cancelled
      if (!this.activeSessions.has(task.id)) {
        yield { type: "task.cancelled", taskId: task.id };
        return;
      }

      await new Promise((r) => setTimeout(r, this.pollInterval));

      try {
        const res = await this.apiCall(`/${session.name}`);
        if (!res.ok) continue;

        const status: JulesSession = await res.json();
        session = status;

        yield {
          type: "task.progress",
          taskId: task.id,
          message: `Jules: ${status.state.toLowerCase().replace("_", " ")}`,
        };

        // Auto-approve plans
        if (status.state === "PLAN_PENDING") {
          await this.apiCall(`/${session.name}:approvePlan`, { method: "POST" });
          yield { type: "task.progress", taskId: task.id, message: "Jules: plan approved" };
        }

        if (status.state === "COMPLETED") {
          const prUrl = status.outputs?.[0]?.pullRequest?.url;
          this.activeSessions.delete(task.id);
          yield {
            type: "task.completed",
            taskId: task.id,
            summary: prUrl ? `PR created: ${prUrl}` : "Jules completed (no PR output)",
            filesChanged: [],
          };
          return;
        }

        if (status.state === "FAILED" || status.state === "CANCELLED") {
          this.activeSessions.delete(task.id);
          yield {
            type: "task.failed",
            taskId: task.id,
            error: `Jules session ${status.state.toLowerCase()}`,
            recoverable: false,
          };
          return;
        }
      } catch {
        // Network error, keep polling
      }
    }

    // Timed out
    this.activeSessions.delete(task.id);
    yield {
      type: "task.failed",
      taskId: task.id,
      error: `Jules timed out after ${Math.round(maxDuration / 60000)}min`,
      recoverable: true,
    };
  }

  async cancel(taskId: string): Promise<void> {
    this.activeSessions.delete(taskId);
    // Jules API doesn't have a cancel endpoint in alpha — just stop polling
  }

  async healthCheck(): Promise<AgentHealth> {
    if (!this.apiKey) {
      return { available: false, error: "No JULES_API_KEY set" };
    }

    try {
      const res = await this.apiCall("/sources");
      return { available: res.ok, error: res.ok ? undefined : `API returned ${res.status}` };
    } catch (err) {
      return { available: false, error: err instanceof Error ? err.message : "API unreachable" };
    }
  }
}
