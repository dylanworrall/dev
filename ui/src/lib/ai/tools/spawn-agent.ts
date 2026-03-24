import { tool } from "ai";
import { z } from "zod";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { nanoid } from "nanoid";
import { getWorkspaceRoot } from "@/lib/workspace";
import { registry, selectAgent, collectResult } from "@/lib/agents";
import type { AgentTask, AgentEvent } from "@/lib/agents";

async function runAgent(task: AgentTask): Promise<Record<string, unknown>> {
  const agent = await selectAgent(task);
  const events: AgentEvent[] = [];

  for await (const event of agent.execute(task)) {
    events.push(event);
  }

  return collectResult(events);
}

export const spawnAgentTools = {
  spawn_claude: tool({
    description: "Spawn Claude Code (Opus) to do coding work. Uses your Claude Code subscription — no extra API cost. Claude Code has full filesystem + terminal access. Use for: writing code, building components, editing files, fixing bugs, installing packages, running builds. Give it a clear, specific task.",
    inputSchema: z.object({
      task: z.string().describe("Clear, detailed task for Claude Code. Include: what to build, which files, design requirements, reference URLs."),
      cwd: z.string().optional().describe("Working directory (relative to workspace root)"),
      model: z.enum(["sonnet", "opus"]).optional().describe("Claude model — sonnet (fast, good for most tasks) or opus (slow, best for complex architecture). Default: sonnet"),
      appendPrompt: z.string().optional().describe("Extra system prompt to append"),
    }),
    execute: async ({ task, cwd, model, appendPrompt }) => {
      const workDir = cwd ? resolve(getWorkspaceRoot(), cwd) : getWorkspaceRoot();
      if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });

      const agentTask: AgentTask = {
        id: nanoid(),
        prompt: task,
        cwd: workDir,
        model: model || "sonnet",
        appendPrompt,
        metadata: { preferredAgent: "claude-code" },
      };

      return runAgent(agentTask);
    },
  }),

  spawn_codex: tool({
    description: "Spawn OpenAI Codex CLI for coding tasks. Sandboxed execution with streaming progress. Requires: npm i -g @openai/codex and OPENAI_API_KEY.",
    inputSchema: z.object({
      task: z.string().describe("Task for Codex"),
      cwd: z.string().optional().describe("Working directory"),
      model: z.string().optional().describe("Codex model (default: o4-mini)"),
    }),
    execute: async ({ task, cwd, model }) => {
      const workDir = cwd ? resolve(getWorkspaceRoot(), cwd) : getWorkspaceRoot();
      if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });

      const agentTask: AgentTask = {
        id: nanoid(),
        prompt: task,
        cwd: workDir,
        model,
        metadata: { preferredAgent: "codex" },
      };

      return runAgent(agentTask);
    },
  }),

  spawn_agent: tool({
    description: "Spawn the best available AI coding agent for a task. Automatically selects between Claude Code, Codex, or other agents based on task type and availability. Use this when you don't have a preference for which agent to use.",
    inputSchema: z.object({
      task: z.string().describe("Clear, detailed task description"),
      cwd: z.string().optional().describe("Working directory (relative to workspace root)"),
      model: z.string().optional().describe("Model override"),
      appendPrompt: z.string().optional().describe("Extra system prompt to append"),
    }),
    execute: async ({ task, cwd, model, appendPrompt }) => {
      const workDir = cwd ? resolve(getWorkspaceRoot(), cwd) : getWorkspaceRoot();
      if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });

      const agentTask: AgentTask = {
        id: nanoid(),
        prompt: task,
        cwd: workDir,
        model,
        appendPrompt,
      };

      return runAgent(agentTask);
    },
  }),

  agent_health: tool({
    description: "Check which AI coding agents are available and healthy. Returns status for Claude Code, Codex, and any other registered agents.",
    inputSchema: z.object({}),
    execute: async () => {
      const health = await registry.getAllHealth();
      return {
        agents: Object.entries(health).map(([name, h]) => ({
          name,
          available: h.available,
          ...(h.error ? { error: h.error } : {}),
          ...(h.rateLimited ? { rateLimited: true, resetAt: h.rateLimitResetAt } : {}),
        })),
      };
    },
  }),
};
