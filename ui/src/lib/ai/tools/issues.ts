import { tool } from "ai";
import { z } from "zod";
import * as github from "@/lib/github";
import { createIssue, listIssues, getIssueById, updateIssue, addComment } from "@/lib/stores/issues";
import { addActivity } from "@/lib/stores/activity";

export const issueTools = {
  list_issues: tool({
    description: "List issues. If repoName is provided and GitHub is configured, lists GitHub issues. Otherwise lists local issues.",
    inputSchema: z.object({
      repoName: z.string().optional().describe("GitHub repo (owner/repo) to list issues from"),
      status: z.enum(["open", "in-progress", "closed"]).optional().describe("Filter by status"),
      labels: z.string().optional().describe("Comma-separated labels to filter by (GitHub only)"),
      repoId: z.string().optional().describe("Filter local issues by repo ID"),
      projectId: z.string().optional().describe("Filter local issues by project ID"),
    }),
    execute: async ({ repoName, status, labels, repoId, projectId }) => {
      // GitHub mode
      if (repoName && github.isGitHubConfigured()) {
        try {
          const { owner, repo } = github.parseRepoName(repoName);
          const ghState = status === "in-progress" ? "open" : (status || "open") as "open" | "closed" | "all";
          const ghIssues = await github.issues.list(owner, repo, ghState, labels);

          // Filter out PRs (GitHub returns PRs in issue endpoints)
          const issuesOnly = ghIssues.filter((i) => !i.pull_request);

          return {
            message: `${issuesOnly.length} issue(s) in ${owner}/${repo}`,
            issues: issuesOnly.map((i) => ({
              number: i.number,
              title: i.title,
              state: i.state,
              labels: i.labels.map((l) => l.name),
              assignees: i.assignees.map((a) => a.login),
              author: i.user.login,
              comments: i.comments,
              createdAt: i.created_at,
              url: i.html_url,
            })),
          };
        } catch (e: unknown) {
          return { message: `GitHub error: ${(e as Error).message}` };
        }
      }

      // Local mode
      const ghStatus = status === "in-progress" ? "in-progress" : status;
      const issues = await listIssues({ status: ghStatus, repoId, projectId });
      return {
        message: `${issues.length} issue(s)`,
        issues: issues.map((i) => ({
          id: i.id,
          title: i.title,
          status: i.status,
          priority: i.priority,
          labels: i.labels,
          assignee: i.assignee,
          commentCount: i.comments.length,
          createdAt: i.createdAt,
        })),
      };
    },
  }),

  get_issue: tool({
    description: "Get full details of an issue including comments.",
    inputSchema: z.object({
      repoName: z.string().optional().describe("GitHub repo (owner/repo) — required for GitHub issues"),
      issueNumber: z.number().optional().describe("GitHub issue number"),
      issueId: z.string().optional().describe("Local issue ID"),
    }),
    execute: async ({ repoName, issueNumber, issueId }) => {
      // GitHub mode
      if (repoName && issueNumber && github.isGitHubConfigured()) {
        try {
          const { owner, repo } = github.parseRepoName(repoName);
          const [issue, comments] = await Promise.all([
            github.issues.get(owner, repo, issueNumber),
            github.issues.listComments(owner, repo, issueNumber),
          ]);

          return {
            message: `Issue #${issue.number}: ${issue.title}`,
            issue: {
              number: issue.number,
              title: issue.title,
              body: issue.body,
              state: issue.state,
              labels: issue.labels.map((l) => l.name),
              assignees: issue.assignees.map((a) => a.login),
              author: issue.user.login,
              createdAt: issue.created_at,
              updatedAt: issue.updated_at,
              closedAt: issue.closed_at,
              url: issue.html_url,
              comments: comments.map((c) => ({
                author: c.user.login,
                body: c.body,
                createdAt: c.created_at,
              })),
            },
          };
        } catch (e: unknown) {
          return { message: `GitHub error: ${(e as Error).message}` };
        }
      }

      // Local mode
      if (!issueId) return { message: "Provide issueId for local issues or repoName + issueNumber for GitHub" };
      const issue = await getIssueById(issueId);
      if (!issue) return { message: "Issue not found", issue: null };
      return { message: `Issue: ${issue.title}`, issue };
    },
  }),

  create_issue: tool({
    description: "Create a new issue. If repoName is provided and GitHub is configured, creates on GitHub. Otherwise creates locally.",
    inputSchema: z.object({
      title: z.string().describe("Issue title"),
      description: z.string().optional().describe("Issue description / body"),
      repoName: z.string().optional().describe("GitHub repo (owner/repo) to create the issue in"),
      labels: z.array(z.string()).optional().describe("Labels/tags"),
      assignees: z.array(z.string()).optional().describe("Assignee usernames"),
      priority: z.enum(["low", "medium", "high", "critical"]).optional().describe("Priority level (local issues only)"),
      projectId: z.string().optional().describe("Associated project ID (local only)"),
    }),
    execute: async ({ title, description, repoName, labels, assignees, priority, projectId }) => {
      // GitHub mode
      if (repoName && github.isGitHubConfigured()) {
        try {
          const { owner, repo } = github.parseRepoName(repoName);
          const issue = await github.issues.create(owner, repo, {
            title,
            body: description,
            labels,
            assignees,
          });

          await addActivity("project_created", `Created GitHub issue #${issue.number}: "${issue.title}" in ${owner}/${repo}`);

          return {
            message: `Created issue #${issue.number}: ${issue.title}`,
            issue: {
              number: issue.number,
              title: issue.title,
              state: issue.state,
              url: issue.html_url,
              labels: issue.labels.map((l) => l.name),
            },
          };
        } catch (e: unknown) {
          return { message: `GitHub error: ${(e as Error).message}` };
        }
      }

      // Local mode
      const issue = await createIssue({
        title,
        description,
        priority,
        labels,
        assignee: assignees?.[0],
        projectId,
      });
      await addActivity("project_created", `Created issue "${issue.title}"`);
      return { message: `Created issue "${issue.title}"`, issue };
    },
  }),

  update_issue: tool({
    description: "Update an existing issue.",
    inputSchema: z.object({
      repoName: z.string().optional().describe("GitHub repo (owner/repo)"),
      issueNumber: z.number().optional().describe("GitHub issue number"),
      issueId: z.string().optional().describe("Local issue ID"),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(["open", "in-progress", "closed"]).optional(),
      labels: z.array(z.string()).optional(),
      assignees: z.array(z.string()).optional(),
      priority: z.enum(["low", "medium", "high", "critical"]).optional().describe("Priority (local only)"),
    }),
    execute: async ({ repoName, issueNumber, issueId, title, description, status, labels, assignees, priority }) => {
      // GitHub mode
      if (repoName && issueNumber && github.isGitHubConfigured()) {
        try {
          const { owner, repo } = github.parseRepoName(repoName);
          const updates: Parameters<typeof github.issues.update>[3] = {};
          if (title) updates.title = title;
          if (description) updates.body = description;
          if (status === "closed") updates.state = "closed";
          if (status === "open" || status === "in-progress") updates.state = "open";
          if (labels) updates.labels = labels;
          if (assignees) updates.assignees = assignees;

          const issue = await github.issues.update(owner, repo, issueNumber, updates);
          return {
            message: `Updated issue #${issue.number}: ${issue.title}`,
            issue: { number: issue.number, title: issue.title, state: issue.state, url: issue.html_url },
          };
        } catch (e: unknown) {
          return { message: `GitHub error: ${(e as Error).message}` };
        }
      }

      // Local mode
      if (!issueId) return { message: "Provide issueId for local issues or repoName + issueNumber for GitHub" };
      const issue = await updateIssue(issueId, { title, description, status, labels, assignee: assignees?.[0], priority });
      if (!issue) return { message: "Issue not found" };
      return { message: `Updated issue "${issue.title}"`, issue };
    },
  }),

  add_comment: tool({
    description: "Add a comment to an issue.",
    inputSchema: z.object({
      repoName: z.string().optional().describe("GitHub repo (owner/repo)"),
      issueNumber: z.number().optional().describe("GitHub issue number"),
      issueId: z.string().optional().describe("Local issue ID"),
      body: z.string().describe("Comment body"),
      author: z.string().optional().describe("Comment author (local issues only)"),
    }),
    execute: async ({ repoName, issueNumber, issueId, body, author }) => {
      // GitHub mode
      if (repoName && issueNumber && github.isGitHubConfigured()) {
        try {
          const { owner, repo } = github.parseRepoName(repoName);
          const comment = await github.issues.createComment(owner, repo, issueNumber, body);
          return {
            message: `Comment added to issue #${issueNumber}`,
            comment: { author: comment.user.login, body: comment.body, url: comment.html_url },
          };
        } catch (e: unknown) {
          return { message: `GitHub error: ${(e as Error).message}` };
        }
      }

      // Local mode
      if (!issueId) return { message: "Provide issueId for local issues or repoName + issueNumber for GitHub" };
      const comment = await addComment(issueId, author || "dev-client", body);
      if (!comment) return { message: "Issue not found" };
      return { message: "Comment added", comment };
    },
  }),

  close_issue: tool({
    description: "Close an issue.",
    inputSchema: z.object({
      repoName: z.string().optional().describe("GitHub repo (owner/repo)"),
      issueNumber: z.number().optional().describe("GitHub issue number"),
      issueId: z.string().optional().describe("Local issue ID"),
    }),
    execute: async ({ repoName, issueNumber, issueId }) => {
      // GitHub mode
      if (repoName && issueNumber && github.isGitHubConfigured()) {
        try {
          const { owner, repo } = github.parseRepoName(repoName);
          const issue = await github.issues.update(owner, repo, issueNumber, { state: "closed" });
          await addActivity("project_created", `Closed GitHub issue #${issue.number} in ${owner}/${repo}`);
          return { message: `Closed issue #${issue.number}: ${issue.title}`, url: issue.html_url };
        } catch (e: unknown) {
          return { message: `GitHub error: ${(e as Error).message}` };
        }
      }

      // Local mode
      if (!issueId) return { message: "Provide issueId for local issues or repoName + issueNumber for GitHub" };
      const issue = await updateIssue(issueId, { status: "closed" });
      if (!issue) return { message: "Issue not found" };
      await addActivity("project_created", `Closed issue "${issue.title}"`);
      return { message: `Closed issue "${issue.title}"` };
    },
  }),
};
