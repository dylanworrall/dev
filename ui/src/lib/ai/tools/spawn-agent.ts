import { tool } from "ai";
import { z } from "zod";
import { spawn } from "node:child_process";
import { getWorkspaceRoot } from "@/lib/workspace";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";

// ── Session persistence ──
const SESSION_FILE = join(homedir(), ".dev-client", "data", "claude-sessions.json");

interface SessionStore {
  [projectKey: string]: {
    sessionId: string;
    createdAt: string;
    lastUsedAt: string;
  };
}

function loadSessions(): SessionStore {
  try { return JSON.parse(readFileSync(SESSION_FILE, "utf-8")); }
  catch { return {}; }
}

function saveSession(key: string, sessionId: string): void {
  const sessions = loadSessions();
  sessions[key] = {
    sessionId,
    createdAt: sessions[key]?.createdAt || new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
  };
  const dir = join(SESSION_FILE, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2));
}

function getSession(key: string): string | undefined {
  return loadSessions()[key]?.sessionId;
}

// ── Build clean env (strip CLAUDECODE to prevent nesting detection) ──
function buildCleanEnv(): NodeJS.ProcessEnv {
  const { CLAUDECODE: _, ...cleanEnv } = process.env;
  return {
    ...cleanEnv,
    PATH: `${homedir()}\\.local\\bin;${cleanEnv.PATH || ""}`,
  };
}

// ── Spawn Claude Code ──

export const spawnAgentTools = {
  spawn_claude: tool({
    description: "Spawn Claude Code to do coding work. It has full filesystem + terminal access. Supports session resuming — Claude Code remembers previous work on the same project. Use this for ALL coding: writing files, building components, fixing bugs, installing packages. Give it clear, specific tasks.",
    inputSchema: z.object({
      task: z.string().describe("Clear task for Claude Code. Be specific: what to build, which files, what it should look like. Include any reference URLs or design requirements."),
      cwd: z.string().optional().describe("Working directory (relative to workspace root)"),
      sessionKey: z.string().optional().describe("Project key for session resuming (e.g., 'soshi-website'). Reuses previous Claude Code session so it remembers context."),
      systemPrompt: z.string().optional().describe("Extra instructions to append to Claude Code's system prompt"),
    }),
    execute: async ({ task, cwd, sessionKey, systemPrompt }) => {
      const workDir = cwd ? resolve(getWorkspaceRoot(), cwd) : getWorkspaceRoot();
      if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });

      // Check for existing session to resume
      const existingSessionId = sessionKey ? getSession(sessionKey) : undefined;
      const isResume = !!existingSessionId;

      // Build args — following ClaudeClaw/OpenClaw patterns
      const args: string[] = [
        "-p", task,
        "--output-format", isResume ? "text" : "json",
        "--dangerously-skip-permissions",
      ];

      // Resume existing session if available
      if (isResume && existingSessionId) {
        args.push("--resume", existingSessionId);
      }

      // Append system prompt for context
      if (systemPrompt) {
        args.push("--append-system-prompt", systemPrompt);
      }

      return new Promise<Record<string, unknown>>((resolvePromise) => {
        let stdout = "";
        let stderr = "";

        const proc = spawn("claude", args, {
          cwd: workDir,
          shell: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: buildCleanEnv(),
        });

        const timeout = setTimeout(() => {
          proc.kill("SIGTERM");
          setTimeout(() => proc.kill("SIGKILL"), 5000);
          resolvePromise({
            message: "Claude Code timed out after 5 minutes. It may still be working — try resuming with the same sessionKey.",
            timedOut: true,
            partialOutput: stdout.slice(-2000),
          });
        }, 300_000);

        proc.stdout.on("data", (data) => { stdout += data.toString(); });
        proc.stderr.on("data", (data) => { stderr += data.toString(); });

        proc.on("close", (code) => {
          clearTimeout(timeout);

          if (isResume) {
            // Resumed session returns text, not JSON
            resolvePromise({
              message: `Claude Code completed (resumed session)`,
              result: stdout.slice(-3000) || "No output",
              resumed: true,
              exitCode: code,
            });
            return;
          }

          // New session returns JSON
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

            // Save session ID for future resume
            if (result.session_id && sessionKey) {
              saveSession(sessionKey, result.session_id);
            }

            if (result.is_error || result.subtype?.startsWith("error")) {
              resolvePromise({
                message: `Claude Code error: ${result.result || result.subtype || "unknown"}`,
                error: result.result || result.errors?.join(", "),
                sessionId: result.session_id,
                suggestion: "Try breaking the task into smaller pieces, or check if the working directory is correct.",
              });
            } else {
              resolvePromise({
                message: `Claude Code completed (${result.num_turns || "?"} turns, ${result.duration_ms ? Math.round(result.duration_ms / 1000) + "s" : "?"})`,
                result: result.result?.slice(0, 3000) || "No output",
                turns: result.num_turns,
                duration: result.duration_ms ? `${Math.round(result.duration_ms / 1000)}s` : undefined,
                sessionId: result.session_id,
                exitCode: code,
              });
            }
          } catch {
            // Not JSON — return raw output
            resolvePromise({
              message: code === 0 ? "Claude Code completed" : `Claude Code exited (code ${code})`,
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
            suggestion: "Check that 'claude' CLI is installed and in PATH.",
          });
        });
      });
    },
  }),

  spawn_codex: tool({
    description: "Spawn OpenAI Codex CLI for coding tasks. Alternative to Claude Code. Requires 'codex' CLI installed (npm i -g @openai/codex) and OPENAI_API_KEY set.",
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

        const proc = spawn("codex", ["--quiet", "--full-auto", task], {
          cwd: workDir,
          shell: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: buildCleanEnv(),
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
            message: code === 0 ? "Codex completed" : `Codex exited (code ${code})`,
            result: stdout.slice(-3000) || "No output",
            error: code !== 0 ? stderr.slice(-500) : undefined,
            exitCode: code,
          });
        });

        proc.on("error", (err) => {
          clearTimeout(timeout);
          resolvePromise({
            message: `Codex not found: ${err.message}. Install: npm i -g @openai/codex`,
            error: err.message,
          });
        });
      });
    },
  }),
};
