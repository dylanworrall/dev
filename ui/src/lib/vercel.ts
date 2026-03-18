import { loadDevEnv } from "./env";

const API_BASE = "https://api.vercel.com";

function getToken(): string {
  loadDevEnv();
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN not configured. Use configure_integration to set it up.");
  return token;
}

async function vercelFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vercel API error ${res.status}: ${text}`);
  }
  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

export const projects = {
  list: () =>
    vercelFetch<{ projects: VercelProject[] }>(`/v9/projects`),

  get: (idOrName: string) =>
    vercelFetch<VercelProject>(`/v9/projects/${encodeURIComponent(idOrName)}`),

  create: (data: { name: string; framework?: string; gitRepository?: { type: string; repo: string } }) =>
    vercelFetch<VercelProject>(`/v10/projects`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const deployments = {
  list: (projectId?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (projectId) params.set("projectId", projectId);
    return vercelFetch<{ deployments: VercelDeployment[] }>(`/v6/deployments?${params}`);
  },

  get: (deploymentId: string) =>
    vercelFetch<VercelDeployment>(`/v13/deployments/${deploymentId}`),

  create: (data: { name: string; gitSource?: { type: string; ref: string; repoId: string } }) =>
    vercelFetch<VercelDeployment>(`/v13/deployments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  cancel: (deploymentId: string) =>
    vercelFetch<VercelDeployment>(`/v12/deployments/${deploymentId}/cancel`, { method: "PATCH" }),
};

export const domains = {
  list: (projectId: string) =>
    vercelFetch<{ domains: VercelDomain[] }>(`/v9/projects/${projectId}/domains`),
};

// Types
export interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  link?: { type: string; repo: string; repoId: string };
  latestDeployments?: VercelDeployment[];
  createdAt: number;
  updatedAt: number;
}

export interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  state: "BUILDING" | "ERROR" | "INITIALIZING" | "QUEUED" | "READY" | "CANCELED";
  readyState: string;
  created: number;
  buildingAt?: number;
  ready?: number;
  creator: { uid: string; username: string };
  meta?: { githubCommitRef?: string; githubCommitMessage?: string };
  target: "production" | "preview" | null;
  inspectorUrl: string;
}

export interface VercelDomain {
  name: string;
  verified: boolean;
  createdAt: number;
}

export function isVercelConfigured(): boolean {
  loadDevEnv();
  return !!process.env.VERCEL_TOKEN;
}
