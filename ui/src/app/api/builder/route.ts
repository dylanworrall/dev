import { nanoid } from "nanoid";
import { loadDevEnv } from "@/lib/env";
import { selectAgent } from "@/lib/agents/router";
import { registry } from "@/lib/agents/registry";
import type { AgentTask, AgentEvent } from "@/lib/agents/types";
import { getWorkspaceRoot } from "@/lib/workspace";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";

/**
 * Write project files to disk so the agent (Claude Code/Codex) can modify them.
 * This bridges the WebContainer (browser) → local filesystem (server) gap.
 */
function writeProjectToDisk(
  cwd: string,
  files: Record<string, string>
): void {
  for (const [path, content] of Object.entries(files)) {
    const absPath = join(cwd, path);
    const dir = dirname(absPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(absPath, content, "utf-8");
  }
}

export async function POST(req: Request) {
  loadDevEnv(true);

  const body = await req.json();
  const {
    prompt,
    fileContext,
    files,
    cwd,
    preferredAgent,
    model,
  } = body as {
    prompt?: string;
    fileContext?: string;
    files?: Record<string, string>;
    cwd?: string;
    preferredAgent?: string;
    model?: string;
  };

  if (!prompt?.trim()) {
    return Response.json({ error: "No prompt provided" }, { status: 400 });
  }

  // Create a project directory for the agent to work in
  const projectName = `builder-${nanoid(6)}`;
  const workDir = cwd
    ? resolve(getWorkspaceRoot(), cwd)
    : resolve(getWorkspaceRoot(), ".builder-projects", projectName);

  if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });

  // Write the current WebContainer files to disk so the agent can see them
  if (files && Object.keys(files).length > 0) {
    writeProjectToDisk(workDir, files);
  }

  // Build the full prompt: user request + file context
  const fullPrompt = fileContext
    ? `${fileContext}\n\n## User Request\n\n${prompt}`
    : prompt;

  const task: AgentTask = {
    id: nanoid(),
    prompt: fullPrompt,
    cwd: workDir,
    model,
    metadata: {
      preferredAgent: preferredAgent || undefined,
      projectId: projectName,
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

          if (
            event.type === "task.completed" ||
            event.type === "task.failed" ||
            event.type === "task.cancelled"
          ) {
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
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`)
        );
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
