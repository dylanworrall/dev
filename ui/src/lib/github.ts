import { loadDevEnv } from "./env";

const API_BASE = "https://api.github.com";

function getToken(): string {
  loadDevEnv();
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new GitHubAuthError("GITHUB_TOKEN not configured. Use the configure_integration tool to set it up.");
  return token;
}

function getDefaultOwner(): string | undefined {
  return process.env.GITHUB_DEFAULT_OWNER;
}

export class GitHubAuthError extends Error {
  constructor(message: string) { super(message); this.name = "GitHubAuthError"; }
}
export class GitHubNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "GitHubNotFoundError"; }
}
export class GitHubRateLimitError extends Error {
  constructor(message: string) { super(message); this.name = "GitHubRateLimitError"; }
}

async function ghFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new GitHubAuthError(`GitHub auth failed (${res.status}): ${await res.text()}`);
  }
  if (res.status === 404) {
    throw new GitHubNotFoundError(`Not found: ${path}`);
  }
  if (res.status === 429) {
    throw new GitHubRateLimitError("GitHub API rate limit exceeded. Try again later.");
  }
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  }

  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

export function parseRepoName(repoName: string): { owner: string; repo: string } {
  // Handle full URLs: https://github.com/owner/repo
  if (repoName.includes("github.com")) {
    const parts = repoName.replace(/\.git$/, "").split("github.com/")[1]?.split("/");
    if (parts && parts.length >= 2) return { owner: parts[0], repo: parts[1] };
  }
  // Handle owner/repo format
  if (repoName.includes("/")) {
    const [owner, repo] = repoName.split("/");
    return { owner, repo };
  }
  // Bare repo name — use default owner
  const defaultOwner = getDefaultOwner();
  if (!defaultOwner) {
    throw new Error(`Cannot resolve "${repoName}" — provide "owner/repo" format or set GITHUB_DEFAULT_OWNER.`);
  }
  return { owner: defaultOwner, repo: repoName };
}

// --- Repos ---

export const repos = {
  get: (owner: string, repo: string) =>
    ghFetch<GHRepo>(`/repos/${owner}/${repo}`),

  create: (data: { name: string; description?: string; private?: boolean; auto_init?: boolean }) =>
    ghFetch<GHRepo>(`/user/repos`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createInOrg: (org: string, data: { name: string; description?: string; private?: boolean; auto_init?: boolean }) =>
    ghFetch<GHRepo>(`/orgs/${org}/repos`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  list: (owner: string) =>
    ghFetch<GHRepo[]>(`/users/${owner}/repos?per_page=100&sort=updated`),

  getContent: (owner: string, repo: string, path: string, ref?: string) =>
    ghFetch<GHContent>(`/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ""}`),

  searchCode: (query: string, owner?: string, repo?: string) => {
    let q = query;
    if (owner && repo) q += `+repo:${owner}/${repo}`;
    else if (owner) q += `+user:${owner}`;
    return ghFetch<GHSearchResult>(`/search/code?q=${encodeURIComponent(q)}&per_page=20`);
  },

  listBranches: (owner: string, repo: string) =>
    ghFetch<GHBranch[]>(`/repos/${owner}/${repo}/branches?per_page=100`),

  listCommits: (owner: string, repo: string, sha?: string, perPage = 10) =>
    ghFetch<GHCommit[]>(`/repos/${owner}/${repo}/commits?per_page=${perPage}${sha ? `&sha=${sha}` : ""}`),

  compareCommits: (owner: string, repo: string, base: string, head: string) =>
    ghFetch<GHComparison>(`/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`),
};

// --- Pulls ---

export const pulls = {
  list: (owner: string, repo: string, state: "open" | "closed" | "all" = "open") =>
    ghFetch<GHPull[]>(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=30`),

  get: (owner: string, repo: string, number: number) =>
    ghFetch<GHPull>(`/repos/${owner}/${repo}/pulls/${number}`),

  create: (owner: string, repo: string, data: { title: string; head: string; base: string; body?: string }) =>
    ghFetch<GHPull>(`/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listFiles: (owner: string, repo: string, number: number) =>
    ghFetch<GHPullFile[]>(`/repos/${owner}/${repo}/pulls/${number}/files?per_page=100`),

  createReview: (owner: string, repo: string, number: number, data: { body: string; event: "APPROVE" | "COMMENT" | "REQUEST_CHANGES" }) =>
    ghFetch<GHReview>(`/repos/${owner}/${repo}/pulls/${number}/reviews`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  merge: (owner: string, repo: string, number: number, method: "merge" | "squash" | "rebase" = "squash") =>
    ghFetch<{ sha: string; merged: boolean; message: string }>(`/repos/${owner}/${repo}/pulls/${number}/merge`, {
      method: "PUT",
      body: JSON.stringify({ merge_method: method }),
    }),
};

// --- Issues ---

export const issues = {
  list: (owner: string, repo: string, state: "open" | "closed" | "all" = "open", labels?: string) =>
    ghFetch<GHIssue[]>(`/repos/${owner}/${repo}/issues?state=${state}&per_page=30${labels ? `&labels=${encodeURIComponent(labels)}` : ""}`),

  get: (owner: string, repo: string, number: number) =>
    ghFetch<GHIssue>(`/repos/${owner}/${repo}/issues/${number}`),

  create: (owner: string, repo: string, data: { title: string; body?: string; labels?: string[]; assignees?: string[] }) =>
    ghFetch<GHIssue>(`/repos/${owner}/${repo}/issues`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (owner: string, repo: string, number: number, data: { title?: string; body?: string; state?: "open" | "closed"; labels?: string[]; assignees?: string[] }) =>
    ghFetch<GHIssue>(`/repos/${owner}/${repo}/issues/${number}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  createComment: (owner: string, repo: string, number: number, body: string) =>
    ghFetch<GHIssueComment>(`/repos/${owner}/${repo}/issues/${number}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  listComments: (owner: string, repo: string, number: number) =>
    ghFetch<GHIssueComment[]>(`/repos/${owner}/${repo}/issues/${number}/comments?per_page=50`),
};

// --- Types ---

export interface GHRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  default_branch: string;
  pushed_at: string;
  private: boolean;
  fork: boolean;
  topics: string[];
}

export interface GHContent {
  type: "file" | "dir";
  name: string;
  path: string;
  content?: string; // base64 encoded
  encoding?: string;
  size: number;
  html_url: string;
}

export interface GHSearchResult {
  total_count: number;
  items: Array<{
    name: string;
    path: string;
    html_url: string;
    repository: { full_name: string };
    text_matches?: Array<{ fragment: string }>;
  }>;
}

export interface GHBranch {
  name: string;
  commit: { sha: string };
  protected: boolean;
}

export interface GHCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  html_url: string;
  author?: { login: string; avatar_url: string } | null;
}

export interface GHComparison {
  status: string;
  ahead_by: number;
  behind_by: number;
  total_commits: number;
  files: GHPullFile[];
  commits: GHCommit[];
}

export interface GHPull {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  merged: boolean;
  merged_at: string | null;
  html_url: string;
  user: { login: string };
  head: { ref: string; sha: string };
  base: { ref: string };
  labels: Array<{ name: string }>;
  requested_reviewers: Array<{ login: string }>;
  created_at: string;
  updated_at: string;
  additions: number;
  deletions: number;
  changed_files: number;
  mergeable: boolean | null;
  merge_commit_sha: string | null;
}

export interface GHPullFile {
  sha: string;
  filename: string;
  status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface GHReview {
  id: number;
  state: string;
  body: string;
  html_url: string;
  user: { login: string };
}

export interface GHIssue {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: Array<{ name: string; color: string }>;
  assignees: Array<{ login: string }>;
  user: { login: string };
  html_url: string;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  pull_request?: { url: string }; // present if issue is actually a PR
}

export interface GHIssueComment {
  id: number;
  body: string;
  user: { login: string };
  created_at: string;
  html_url: string;
}

export function isGitHubConfigured(): boolean {
  loadDevEnv();
  return !!process.env.GITHUB_TOKEN;
}
