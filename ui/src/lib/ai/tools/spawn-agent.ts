import { tool } from "ai";
import { z } from "zod";
import { spawn } from "node:child_process";
import { getWorkspaceRoot } from "@/lib/workspace";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

export const spawnAgentTools = {
  spawn_claude: tool({
    description: "Spawn Claude Code to do complex coding work. Use this for: writing entire files, building components, fixing bugs, refactoring, installing packages, running builds. Claude Code has full filesystem + terminal access and is much better at coding than you. Give it a clear task and it will do the work and report back. You are the orchestrator — delegate the coding to Claude.",
    inputSchema: z.object({
      task: z.string().describe("Clear task description for Claude Code. Be specific about what to build, which files to create/edit, and what the end result should look like."),
      cwd: z.string().optional().describe("Working directory for Claude Code (relative to workspace root)"),
      maxBudget: z.number().optional().describe("Max USD to spend on this task (default: 0.50)"),
      allowedTools: z.string().optional().describe("Tools to allow (default: all). E.g., 'Bash Edit Write Read'"),
    }),
    execute: async ({ task, cwd, maxBudget, allowedTools }) => {
      const workDir = cwd ? resolve(getWorkspaceRoot(), cwd) : getWorkspaceRoot();
      if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });

      const budget = maxBudget || 2.00;
      const args = [
        "-p", task,
        "--output-format", "json",
        "--dangerously-skip-permissions",
        "--max-budget-usd", String(budget),
      ];

      if (allowedTools) {
        args.push("--allowedTools", allowedTools);
      }

      return new Promise<Record<string, unknown>>((resolvePromise) => {
        let stdout = "";
        let stderr = "";

        const proc = spawn("claude", args, {
          cwd: workDir,
          shell: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env },
        });

        const timeout = setTimeout(() => {
          proc.kill();
          resolvePromise({
            message: "Claude Code timed out after 5 minutes",
            timedOut: true,
            partialOutput: stdout.slice(-2000),
          });
        }, 300_000); // 5 min timeout

        proc.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        proc.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        proc.on("close", (code) => {
          clearTimeout(timeout);

          // Parse Claude Code's JSON output
          try {
            const result = JSON.parse(stdout) as {
              result?: string;
              cost_usd?: number;
              duration_ms?: number;
              num_turns?: number;
              session_id?: string;
            };

            resolvePromise({
              message: `Claude Code completed (${result.num_turns || "?"} turns, $${result.cost_usd?.toFixed(4) || "?"})`,
              result: result.result?.slice(0, 3000) || "No output",
              cost: result.cost_usd,
              duration: result.duration_ms ? `${Math.round(result.duration_ms / 1000)}s` : undefined,
              turns: result.num_turns,
              sessionId: result.session_id,
              exitCode: code,
            });
          } catch {
            // Not valid JSON — return raw output
            resolvePromise({
              message: code === 0 ? "Claude Code completed" : `Claude Code exited with code ${code}`,
              result: stdout.slice(-3000) || stderr.slice(-1000) || "No output",
              exitCode: code,
            });
          }
        });

        proc.on("error", (err) => {
          clearTimeout(timeout);
          resolvePromise({
            message: `Failed to spawn Claude Code: ${err.message}`,
            error: err.message,
          });
        });
      });
    },
  }),

  spawn_codex: tool({
    description: "Spawn OpenAI Codex CLI for coding tasks. Alternative to Claude Code. Requires 'codex' CLI to be installed.",
    inputSchema: z.object({
      task: z.string().describe("Task description for Codex"),
      cwd: z.string().optional().describe("Working directory"),
    }),
    execute: async ({ task, cwd }) => {
      const workDir = cwd ? resolve(getWorkspaceRoot(), cwd) : getWorkspaceRoot();
      if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });

      return new Promise<Record<string, unknown>>((resolvePromise) => {
        let stdout = "";
        let stderr = "";

        // Try codex CLI
        const proc = spawn("codex", ["--quiet", "--full-auto", task], {
          cwd: workDir,
          shell: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env },
        });

        const timeout = setTimeout(() => {
          proc.kill();
          resolvePromise({ message: "Codex timed out", timedOut: true });
        }, 300_000);

        proc.stdout.on("data", (d) => { stdout += d.toString(); });
        proc.stderr.on("data", (d) => { stderr += d.toString(); });

        proc.on("close", (code) => {
          clearTimeout(timeout);
          resolvePromise({
            message: code === 0 ? "Codex completed" : `Codex exited with code ${code}`,
            result: stdout.slice(-3000) || "No output",
            error: code !== 0 ? stderr.slice(-500) : undefined,
            exitCode: code,
          });
        });

        proc.on("error", (err) => {
          clearTimeout(timeout);
          resolvePromise({
            message: `Codex not found: ${err.message}. Install with: npm i -g @openai/codex`,
            error: err.message,
          });
        });
      });
    },
  }),
};
