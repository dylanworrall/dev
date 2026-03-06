import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getDataDir } from "./paths";

export type DeployEnvironment = "production" | "staging" | "preview" | "dev";
export type DeployStatus = "building" | "deploying" | "live" | "failed" | "rolled-back";

export interface Deployment {
  id: string;
  projectId: string;
  environment: DeployEnvironment;
  status: DeployStatus;
  url: string;
  commitSha: string;
  branch: string;
  logs: string[];
  buildDuration?: number;
  createdAt: string;
  updatedAt: string;
}

const FILE_PATH = () => join(getDataDir(), "deployments.json");

async function getAll(): Promise<Deployment[]> {
  try {
    const raw = await readFile(FILE_PATH(), "utf-8");
    return JSON.parse(raw) as Deployment[];
  } catch {
    return [];
  }
}

async function saveAll(items: Deployment[]): Promise<void> {
  await writeFile(FILE_PATH(), JSON.stringify(items, null, 2), "utf-8");
}

export async function createDeployment(data: {
  projectId: string;
  environment: DeployEnvironment;
  url?: string;
  commitSha: string;
  branch: string;
}): Promise<Deployment> {
  const items = await getAll();
  const deployment: Deployment = {
    id: crypto.randomUUID(),
    projectId: data.projectId,
    environment: data.environment,
    status: "building",
    url: data.url || "",
    commitSha: data.commitSha,
    branch: data.branch,
    logs: [`[${new Date().toISOString()}] Build started`],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  items.push(deployment);
  await saveAll(items);
  return deployment;
}

export async function listDeployments(filter?: { projectId?: string; environment?: DeployEnvironment; status?: DeployStatus }): Promise<Deployment[]> {
  let items = await getAll();
  if (filter?.projectId) items = items.filter((d) => d.projectId === filter.projectId);
  if (filter?.environment) items = items.filter((d) => d.environment === filter.environment);
  if (filter?.status) items = items.filter((d) => d.status === filter.status);
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getDeploymentById(id: string): Promise<Deployment | undefined> {
  const items = await getAll();
  return items.find((d) => d.id === id);
}

export async function updateDeployment(id: string, updates: Partial<Omit<Deployment, "id" | "createdAt">>): Promise<Deployment | undefined> {
  const items = await getAll();
  const idx = items.findIndex((d) => d.id === id);
  if (idx === -1) return undefined;
  items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() };
  await saveAll(items);
  return items[idx];
}

export async function addDeployLog(id: string, message: string): Promise<void> {
  const items = await getAll();
  const deployment = items.find((d) => d.id === id);
  if (deployment) {
    deployment.logs.push(`[${new Date().toISOString()}] ${message}`);
    deployment.updatedAt = new Date().toISOString();
    await saveAll(items);
  }
}
