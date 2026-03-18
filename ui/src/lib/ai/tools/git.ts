import { tool } from "ai";
import { z } from "zod";
import * as github from "@/lib/github";

export const gitTools = {
  get_diff: tool({
    description: "Get the diff between two branches or commits in a GitHub repository.",
    inputSchema: z.object({
      repoName: z.string().describe("Repository name (owner/repo format)"),
      base: z.string().describe("Base branch or commit SHA"),
      head: z.string().describe("Head branch or commit SHA"),
    }),
    execute: async ({ repoName, base, head }) => {
      try {
        const { owner, repo } = github.parseRepoName(repoName);
        const comparison = await github.repos.compareCommits(owner, repo, base, head);

        const files = comparison.files.map((f) => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          // Truncate large patches
          patch: f.patch ? (f.patch.length > 3000 ? f.patch.slice(0, 3000) + "\n... (truncated)" : f.patch) : null,
        }));

        return {
          message: `${base}...${head}: ${comparison.total_commits} commit(s), ${comparison.files.length} file(s) changed`,
          status: comparison.status,
          aheadBy: comparison.ahead_by,
          behindBy: comparison.behind_by,
          totalCommits: comparison.total_commits,
          files,
          commits: comparison.commits.slice(0, 10).map((c) => ({
            sha: c.sha.slice(0, 7),
            message: c.commit.message.split("\n")[0],
            author: c.commit.author.name,
            date: c.commit.author.date,
          })),
        };
      } catch (e: unknown) {
        return { message: `Failed to get diff: ${(e as Error).message}` };
      }
    },
  }),

  get_pr: tool({
    description: "Get full details of a pull request from GitHub.",
    inputSchema: z.object({
      repoName: z.string().describe("Repository name (owner/repo format)"),
      prNumber: z.number().describe("Pull request number"),
    }),
    execute: async ({ repoName, prNumber }) => {
      try {
        const { owner, repo } = github.parseRepoName(repoName);
        const pr = await github.pulls.get(owner, repo, prNumber);
        const files = await github.pulls.listFiles(owner, repo, prNumber);

        return {
          message: `PR #${prNumber}: ${pr.title}`,
          pr: {
            number: pr.number,
            title: pr.title,
            body: pr.body ? (pr.body.length > 2000 ? pr.body.slice(0, 2000) + "..." : pr.body) : null,
            state: pr.merged ? "merged" : pr.state,
            author: pr.user.login,
            head: pr.head.ref,
            base: pr.base.ref,
            labels: pr.labels.map((l) => l.name),
            reviewers: pr.requested_reviewers.map((r) => r.login),
            additions: pr.additions,
            deletions: pr.deletions,
            changedFiles: pr.changed_files,
            mergeable: pr.mergeable,
            createdAt: pr.created_at,
            updatedAt: pr.updated_at,
            mergedAt: pr.merged_at,
            url: pr.html_url,
          },
          files: files.slice(0, 30).map((f) => ({
            filename: f.filename,
            status: f.status,
            additions: f.additions,
            deletions: f.deletions,
          })),
        };
      } catch (e: unknown) {
        return { message: `Failed to get PR: ${(e as Error).message}` };
      }
    },
  }),

  list_prs: tool({
    description: "List pull requests for a GitHub repository.",
    inputSchema: z.object({
      repoName: z.string().describe("Repository name (owner/repo format)"),
      state: z.enum(["open", "closed", "merged", "all"]).optional().describe("PR state filter (default: open)"),
    }),
    execute: async ({ repoName, state }) => {
      try {
        const { owner, repo } = github.parseRepoName(repoName);
        // GitHub API uses "closed" for both closed and merged
        const apiState = state === "merged" ? "closed" : (state || "open") as "open" | "closed" | "all";
        let prs = await github.pulls.list(owner, repo, apiState);

        // Filter to only merged if requested
        if (state === "merged") {
          prs = prs.filter((pr) => pr.merged);
        }

        return {
          message: `${prs.length} PR(s) for ${owner}/${repo}`,
          pullRequests: prs.map((pr) => ({
            number: pr.number,
            title: pr.title,
            state: pr.merged ? "merged" : pr.state,
            author: pr.user.login,
            head: pr.head.ref,
            base: pr.base.ref,
            createdAt: pr.created_at,
            url: pr.html_url,
          })),
        };
      } catch (e: unknown) {
        return { message: `Failed to list PRs: ${(e as Error).message}` };
      }
    },
  }),

  create_pr: tool({
    description: "Create a new pull request on GitHub.",
    inputSchema: z.object({
      repoName: z.string().describe("Repository name (owner/repo format)"),
      title: z.string().describe("PR title"),
      body: z.string().optional().describe("PR description"),
      head: z.string().describe("Source branch"),
      base: z.string().describe("Target branch"),
    }),
    execute: async ({ repoName, title, body, head, base }) => {
      try {
        const { owner, repo } = github.parseRepoName(repoName);
        const pr = await github.pulls.create(owner, repo, { title, head, base, body });
        return {
          message: `Created PR #${pr.number}: ${pr.title}`,
          pr: {
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            head: pr.head.ref,
            base: pr.base.ref,
          },
        };
      } catch (e: unknown) {
        return { message: `Failed to create PR: ${(e as Error).message}` };
      }
    },
  }),

  review_pr: tool({
    description: "AI-powered code review of a pull request. Fetches the PR diff, analyzes it with Claude, and posts the review to GitHub.",
    inputSchema: z.object({
      repoName: z.string().describe("Repository name (owner/repo format)"),
      prNumber: z.number().describe("Pull request number"),
      reviewType: z.enum(["APPROVE", "COMMENT", "REQUEST_CHANGES"]).optional().describe("Review type (default: COMMENT)"),
      focusAreas: z.string().optional().describe("Specific areas to focus the review on (e.g., 'security, performance')"),
    }),
    execute: async ({ repoName, prNumber, reviewType, focusAreas }) => {
      try {
        const { owner, repo } = github.parseRepoName(repoName);
        const [pr, files] = await Promise.all([
          github.pulls.get(owner, repo, prNumber),
          github.pulls.listFiles(owner, repo, prNumber),
        ]);

        // Build diff summary for Claude
        const diffSummary = files.map((f) => {
          const patch = f.patch
            ? (f.patch.length > 2000 ? f.patch.slice(0, 2000) + "\n... (truncated)" : f.patch)
            : "(binary or empty)";
          return `### ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})\n\`\`\`diff\n${patch}\n\`\`\``;
        }).join("\n\n");

        // Use Gemini API for the review analysis
        const { loadDevEnv } = await import("@/lib/env");
        loadDevEnv();
        const googleKey = process.env.GOOGLE_API_KEY;
        if (!googleKey) throw new Error("GOOGLE_API_KEY required for AI review");

        const focusPrompt = focusAreas ? `\nFocus especially on: ${focusAreas}` : "";
        const reviewRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              contents: [{
                role: "user",
                parts: [{
                  text: `Review this pull request and provide actionable feedback.\n\n**PR #${prNumber}: ${pr.title}**\nBranch: ${pr.head.ref} → ${pr.base.ref}\nDescription: ${pr.body || "(none)"}\n\n**Changes (${files.length} files, +${pr.additions}/-${pr.deletions}):**\n\n${diffSummary}\n\nProvide a concise code review covering:\n1. Bugs or logic errors\n2. Security concerns\n3. Performance issues\n4. Code quality and maintainability\n5. Missing edge cases or error handling${focusPrompt}\n\nFormat as a clear, professional GitHub PR review. Be specific — reference file names and line numbers. If the code looks good, say so briefly.`,
                }],
              }],
              generationConfig: { maxOutputTokens: 4096 },
            }),
          }
        );

        if (!reviewRes.ok) throw new Error(`Gemini API error: ${reviewRes.status}`);
        const reviewData = await reviewRes.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
        const reviewBody = reviewData.candidates[0].content.parts[0].text;

        // Post the review to GitHub
        const event = reviewType || "COMMENT";
        const review = await github.pulls.createReview(owner, repo, prNumber, {
          body: reviewBody,
          event,
        });

        return {
          message: `Posted ${event} review on PR #${prNumber}`,
          review: {
            id: review.id,
            state: review.state,
            url: review.html_url,
            body: reviewBody,
          },
        };
      } catch (e: unknown) {
        return { message: `Failed to review PR: ${(e as Error).message}` };
      }
    },
  }),

  merge_pr: tool({
    description: "Merge a pull request on GitHub.",
    inputSchema: z.object({
      repoName: z.string().describe("Repository name (owner/repo format)"),
      prNumber: z.number().describe("Pull request number"),
      mergeMethod: z.enum(["merge", "squash", "rebase"]).optional().describe("Merge method (default: squash)"),
    }),
    execute: async ({ repoName, prNumber, mergeMethod }) => {
      try {
        const { owner, repo } = github.parseRepoName(repoName);
        const result = await github.pulls.merge(owner, repo, prNumber, mergeMethod || "squash");
        return {
          message: result.merged ? `Merged PR #${prNumber}` : `Failed to merge: ${result.message}`,
          merged: result.merged,
          sha: result.sha,
        };
      } catch (e: unknown) {
        return { message: `Failed to merge PR: ${(e as Error).message}` };
      }
    },
  }),
};
