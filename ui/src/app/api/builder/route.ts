import { nanoid } from "nanoid";
import { loadDevEnv } from "@/lib/env";
import { selectAgent } from "@/lib/agents/router";
import { registry } from "@/lib/agents/registry";
import type { AgentTask, AgentEvent } from "@/lib/agents/types";
import { getWorkspaceRoot } from "@/lib/workspace";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

export async function POST(req: Request) {
  loadDevEnv(true);

  const body = await req.json();
  const { prompt, cwd, preferredAgent, model } = body as {
    prompt?: string;
    cwd?: string;
    preferredAgent?: string;
    model?: string;
  };

  if (!prompt?.trim()) {
    return Response.json({ error: "No prompt provided" }, { status: 400 });
  }

  const workDir = cwd ? resolve(getWorkspaceRoot(), cwd) : getWorkspaceRoot();
  if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });

  const task: AgentTask = {
    id: nanoid(),
    prompt,
    cwd: workDir,
    model,
    metadata: {
      preferredAgent: preferredAgent || undefined,
    },
  };

  // Stream AgentEvents as SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const agent = await selectAgent(task);

        for await (const event of agent.execute(task)) {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));

          // Stop streaming after terminal events
          if (event.type === "task.completed" || event.type === "task.failed" || event.type === "task.cancelled") {
            break;
          }
        }
      } catch (err) {
        const errorEvent: AgentEvent = {
          type: "task.failed",
          taskId: task.id,
          error: err instanceof Error ? err.message : "Unknown error",
          recoverable: false,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// Health endpoint
export async function GET() {
  loadDevEnv(true);
  const health = await registry.getAllHealth();
  return Response.json({ agents: health });
}
