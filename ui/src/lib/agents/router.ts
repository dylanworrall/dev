import type { AgentAdapter, AgentTask, AgentEvent } from "./types";
import { registry } from "./registry";

type TaskType = "quick-edit" | "scaffold" | "full-build" | "complex-refactor" | "background" | "general";

// Score each agent for a given task type
const AGENT_SCORES: Record<string, Partial<Record<TaskType, number>>> = {
  "claude-code": { "complex-refactor": 20, "full-build": 15, general: 10 },
  codex: { scaffold: 20, "full-build": 15, general: 8 },
  jules: { background: 25, "complex-refactor": 10 },
  webcontainer: { "quick-edit": 25 },
};

function inferTaskType(task: AgentTask): TaskType {
  const p = task.prompt.toLowerCase();
  if (/\b(scaffold|init|create.*(app|project|repo))\b/.test(p)) return "scaffold";
  if (/\b(build|implement|full)\b/.test(p) && p.length > 200) return "full-build";
  if (/\b(refactor|migrate|rename|reorganize)\b/.test(p)) return "complex-refactor";
  if (/\b(edit|fix|change|update|tweak|add.*button|add.*field)\b/.test(p)) return "quick-edit";
  return "general";
}

export async function selectAgent(task: AgentTask): Promise<AgentAdapter> {
  // 1. User override
  if (task.metadata?.preferredAgent) {
    const preferred = registry.get(task.metadata.preferredAgent);
    if (preferred) {
      const health = await registry.getHealth(preferred.name);
      if (health.available) return preferred;
    }
  }

  // 2. Score all healthy agents for this task
  const taskType = inferTaskType(task);
  const allHealth = await registry.getAllHealth();

  const candidates = registry.all()
    .filter((a) => allHealth[a.name]?.available)
    .map((a) => ({
      adapter: a,
      score: (AGENT_SCORES[a.name]?.[taskType] ?? 0) + (a.type === "sync" ? 5 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  if (candidates.length > 0) {
    return candidates[0].adapter;
  }

  // 3. Fallback: return claude-code even if unhealthy (let it fail with a clear error)
  return registry.get("claude-code")!;
}

// Execute a task with automatic retry on a different agent
export async function* executeWithRetry(
  task: AgentTask,
  maxRetries = 1,
): AsyncIterable<AgentEvent> {
  const triedAgents: string[] = [];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const agent = await selectAgent(task);

    // Don't retry with the same agent
    if (triedAgents.includes(agent.name) && attempt > 0) {
      let fallback: AgentAdapter | undefined;
      for (const a of registry.all()) {
        if (!triedAgents.includes(a.name)) {
          const h = await registry.getHealth(a.name);
          if (h.available) { fallback = a; break; }
        }
      }
      if (!fallback) break;
      triedAgents.push(fallback.name);
      try {
        yield* fallback.execute(task);
        return;
      } catch {
        continue;
      }
    }

    triedAgents.push(agent.name);

    try {
      let lastEvent: AgentEvent | undefined;
      for await (const event of agent.execute(task)) {
        lastEvent = event;
        yield event;

        // If agent completed or failed non-recoverably, stop
        if (event.type === "task.completed") return;
        if (event.type === "task.failed" && !event.recoverable) return;
      }

      // Check if last event was a recoverable failure
      if (lastEvent?.type === "task.failed" && lastEvent.recoverable && attempt < maxRetries) {
        registry.invalidateHealth(agent.name);
        yield {
          type: "task.progress",
          taskId: task.id,
          message: `${agent.name} failed, trying next agent...`,
        };
        continue;
      }

      return;
    } catch (err) {
      registry.invalidateHealth(agent.name);
      if (attempt < maxRetries) {
        yield {
          type: "task.progress",
          taskId: task.id,
          message: `${agent.name} error: ${err instanceof Error ? err.message : "unknown"}, retrying...`,
        };
        continue;
      }
      yield {
        type: "task.failed",
        taskId: task.id,
        error: `All agents failed after ${attempt + 1} attempts`,
        recoverable: false,
      };
    }
  }
}
