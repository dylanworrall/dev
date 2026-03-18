import { NextResponse } from "next/server";
import { listWatchers, updateWatcher, addEvent } from "@/lib/stores/watchers";
import { loadDevEnv } from "@/lib/env";

export async function POST() {
  loadDevEnv();
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "GITHUB_TOKEN not configured", checked: 0 });
  }

  const watchers = await listWatchers();
  const active = watchers.filter((w) => w.enabled);
  let newEvents = 0;

  for (const watcher of active) {
    const since = watcher.lastCheckedAt || new Date(Date.now() - 3600_000).toISOString(); // default: last hour
    const [owner, repo] = watcher.repoFullName.split("/");
    if (!owner || !repo) continue;

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    };

    try {
      // Check for new issues
      if (watcher.watchIssues) {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/issues?since=${since}&state=all&per_page=10&sort=created&direction=desc`,
          { headers }
        );
        if (res.ok) {
          const issues = await res.json() as Array<{ number: number; title: string; html_url: string; state: string; created_at: string; pull_request?: unknown }>;
          for (const issue of issues) {
            if (issue.pull_request) continue; // skip PRs in issues endpoint
            if (new Date(issue.created_at) > new Date(since)) {
              await addEvent({
                watcherId: watcher.id,
                type: issue.state === "closed" ? "issue_closed" : "new_issue",
                title: `#${issue.number}: ${issue.title}`,
                description: `${issue.state === "closed" ? "Closed" : "New"} issue in ${watcher.repoFullName}`,
                url: issue.html_url,
                repo: watcher.repoFullName,
                timestamp: issue.created_at,
              });
              newEvents++;
            }
          }
        }
      }

      // Check for new commits
      if (watcher.watchCommits) {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/commits?since=${since}&per_page=10`,
          { headers }
        );
        if (res.ok) {
          const commits = await res.json() as Array<{ sha: string; commit: { message: string; author: { date: string } }; html_url: string }>;
          for (const commit of commits) {
            if (new Date(commit.commit.author.date) > new Date(since)) {
              await addEvent({
                watcherId: watcher.id,
                type: "new_commit",
                title: commit.commit.message.split("\n")[0].slice(0, 80),
                description: `New commit ${commit.sha.slice(0, 7)} in ${watcher.repoFullName}`,
                url: commit.html_url,
                repo: watcher.repoFullName,
                timestamp: commit.commit.author.date,
              });
              newEvents++;
            }
          }
        }
      }

      // Check for new PRs
      if (watcher.watchPRs) {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&sort=created&direction=desc&per_page=10`,
          { headers }
        );
        if (res.ok) {
          const prs = await res.json() as Array<{ number: number; title: string; html_url: string; created_at: string; merged_at: string | null; state: string }>;
          for (const pr of prs) {
            if (new Date(pr.created_at) > new Date(since)) {
              await addEvent({
                watcherId: watcher.id,
                type: pr.merged_at ? "pr_merged" : "new_pr",
                title: `PR #${pr.number}: ${pr.title}`,
                description: `${pr.merged_at ? "Merged" : "New"} PR in ${watcher.repoFullName}`,
                url: pr.html_url,
                repo: watcher.repoFullName,
                timestamp: pr.created_at,
              });
              newEvents++;
            }
          }
        }
      }

      // Check for new branches
      if (watcher.watchBranches) {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/branches?per_page=50`,
          { headers }
        );
        if (res.ok) {
          // We can't easily detect "new" branches without storing the previous list
          // For now, we skip this — would need to store branch list in watcher state
        }
      }

      // Update last checked timestamp
      await updateWatcher(watcher.id, { lastCheckedAt: new Date().toISOString() });
    } catch {
      // Skip failed watchers
    }
  }

  return NextResponse.json({ checked: active.length, newEvents });
}
