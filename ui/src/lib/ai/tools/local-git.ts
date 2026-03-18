import { tool } from "ai";
import { z } from "zod";
import { execute } from "@/lib/executor";
import { getWorkspaceRoot, resolveSafePath } from "@/lib/workspace";

async function git(...args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return execute("git", args, { cwd: getWorkspaceRoot(), timeout: 30_000 });
}

async function gitIn(cwd: string, ...args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return execute("git", args, { cwd, timeout: 30_000 });
}

export const localGitTools = {
  git_init: tool({
    description: "Initialize a new git repository in a directory. Use this when starting a new project.",
    inputSchema: z.object({
      path: z.string().optional().describe("Directory path relative to workspace root (default: workspace root)"),
      initialCommit: z.boolean().optional().describe("Create an initial commit with all files (default: true)"),
    }),
    execute: async ({ path, initialCommit }) => {
      const cwd = path ? resolveSafePath(path) : getWorkspaceRoot();
      const result = await gitIn(cwd, "init");
      if (result.exitCode !== 0) return { message: `Git init failed: ${result.stderr}` };

      if (initialCommit !== false) {
        await gitIn(cwd, "add", "-A");
        const commitResult = await gitIn(cwd, "commit", "-m", "Initial commit — created by Dev Agent");
        return {
          message: `Git repo initialized${commitResult.exitCode === 0 ? " with initial commit" : ""}`,
          output: result.stdout,
        };
      }

      return { message: "Git repo initialized", output: result.stdout };
    },
  }),

  git_status: tool({
    description: "Show the working tree status (staged, modified, untracked files).",
    inputSchema: z.object({
      short: z.boolean().optional().describe("Use short format (default: false)"),
    }),
    execute: async ({ short }) => {
      const args = ["status"];
      if (short) args.push("-s");
      const result = await git(...args);
      return {
        message: result.exitCode === 0 ? "Git status" : `Git error: ${result.stderr}`,
        output: result.stdout || result.stderr,
      };
    },
  }),

  git_diff: tool({
    description: "Show changes in the working tree or between commits.",
    inputSchema: z.object({
      staged: z.boolean().optional().describe("Show staged changes (--cached)"),
      ref: z.string().optional().describe("Compare with a specific ref (branch, commit, HEAD~1, etc.)"),
      path: z.string().optional().describe("Limit diff to specific file/directory"),
      stat: z.boolean().optional().describe("Show diffstat only (--stat)"),
    }),
    execute: async ({ staged, ref, path, stat: statOnly }) => {
      const args = ["diff"];
      if (staged) args.push("--cached");
      if (statOnly) args.push("--stat");
      if (ref) args.push(ref);
      if (path) args.push("--", path);
      const result = await git(...args);

      // Truncate large diffs
      let output = result.stdout;
      if (output.length > 20_000) {
        output = output.slice(0, 20_000) + "\n... (diff truncated, use --stat for summary or narrow the path)";
      }

      return {
        message: result.exitCode === 0 ? "Git diff" : `Git error: ${result.stderr}`,
        output: output || "(no changes)",
      };
    },
  }),

  git_log: tool({
    description: "Show commit history.",
    inputSchema: z.object({
      limit: z.number().optional().describe("Number of commits (default: 10)"),
      oneline: z.boolean().optional().describe("One line per commit (default: true)"),
      branch: z.string().optional().describe("Branch to show log for"),
      path: z.string().optional().describe("Show commits affecting this path"),
    }),
    execute: async ({ limit, oneline, branch, path }) => {
      const args = ["log", `-${limit || 10}`];
      if (oneline !== false) args.push("--oneline", "--decorate");
      if (branch) args.push(branch);
      if (path) args.push("--", path);
      const result = await git(...args);
      return {
        message: result.exitCode === 0 ? "Git log" : `Git error: ${result.stderr}`,
        output: result.stdout || result.stderr,
      };
    },
  }),

  git_commit: tool({
    description: "Stage files and create a commit.",
    inputSchema: z.object({
      message: z.string().describe("Commit message"),
      files: z.array(z.string()).optional().describe("Files to stage (default: all modified)"),
      all: z.boolean().optional().describe("Stage all changes (-a)"),
    }),
    execute: async ({ message, files, all }) => {
      // Stage files
      if (files && files.length > 0) {
        const addResult = await git("add", ...files);
        if (addResult.exitCode !== 0) return { message: `Failed to stage: ${addResult.stderr}` };
      } else if (all) {
        const addResult = await git("add", "-A");
        if (addResult.exitCode !== 0) return { message: `Failed to stage: ${addResult.stderr}` };
      }

      // Commit
      const result = await git("commit", "-m", message);
      return {
        message: result.exitCode === 0 ? `Committed: ${message}` : `Commit failed: ${result.stderr}`,
        output: result.stdout || result.stderr,
      };
    },
  }),

  git_branch: tool({
    description: "List, create, or delete branches.",
    inputSchema: z.object({
      name: z.string().optional().describe("Branch name to create"),
      delete: z.boolean().optional().describe("Delete the branch"),
      list: z.boolean().optional().describe("List all branches (default if no name given)"),
    }),
    execute: async ({ name, delete: del, list }) => {
      if (name && del) {
        const result = await git("branch", "-d", name);
        return { message: result.exitCode === 0 ? `Deleted branch: ${name}` : result.stderr, output: result.stdout };
      }
      if (name) {
        const result = await git("branch", name);
        return { message: result.exitCode === 0 ? `Created branch: ${name}` : result.stderr, output: result.stdout };
      }
      const result = await git("branch", "-a");
      return { message: "Branches", output: result.stdout };
    },
  }),

  git_checkout: tool({
    description: "Switch branches or restore files.",
    inputSchema: z.object({
      target: z.string().describe("Branch name or file path to checkout"),
      createBranch: z.boolean().optional().describe("Create new branch (-b)"),
    }),
    execute: async ({ target, createBranch }) => {
      const args = ["checkout"];
      if (createBranch) args.push("-b");
      args.push(target);
      const result = await git(...args);
      return {
        message: result.exitCode === 0 ? `Checked out: ${target}` : `Checkout failed: ${result.stderr}`,
        output: result.stdout || result.stderr,
      };
    },
  }),

  git_push: tool({
    description: "Push commits to remote.",
    inputSchema: z.object({
      remote: z.string().optional().describe("Remote name (default: origin)"),
      branch: z.string().optional().describe("Branch to push"),
      setUpstream: z.boolean().optional().describe("Set upstream (-u)"),
    }),
    execute: async ({ remote, branch, setUpstream }) => {
      const args = ["push"];
      if (setUpstream) args.push("-u");
      args.push(remote || "origin");
      if (branch) args.push(branch);
      const result = await git(...args);
      return {
        message: result.exitCode === 0 ? "Pushed successfully" : `Push failed: ${result.stderr}`,
        output: result.stdout || result.stderr,
      };
    },
  }),

  git_pull: tool({
    description: "Pull changes from remote.",
    inputSchema: z.object({
      remote: z.string().optional().describe("Remote name (default: origin)"),
      branch: z.string().optional().describe("Branch to pull"),
      rebase: z.boolean().optional().describe("Rebase instead of merge"),
    }),
    execute: async ({ remote, branch, rebase }) => {
      const args = ["pull"];
      if (rebase) args.push("--rebase");
      if (remote) args.push(remote);
      if (branch) args.push(branch);
      const result = await git(...args);
      return {
        message: result.exitCode === 0 ? "Pulled successfully" : `Pull failed: ${result.stderr}`,
        output: result.stdout || result.stderr,
      };
    },
  }),

  git_stash: tool({
    description: "Stash or restore working directory changes.",
    inputSchema: z.object({
      action: z.enum(["push", "pop", "list", "drop"]).optional().describe("Stash action (default: push)"),
      message: z.string().optional().describe("Stash message (for push)"),
    }),
    execute: async ({ action, message }) => {
      const args = ["stash", action || "push"];
      if (action === "push" && message) args.push("-m", message);
      const result = await git(...args);
      return {
        message: result.exitCode === 0 ? `Stash ${action || "push"} done` : result.stderr,
        output: result.stdout || result.stderr,
      };
    },
  }),
};
