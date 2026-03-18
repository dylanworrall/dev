import { loadDevEnv } from "./env";

const API_BASE = "https://api.machines.dev/v1";

function getToken(): string {
  loadDevEnv();
  const token = process.env.FLY_API_TOKEN;
  if (!token) throw new Error("FLY_API_TOKEN not configured. Use configure_integration to set it up.");
  return token;
}

async function flyFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
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
    throw new Error(`Fly.io API error ${res.status}: ${text}`);
  }
  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

export const apps = {
  list: (orgSlug?: string) => {
    const org = orgSlug || "personal";
    return flyFetch<FlyApp[]>(`/apps?org_slug=${org}`);
  },

  get: (appName: string) =>
    flyFetch<FlyApp>(`/apps/${appName}`),

  create: (data: { app_name: string; org_slug?: string }) =>
    flyFetch<FlyApp>(`/apps`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  delete: (appName: string) =>
    flyFetch<void>(`/apps/${appName}`, { method: "DELETE" }),
};

export const machines = {
  list: (appName: string) =>
    flyFetch<FlyMachine[]>(`/apps/${appName}/machines`),

  get: (appName: string, machineId: string) =>
    flyFetch<FlyMachine>(`/apps/${appName}/machines/${machineId}`),

  create: (appName: string, config: FlyMachineConfig) =>
    flyFetch<FlyMachine>(`/apps/${appName}/machines`, {
      method: "POST",
      body: JSON.stringify(config),
    }),

  start: (appName: string, machineId: string) =>
    flyFetch<void>(`/apps/${appName}/machines/${machineId}/start`, { method: "POST" }),

  stop: (appName: string, machineId: string) =>
    flyFetch<void>(`/apps/${appName}/machines/${machineId}/stop`, { method: "POST" }),

  destroy: (appName: string, machineId: string) =>
    flyFetch<void>(`/apps/${appName}/machines/${machineId}`, { method: "DELETE" }),
};

// Deploy using flyctl CLI (for Dockerfile-based deploys)
export async function deployWithCli(appName: string, cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { executeShell } = await import("./executor");
  return executeShell(`flyctl deploy --app ${appName} --remote-only --now`, { cwd, timeout: 300_000 });
}

// Types
export interface FlyApp {
  id: string;
  name: string;
  status: string;
  organization: { slug: string; name: string };
  hostname: string;
  created_at: string;
}

export interface FlyMachine {
  id: string;
  name: string;
  state: "created" | "starting" | "started" | "stopping" | "stopped" | "destroying" | "destroyed";
  region: string;
  instance_id: string;
  config: FlyMachineConfig;
  image_ref?: { repository: string; tag: string; digest: string };
  created_at: string;
  updated_at: string;
}

export interface FlyMachineConfig {
  name?: string;
  region?: string;
  image?: string;
  env?: Record<string, string>;
  services?: Array<{
    ports: Array<{ port: number; handlers: string[] }>;
    protocol: string;
    internal_port: number;
  }>;
  guest?: { cpu_kind: string; cpus: number; memory_mb: number };
}

export function isFlyConfigured(): boolean {
  loadDevEnv();
  return !!process.env.FLY_API_TOKEN;
}
