import { tool } from "ai";
import { z } from "zod";
import * as github from "@/lib/github";
import { addRepo, listRepos, getRepoByName } from "@/lib/stores/repos";
import { addActivity } from "@/lib/stores/activity";

export const repoTools = {
  list_repos: tool({
    description: "List tracked repositories. If GitHub is configured, can also fetch repos from GitHub.",
    inputSchema: z.object({
      language: z.string().optional().describe("Filter by programming language"),
      fromGitHub: z.boolean().optional().describe("Fetch fresh list from GitHub instead of local store"),
      owner: z.string().optional().describe("GitHub owner/org to list repos for (used with fromGitHub)"),
    }),
    execute: async ({ language, fromGitHub, owner }) => {
      if (fromGitHub && github.isGitHubConfigured()) {
        try {
          const ghOwner = owner || process.env.GITHUB_DEFAULT_OWNER;
          if (!ghOwner) return { message: "Provide an owner or set GITHUB_DEFAULT_OWNER" };

          let repos = await github.repos.list(ghOwner);
          if (language) repos = repos.filter((r) => r.language?.toLowerCase() === language.toLowerCase());

          return {
            message: `${repos.length} repo(s) from GitHub`,
            repos: repos.map((r) => ({
              name: r.name,
              fullName: r.full_name,
              url: r.html_url,
              language: r.language || "unknown",
              description: r.description || "",
              stars: r.stargazers_count,
              defaultBranch: r.default_branch,
              private: r.private,
              lastPush: r.pushed_at,
            })),
          };
        } catch (e: unknown) {
          return { message: `GitHub error: ${(e as Error).message}` };
        }
      }

      let repos = await listRepos();
      if (language) repos = repos.filter((r) => r.language.toLowerCase() === language.toLowerCase());
      return { message: `${repos.length} tracked repo(s)`, repos };
    },
  }),

  get_repo: tool({
    description: "Get details of a repository. Fetches from GitHub if configured, falls back to local store.",
    inputSchema: z.object({
      name: z.string().describe("Repo name (owner/repo format for GitHub, or local name)"),
    }),
    execute: async ({ name }) => {
      // Try GitHub first if configured
      if (github.isGitHubConfigured() && name.includes("/")) {
        try {
          const { owner, repo: repoName } = github.parseRepoName(name);
          const r = await github.repos.get(owner, repoName);
          return {
            message: `Repo: ${r.full_name}`,
            repo: {
              name: r.name,
              fullName: r.full_name,
              url: r.html_url,
              language: r.language || "unknown",
              description: r.description || "",
              stars: r.stargazers_count,
              defaultBranch: r.default_branch,
              private: r.private,
              topics: r.topics,
              lastPush: r.pushed_at,
              fork: r.fork,
            },
          };
        } catch {
          // Fall through to local store
        }
      }

      const repo = await getRepoByName(name);
      if (!repo) return { message: "Repo not found", repo: null };
      return { message: `Repo: ${repo.fullName}`, repo };
    },
  }),

  search_code: tool({
    description: "Search for code patterns across GitHub repositories.",
    inputSchema: z.object({
      query: z.string().describe("Search query (code pattern, function name, etc.)"),
      repoName: z.string().optional().describe("Repository name (owner/repo) to search in"),
    }),
    execute: async ({ query, repoName }) => {
      if (!github.isGitHubConfigured()) {
        return { message: "GitHub not configured. Set GITHUB_TOKEN to enable code search." };
      }
      try {
        let owner: string | undefined;
        let repo: string | undefined;
        if (repoName) {
          const parsed = github.parseRepoName(repoName);
          owner = parsed.owner;
          repo = parsed.repo;
        }
        const results = await github.repos.searchCode(query, owner, repo);

        return {
          message: `${results.total_count} result(s) for "${query}"`,
          totalCount: results.total_count,
          results: results.items.map((item) => ({
            file: item.path,
            repo: item.repository.full_name,
            url: item.html_url,
            matches: item.text_matches?.map((m) => m.fragment) || [],
          })),
        };
      } catch (e: unknown) {
        return { message: `Search failed: ${(e as Error).message}` };
      }
    },
  }),

  get_file_content: tool({
    description: "Get content of a file from a GitHub repository.",
    inputSchema: z.object({
      repoName: z.string().describe("Repository name (owner/repo format)"),
      path: z.string().describe("File path within the repo"),
      branch: z.string().optional().describe("Branch name (defaults to repo's default branch)"),
    }),
    execute: async ({ repoName, path, branch }) => {
      if (!github.isGitHubConfigured()) {
        return { message: "GitHub not configured. Set GITHUB_TOKEN to enable file access." };
      }
      try {
        const { owner, repo } = github.parseRepoName(repoName);
        const content = await github.repos.getContent(owner, repo, path, branch);

        if (content.type === "dir") {
          return { message: `${path} is a directory, not a file`, type: "dir" };
        }

        if (content.content && content.encoding === "base64") {
          const decoded = Buffer.from(content.content, "base64").toString("utf-8");
          // Truncate very large files
          const truncated = decoded.length > 50000
            ? decoded.slice(0, 50000) + "\n... (truncated, file is " + decoded.length + " chars)"
            : decoded;
          return {
            message: `File: ${path} (${content.size} bytes)`,
            path: content.path,
            content: truncated,
            size: content.size,
            url: content.html_url,
          };
        }

        return { message: `File: ${path} (binary or empty)`, path: content.path, size: content.size };
      } catch (e: unknown) {
        return { message: `Failed to get file: ${(e as Error).message}` };
      }
    },
  }),

  list_branches: tool({
    description: "List branches for a GitHub repository.",
    inputSchema: z.object({
      repoName: z.string().describe("Repository name (owner/repo format)"),
    }),
    execute: async ({ repoName }) => {
      if (!github.isGitHubConfigured()) {
        return { message: "GitHub not configured. Set GITHUB_TOKEN to enable branch listing." };
      }
      try {
        const { owner, repo } = github.parseRepoName(repoName);
        const branches = await github.repos.listBranches(owner, repo);
        return {
          message: `${branches.length} branch(es) for ${owner}/${repo}`,
          branches: branches.map((b) => ({
            name: b.name,
            sha: b.commit.sha.slice(0, 7),
            protected: b.protected,
          })),
        };
      } catch (e: unknown) {
        return { message: `Failed to list branches: ${(e as Error).message}` };
      }
    },
  }),

  list_commits: tool({
    description: "List recent commits for a GitHub repository.",
    inputSchema: z.object({
      repoName: z.string().describe("Repository name (owner/repo format)"),
      branch: z.string().optional().describe("Branch (defaults to default branch)"),
      limit: z.number().optional().describe("Number of commits to return (default 10)"),
    }),
    execute: async ({ repoName, branch, limit }) => {
      if (!github.isGitHubConfigured()) {
        return { message: "GitHub not configured. Set GITHUB_TOKEN to enable commit listing." };
      }
      try {
        const { owner, repo } = github.parseRepoName(repoName);
        const commits = await github.repos.listCommits(owner, repo, branch, limit || 10);
        return {
          message: `${commits.length} commit(s) for ${owner}/${repo}`,
          commits: commits.map((c) => ({
            sha: c.sha.slice(0, 7),
            message: c.commit.message.split("\n")[0],
            author: c.author?.login || c.commit.author.name,
            date: c.commit.author.date,
            url: c.html_url,
          })),
        };
      } catch (e: unknown) {
        return { message: `Failed to list commits: ${(e as Error).message}` };
      }
    },
  }),

  create_github_repo: tool({
    description: "Create a new repository on GitHub. Optionally connect it as a remote to the local workspace.",
    inputSchema: z.object({
      name: z.string().describe("Repository name"),
      description: z.string().optional().describe("Repository description"),
      isPrivate: z.boolean().optional().describe("Make repo private (default: false)"),
      org: z.string().optional().describe("Organization to create under (default: your personal account)"),
      connectLocal: z.boolean().optional().describe("Add as 'origin' remote to the current local git repo (default: true)"),
    }),
    execute: async ({ name, description, isPrivate, org, connectLocal }) => {
      if (!github.isGitHubConfigured()) {
        return { message: "GitHub not configured. Set GITHUB_TOKEN to create repos." };
      }
      try {
        const repoData = { name, description, private: isPrivate || false, auto_init: false };
        const ghRepo = org
          ? await github.repos.createInOrg(org, repoData)
          : await github.repos.create(repoData);

        // Connect as remote if requested
        if (connectLocal !== false) {
          const { execute } = await import("@/lib/executor");
          const { getWorkspaceRoot } = await import("@/lib/workspace");
          const cwd = getWorkspaceRoot();
          await execute("git", ["remote", "add", "origin", ghRepo.html_url + ".git"], { cwd });
        }

        await addActivity("project_created", `Created GitHub repo: ${ghRepo.full_name}`);

        return {
          message: `Created repo: ${ghRepo.full_name}`,
          repo: {
            name: ghRepo.name,
            fullName: ghRepo.full_name,
            url: ghRepo.html_url,
            cloneUrl: ghRepo.html_url + ".git",
            private: ghRepo.private,
          },
          connectedAsRemote: connectLocal !== false,
        };
      } catch (e: unknown) {
        return { message: `Failed to create repo: ${(e as Error).message}` };
      }
    },
  }),

  add_repo: tool({
    description: "Track a new repository. If GitHub is configured, validates the repo exists and fetches metadata.",
    inputSchema: z.object({
      repoName: z.string().describe("Repository name (owner/repo format for GitHub, or custom name)"),
      projectId: z.string().optional().describe("Associated project ID"),
    }),
    execute: async ({ repoName, projectId }) => {
      try {
        // If GitHub configured, fetch real data
        if (github.isGitHubConfigured() && repoName.includes("/")) {
          const { owner, repo: name } = github.parseRepoName(repoName);
          const ghRepo = await github.repos.get(owner, name);

          const repo = await addRepo({
            name: ghRepo.name,
            fullName: ghRepo.full_name,
            url: ghRepo.html_url,
            language: ghRepo.language || "unknown",
            description: ghRepo.description || "",
            stars: ghRepo.stargazers_count,
            lastPush: ghRepo.pushed_at,
            defaultBranch: ghRepo.default_branch,
            projectId,
          });

          await addActivity("project_created", `Tracked repo "${repo.fullName}" from GitHub`);
          return { message: `Tracked "${repo.fullName}" (${ghRepo.language}, ${ghRepo.stargazers_count} stars)`, repo };
        }

        // Fallback: manual entry
        const repo = await addRepo({
          name: repoName,
          fullName: repoName,
          url: "",
          language: "unknown",
          description: "",
          stars: 0,
          lastPush: new Date().toISOString(),
          defaultBranch: "main",
          projectId,
        });

        await addActivity("project_created", `Tracked repo "${repo.fullName}"`);
        return { message: `Tracked repo "${repo.fullName}"`, repo };
      } catch (e: unknown) {
        return { message: `Failed to add repo: ${(e as Error).message}` };
      }
    },
  }),
};
