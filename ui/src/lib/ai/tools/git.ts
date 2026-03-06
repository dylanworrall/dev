import { tool } from "ai";
import { z } from "zod";

export const gitTools = {
  get_diff: tool({
    description: "Get the diff between two branches or commits.",
    inputSchema: z.object({
      repoName: z.string().describe("Repository name"),
      base: z.string().describe("Base branch or commit"),
      head: z.string().describe("Head branch or commit"),
    }),
    execute: async ({ repoName, base, head }) => {
      return {
        message: `Diff: ${base}...${head} in ${repoName}`,
        note: "Git diff requires direct Git integration.",
        repoName,
        base,
        head,
      };
    },
  }),

  get_pr: tool({
    description: "Get details of a pull request.",
    inputSchema: z.object({
      repoName: z.string().describe("Repository name"),
      prNumber: z.number().describe("Pull request number"),
    }),
    execute: async ({ repoName, prNumber }) => {
      return {
        message: `PR #${prNumber} in ${repoName}`,
        note: "PR details require GitHub/GitLab integration.",
        repoName,
        prNumber,
      };
    },
  }),

  list_prs: tool({
    description: "List pull requests for a repository.",
    inputSchema: z.object({
      repoName: z.string().describe("Repository name"),
      state: z.enum(["open", "closed", "merged"]).optional().describe("PR state filter"),
    }),
    execute: async ({ repoName, state }) => {
      return {
        message: `PRs for ${repoName}`,
        note: "PR listing requires GitHub/GitLab integration.",
        repoName,
        state: state || "open",
      };
    },
  }),

  create_pr: tool({
    description: "Create a new pull request.",
    inputSchema: z.object({
      repoName: z.string().describe("Repository name"),
      title: z.string().describe("PR title"),
      body: z.string().optional().describe("PR description"),
      head: z.string().describe("Source branch"),
      base: z.string().describe("Target branch"),
    }),
    execute: async ({ repoName, title, body, head, base }) => {
      return {
        message: `PR created: ${title}`,
        note: "PR creation requires GitHub/GitLab integration.",
        repoName,
        title,
        body,
        head,
        base,
      };
    },
  }),
};
