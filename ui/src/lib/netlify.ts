import { loadDevEnv } from "./env";

const API_BASE = "https://api.netlify.com/api/v1";

function getToken(): string {
  loadDevEnv();
  const token = process.env.NETLIFY_TOKEN;
  if (!token) throw new Error("NETLIFY_TOKEN not configured. Use the configure_integration tool to set it up.");
  return token;
}

function getDefaultSiteId(): string | undefined {
  return process.env.NETLIFY_SITE_ID;
}

async function netlifyFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(`Netlify auth failed (${res.status}): ${await res.text()}`);
  }
  if (res.status === 404) {
    throw new Error(`Netlify resource not found: ${path}`);
  }
  if (!res.ok) {
    throw new Error(`Netlify API error ${res.status}: ${await res.text()}`);
  }

  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

export function resolveSiteId(siteId?: string): string {
  const resolved = siteId || getDefaultSiteId();
  if (!resolved) throw new Error("No site ID provided and NETLIFY_SITE_ID not configured.");
  return resolved;
}

// --- Sites ---

export const sites = {
  get: (siteId: string) =>
    netlifyFetch<NetlifySite>(`/sites/${siteId}`),

  list: () =>
    netlifyFetch<NetlifySite[]>(`/sites?per_page=50`),
};

// --- Deploys ---

export const deploys = {
  list: (siteId: string, perPage = 20) =>
    netlifyFetch<NetlifyDeploy[]>(`/sites/${siteId}/deploys?per_page=${perPage}`),

  get: (deployId: string) =>
    netlifyFetch<NetlifyDeploy>(`/deploys/${deployId}`),

  trigger: (siteId: string, options?: { clear_cache?: boolean; branch?: string; title?: string }) =>
    netlifyFetch<NetlifyDeploy>(`/sites/${siteId}/builds`, {
      method: "POST",
      body: JSON.stringify(options || {}),
    }),

  cancel: (deployId: string) =>
    netlifyFetch<NetlifyDeploy>(`/deploys/${deployId}/cancel`, { method: "POST" }),

  rollback: (siteId: string, deployId: string) =>
    netlifyFetch<NetlifyDeploy>(`/sites/${siteId}/rollback`, {
      method: "PUT",
      body: JSON.stringify({ deploy_id: deployId }),
    }),

  lock: (deployId: string) =>
    netlifyFetch<NetlifyDeploy>(`/deploys/${deployId}/lock`, { method: "POST" }),

  unlock: (deployId: string) =>
    netlifyFetch<NetlifyDeploy>(`/deploys/${deployId}/unlock`, { method: "POST" }),
};

// --- Build Logs ---

export async function getDeployLog(deployId: string): Promise<NetlifyLogEntry[]> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/deploys/${deployId}/log`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to get deploy logs: ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text) as NetlifyLogEntry[];
  } catch {
    // Sometimes logs come as newline-delimited JSON
    return text.split("\n").filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch { return { message: line }; }
    });
  }
}

// --- Types ---

export interface NetlifySite {
  id: string;
  name: string;
  url: string;
  ssl_url: string;
  admin_url: string;
  default_domain: string;
  custom_domain: string | null;
  branch_deploy_custom_domain: string | null;
  created_at: string;
  updated_at: string;
  repo?: {
    provider: string;
    repo_path: string;
    repo_branch: string;
    cmd: string;
    dir: string;
  };
  build_settings?: {
    cmd: string;
    dir: string;
    env: Record<string, string>;
  };
}

export interface NetlifyDeploy {
  id: string;
  site_id: string;
  state: "new" | "pending" | "uploading" | "uploaded" | "preparing" | "prepared" | "building" | "ready" | "error" | "retrying";
  name: string;
  url: string;
  ssl_url: string;
  deploy_url: string;
  deploy_ssl_url: string;
  admin_url: string;
  branch: string;
  commit_ref: string | null;
  commit_url: string | null;
  title: string | null;
  context: "production" | "deploy-preview" | "branch-deploy" | "cms" | "dev";
  deploy_time: number | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  error_message: string | null;
  framework: string | null;
  screenshot_url: string | null;
  skipped: boolean | null;
}

export interface NetlifyLogEntry {
  message: string;
  ts?: string;
  section?: string;
}

export function isNetlifyConfigured(): boolean {
  loadDevEnv();
  return !!process.env.NETLIFY_TOKEN;
}
