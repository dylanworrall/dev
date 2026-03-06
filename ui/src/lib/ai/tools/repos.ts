import { tool } from "ai";
import { z } from "zod";
import { addRepo, listRepos, getRepoById, getRepoByName } from "@/lib/stores/repos";
import { addActivity } from "@/lib/stores/activity";

export const repoTools = {
  list_repos: tool({
    description: "List all tracked repositories.",
    inputSchema: z.object({
      language: z.string().optional().describe("Filter by programming language"),
    }),
    execute: async ({ language }) => {
      let repos = await listRepos();
      if (language) repos = repos.filter((r) => r.language.toLowerCase() === language.toLowerCase());
      return { message: `${repos.length} repo(s)`, repos };
    },
  }),

  get_repo: tool({
    description: "Get details of a specific repository by ID or name.",
    inputSchema: z.object({
      id: z.string().optional().describe("Repo ID"),
      name: z.string().optional().describe("Repo name or full name (owner/repo)"),
    }),
    execute: async ({ id, name }) => {
      const repo = id ? await getRepoById(id) : name ? await getRepoByName(name) : undefined;
      if (!repo) return { message: "Repo not found", repo: null };
      return { message: `Repo: ${repo.fullName}`, repo };
    },
  }),

  search_code: tool({
    description: "Search for code patterns in a repository. Returns simulated results for tracked repos.",
    inputSchema: z.object({
      query: z.string().describe("Search query or pattern"),
      repoName: z.string().optional().describe("Repository name to search in"),
    }),
    execute: async ({ query, repoName }) => {
      return {
        message: `Searched for "${query}"${repoName ? ` in ${repoName}` : ""}`,
        note: "Code search requires Git integration. This is a placeholder for tracking search intent.",
        query,
        repoName,
      };
    },
  }),

  get_file_content: tool({
    description: "Get content of a file from a repository.",
    inputSchema: z.object({
      repoName: z.string().describe("Repository name"),
      path: z.string().describe("File path within the repo"),
      branch: z.string().optional().describe("Branch name (defaults to main)"),
    }),
    execute: async ({ repoName, path, branch }) => {
      return {
        message: `File: ${repoName}/${path}`,
        note: "File content retrieval requires Git integration.",
        repoName,
        path,
        branch: branch || "main",
      };
    },
  }),

  list_branches: tool({
    description: "List branches for a repository.",
    inputSchema: z.object({
      repoName: z.string().describe("Repository name"),
    }),
    execute: async ({ repoName }) => {
      return {
        message: `Branches for ${repoName}`,
        note: "Branch listing requires Git integration.",
        repoName,
      };
    },
  }),

  list_commits: tool({
    description: "List recent commits for a repository.",
    inputSchema: z.object({
      repoName: z.string().describe("Repository name"),
      branch: z.string().optional().describe("Branch (defaults to main)"),
      limit: z.number().optional().describe("Number of commits to return (default 10)"),
    }),
    execute: async ({ repoName, branch, limit }) => {
      return {
        message: `Commits for ${repoName}`,
        note: "Commit listing requires Git integration.",
        repoName,
        branch: branch || "main",
        limit: limit || 10,
      };
    },
  }),

  add_repo: tool({
    description: "Track a new repository in the system.",
    inputSchema: z.object({
      name: z.string().describe("Repo short name"),
      fullName: z.string().describe("Full name (owner/repo)"),
      url: z.string().url().describe("Repository URL"),
      language: z.string().describe("Primary language"),
      description: z.string().optional().describe("Description"),
      stars: z.number().optional().describe("Star count"),
      defaultBranch: z.string().optional().describe("Default branch name"),
      projectId: z.string().optional().describe("Associated project ID"),
    }),
    execute: async (data) => {
      const repo = await addRepo({
        name: data.name,
        fullName: data.fullName,
        url: data.url,
        language: data.language,
        description: data.description || "",
        stars: data.stars || 0,
        lastPush: new Date().toISOString(),
        defaultBranch: data.defaultBranch || "main",
        projectId: data.projectId,
      });
      await addActivity("project_created", `Tracked repo "${repo.fullName}"`);
      return { message: `Tracked repo "${repo.fullName}"`, repo };
    },
  }),
};
