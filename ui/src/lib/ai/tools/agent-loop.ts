import { tool } from "ai";
import { z } from "zod";
import { executeShell } from "@/lib/executor";
import { getWorkspaceRoot, isGitRepo } from "@/lib/workspace";

export const agentLoopTools = {
  ask_user: tool({
    description: "Ask the user one or more questions with multiple choice options. All questions are shown at once as a form — the user picks answers then clicks 'Continue'. Use this instead of writing questions as plain text. IMPORTANT: Ask ALL your questions in a SINGLE call. Do NOT call ask_user multiple times — put all questions in the 'questions' array.",
    inputSchema: z.object({
      questions: z.array(z.object({
        id: z.string().describe("Unique ID for this question (e.g., 'framework', 'storage')"),
        question: z.string().describe("The question to display"),
        options: z.array(z.object({
          label: z.string().describe("Short option label"),
          description: z.string().optional().describe("Optional description"),
        })).describe("2-6 options"),
      })).describe("All questions to ask — they are shown together as a form"),
    }),
    execute: async ({ questions }) => {
      return {
        message: `${questions.length} question(s) for you — pick your answers and click Continue.`,
        type: "user_choice",
        questions,
        awaitingInput: true,
      };
    },
  }),

  plan: tool({
    description: "Create a structured plan for a complex task. Do NOT include questions here — use ask_user separately for that.",
    inputSchema: z.object({
      goal: z.string().describe("The overall goal to achieve"),
      steps: z.array(z.object({
        id: z.number().describe("Step number"),
        description: z.string().describe("What this step does"),
        toolsNeeded: z.array(z.string()).optional().describe("Tools needed for this step"),
      })).describe("Ordered list of steps"),
      context: z.string().optional().describe("Additional context about the task"),
    }),
    execute: async ({ goal, steps, context }) => {
      return {
        message: `Plan created: ${goal}`,
        plan: {
          goal,
          context,
          steps: steps.map((s) => ({ ...s, status: "pending" as const })),
          createdAt: new Date().toISOString(),
        },
      };
    },
  }),

  update_plan: tool({
    description: "Update the status of a plan step.",
    inputSchema: z.object({
      stepId: z.number().describe("Step ID to update"),
      status: z.enum(["in-progress", "completed", "failed", "skipped"]).describe("New status"),
      notes: z.string().optional().describe("Notes about the step result"),
    }),
    execute: async ({ stepId, status, notes }) => {
      return {
        message: `Step ${stepId}: ${status}${notes ? ` — ${notes}` : ""}`,
        stepId,
        status,
        notes,
      };
    },
  }),

  verify: tool({
    description: "Run verification checks on the workspace: type checking, linting, tests, or build.",
    inputSchema: z.object({
      checks: z.array(z.enum(["typecheck", "lint", "test", "build"])).describe("Which checks to run"),
      path: z.string().optional().describe("Subdirectory to run checks in (relative to workspace)"),
    }),
    execute: async ({ checks, path }) => {
      const cwd = path ? `${getWorkspaceRoot()}/${path}` : getWorkspaceRoot();
      const results: Record<string, { passed: boolean; output: string }> = {};

      for (const check of checks) {
        let cmd: string;
        switch (check) {
          case "typecheck":
            cmd = "npx tsc --noEmit 2>&1";
            break;
          case "lint":
            cmd = "npx eslint . --max-warnings 0 2>&1 || npx biome check . 2>&1";
            break;
          case "test":
            cmd = "npx vitest run 2>&1 || npx jest --passWithNoTests 2>&1 || npm test 2>&1";
            break;
          case "build":
            cmd = "npm run build 2>&1";
            break;
        }

        const result = await executeShell(cmd, { cwd, timeout: 120_000 });
        results[check] = {
          passed: result.exitCode === 0,
          output: (result.stdout + "\n" + result.stderr).trim().slice(-3000),
        };
      }

      const allPassed = Object.values(results).every((r) => r.passed);
      return {
        message: allPassed ? "All checks passed" : "Some checks failed",
        allPassed,
        results,
      };
    },
  }),

  reflect: tool({
    description: "Pause and reflect on progress. Summarize what's been done and what's left.",
    inputSchema: z.object({
      done: z.array(z.string()).describe("What has been completed"),
      remaining: z.array(z.string()).describe("What still needs to be done"),
      blockers: z.array(z.string()).optional().describe("Any blockers or issues"),
      decision: z.string().optional().describe("Decision or course correction needed"),
    }),
    execute: async ({ done, remaining, blockers, decision }) => {
      return {
        message: `Progress: ${done.length} done, ${remaining.length} remaining${blockers?.length ? `, ${blockers.length} blocker(s)` : ""}`,
        done,
        remaining,
        blockers: blockers || [],
        decision,
      };
    },
  }),

  mark_complete: tool({
    description: "Signal that the current task is done. Include a summary of what was accomplished.",
    inputSchema: z.object({
      summary: z.string().describe("Summary of what was accomplished"),
      filesChanged: z.array(z.string()).optional().describe("List of files that were changed"),
      nextSteps: z.array(z.string()).optional().describe("Suggested follow-up actions"),
    }),
    execute: async ({ summary, filesChanged, nextSteps }) => {
      return {
        message: `Task complete: ${summary}`,
        summary,
        filesChanged: filesChanged || [],
        nextSteps: nextSteps || [],
        completedAt: new Date().toISOString(),
      };
    },
  }),
};
