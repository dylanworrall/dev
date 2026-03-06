import { tool } from "ai";
import { z } from "zod";
import { createIssue, listIssues, getIssueById, updateIssue, addComment } from "@/lib/stores/issues";
import { addActivity } from "@/lib/stores/activity";

export const issueTools = {
  list_issues: tool({
    description: "List issues, optionally filtered by status, repo, or project.",
    inputSchema: z.object({
      status: z.enum(["open", "in-progress", "closed"]).optional().describe("Filter by status"),
      repoId: z.string().optional().describe("Filter by repo ID"),
      projectId: z.string().optional().describe("Filter by project ID"),
    }),
    execute: async (filter) => {
      const issues = await listIssues(filter);
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
    description: "Get full details of a specific issue including comments.",
    inputSchema: z.object({
      issueId: z.string().describe("The issue ID"),
    }),
    execute: async ({ issueId }) => {
      const issue = await getIssueById(issueId);
      if (!issue) return { message: "Issue not found", issue: null };
      return { message: `Issue: ${issue.title}`, issue };
    },
  }),

  create_issue: tool({
    description: "Create a new issue/ticket.",
    inputSchema: z.object({
      title: z.string().describe("Issue title"),
      description: z.string().optional().describe("Issue description"),
      priority: z.enum(["low", "medium", "high", "critical"]).optional().describe("Priority level"),
      labels: z.array(z.string()).optional().describe("Labels/tags"),
      assignee: z.string().optional().describe("Assignee name"),
      repoId: z.string().optional().describe("Associated repo ID"),
      projectId: z.string().optional().describe("Associated project ID"),
    }),
    execute: async (data) => {
      const issue = await createIssue(data);
      await addActivity("project_created", `Created issue "${issue.title}"`);
      return { message: `Created issue "${issue.title}"`, issue };
    },
  }),

  update_issue: tool({
    description: "Update an existing issue (status, priority, labels, assignee, description).",
    inputSchema: z.object({
      issueId: z.string().describe("The issue ID"),
      status: z.enum(["open", "in-progress", "closed"]).optional(),
      priority: z.enum(["low", "medium", "high", "critical"]).optional(),
      labels: z.array(z.string()).optional(),
      assignee: z.string().optional(),
      description: z.string().optional(),
      title: z.string().optional(),
    }),
    execute: async ({ issueId, ...updates }) => {
      const issue = await updateIssue(issueId, updates);
      if (!issue) return { message: "Issue not found" };
      return { message: `Updated issue "${issue.title}"`, issue };
    },
  }),

  add_comment: tool({
    description: "Add a comment to an issue.",
    inputSchema: z.object({
      issueId: z.string().describe("The issue ID"),
      author: z.string().describe("Comment author"),
      body: z.string().describe("Comment body"),
    }),
    execute: async ({ issueId, author, body }) => {
      const comment = await addComment(issueId, author, body);
      if (!comment) return { message: "Issue not found" };
      return { message: "Comment added", comment };
    },
  }),

  close_issue: tool({
    description: "Close an issue.",
    inputSchema: z.object({
      issueId: z.string().describe("The issue ID"),
    }),
    execute: async ({ issueId }) => {
      const issue = await updateIssue(issueId, { status: "closed" });
      if (!issue) return { message: "Issue not found" };
      await addActivity("project_created", `Closed issue "${issue.title}"`);
      return { message: `Closed issue "${issue.title}"` };
    },
  }),
};
