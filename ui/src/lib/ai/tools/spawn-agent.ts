import { tool } from "ai";
import { z } from "zod";
import { spawn } from "node:child_process";
import { getWorkspaceRoot } from "@/lib/workspace";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

function buildCleanEnv(): NodeJS.ProcessEnv {
  // Strip CLAUDECODE to prevent nesting detection (OpenClaw pattern)
  const { CLAUDECODE: _, ...cleanEnv } = process.env;
  return {
    ...cleanEnv,
    PATH: `${homedir()}\\.local\\bin;${cleanEnv.PATH || ""}`,
  };
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

      // Use sonnet by default — much faster than opus for most coding tasks
      const claudeModel = model === "opus" ? "claude-opus-4-6" : "claude-sonnet-4-6";

      const designSystem = `You are a senior frontend developer. Follow these rules:
- Use Tailwind CSS v4 syntax (@import "tailwindcss", @theme block, no @apply)
- Dark mode: zinc-950 background, zinc-900 cards, zinc-800 borders
- Gradients: from-violet-500 to-indigo-500 for accents
- Typography: text-5xl+ for heroes, tracking-tight on headings
- Cards: rounded-2xl, border border-zinc-800, backdrop-blur
- Animations: hover:scale-105 transition-transform
- NEVER use placeholder text like "Project Title 1"
- NEVER use single quotes for strings with apostrophes
- Make sure code compiles without errors`;

      const args = [
        "-p",
        "--output-format", "json",
        "--dangerously-skip-permissions",
        "--model", claudeModel,
        "--append-system-prompt", designSystem + (appendPrompt ? "\n\n" + appendPrompt : ""),
      ];

      return new Promise<Record<string, unknown>>((resolvePromise) => {
        let stdout = "";
        let stderr = "";
        let killed = false;

        // Pipe task via stdin to avoid shell quoting issues with special characters
        const proc = spawn("claude", args, {
          cwd: workDir,
          shell: true,
          stdio: ["pipe", "pipe", "pipe"],
          env: buildCleanEnv(),
        });

        // Write task to stdin and close it
        proc.stdin.write(task);
        proc.stdin.end();

        // 10 min timeout — complex tasks need time
        const timeout = setTimeout(() => {
          killed = true;
          proc.kill("SIGTERM");
          setTimeout(() => { try { proc.kill("SIGKILL"); } catch {} }, 5000);
        }, 600_000);

        proc.stdout.on("data", (d) => { stdout += d.toString(); });
        proc.stderr.on("data", (d) => { stderr += d.toString(); });

        proc.on("close", (code) => {
          clearTimeout(timeout);

          if (killed) {
            resolvePromise({
              message: "Claude Code timed out (5min). Try a smaller task.",
              timedOut: true,
              partialOutput: stdout.slice(-1000),
            });
            return;
          }

          // Parse JSON output
          try {
            const result = JSON.parse(stdout) as {
              type?: string;
              subtype?: string;
              result?: string;
              is_error?: boolean;
              total_cost_usd?: number;
              duration_ms?: number;
              num_turns?: number;
              session_id?: string;
              errors?: string[];
            };

            if (result.is_error || result.subtype?.startsWith("error")) {
              resolvePromise({
                message: `Claude Code error: ${result.subtype || "unknown"}`,
                error: result.result || result.errors?.join(", ") || "Unknown error",
                suggestion: "Try a simpler or more specific task. Check that the working directory exists and has the right files.",
              });
            } else {
              resolvePromise({
                message: `Claude Code completed (${result.num_turns || "?"} turns, ${result.duration_ms ? Math.round(result.duration_ms / 1000) + "s" : "?"})`,
                result: result.result?.slice(0, 3000) || "Done",
                turns: result.num_turns,
                duration: result.duration_ms ? `${Math.round(result.duration_ms / 1000)}s` : undefined,
                sessionId: result.session_id,
              });
            }
          } catch {
            // Raw text output
            if (code === 0 && stdout.trim()) {
              resolvePromise({
                message: "Claude Code completed",
                result: stdout.slice(-3000),
              });
            } else {
              resolvePromise({
                message: `Claude Code exited (code ${code})`,
                error: stderr.slice(-500) || stdout.slice(-500) || "No output",
                suggestion: "Check stderr output above. Common issues: claude CLI not logged in, or task too vague.",
              });
            }
          }
        });

        proc.on("error", (err) => {
          clearTimeout(timeout);
          resolvePromise({
            message: `Cannot find claude CLI: ${err.message}`,
            suggestion: "Install Claude Code: https://docs.anthropic.com/en/docs/claude-code",
          });
        });
      });
    },
  }),

  spawn_codex: tool({
    description: "Spawn OpenAI Codex CLI for coding tasks. Alternative to Claude Code. Requires: npm i -g @openai/codex and OPENAI_API_KEY.",
    inputSchema: z.object({
      task: z.string().describe("Task for Codex"),
      cwd: z.string().optional().describe("Working directory"),
    }),
    execute: async ({ task, cwd }) => {
      const workDir = cwd ? resolve(getWorkspaceRoot(), cwd) : getWorkspaceRoot();
      if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });

      return new Promise<Record<string, unknown>>((resolvePromise) => {
        let stdout = "";
        let stderr = "";

        const proc = spawn("codex", ["--quiet", "--full-auto", task], {
          cwd: workDir, shell: true,
          stdio: ["ignore", "pipe", "pipe"],
        });

        const timeout = setTimeout(() => { proc.kill(); resolvePromise({ message: "Codex timed out" }); }, 300_000);
        proc.stdout.on("data", (d) => { stdout += d.toString(); });
        proc.stderr.on("data", (d) => { stderr += d.toString(); });
        proc.on("close", (code) => {
          clearTimeout(timeout);
          resolvePromise({
            message: code === 0 ? "Codex completed" : `Codex exited (code ${code})`,
            result: stdout.slice(-3000) || "No output",
            error: code !== 0 ? stderr.slice(-500) : undefined,
          });
        });
        proc.on("error", (err) => { clearTimeout(timeout); resolvePromise({ message: `Codex not found: ${err.message}` }); });
      });
    },
  }),
};
