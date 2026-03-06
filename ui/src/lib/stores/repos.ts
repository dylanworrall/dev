import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getDataDir } from "./paths";

export interface Repo {
  id: string;
  name: string;
  fullName: string;
  url: string;
  language: string;
  description: string;
  stars: number;
  lastPush: string;
  defaultBranch: string;
  projectId?: string;
}

const FILE_PATH = () => join(getDataDir(), "repos.json");

async function getAll(): Promise<Repo[]> {
  try {
    const raw = await readFile(FILE_PATH(), "utf-8");
    return JSON.parse(raw) as Repo[];
  } catch {
    return [];
  }
}

async function saveAll(items: Repo[]): Promise<void> {
  await writeFile(FILE_PATH(), JSON.stringify(items, null, 2), "utf-8");
}

export async function addRepo(data: Omit<Repo, "id">): Promise<Repo> {
  const items = await getAll();
  const repo: Repo = { id: crypto.randomUUID(), ...data };
  items.push(repo);
  await saveAll(items);
  return repo;
}

export async function listRepos(): Promise<Repo[]> {
  return getAll();
}

export async function getRepoById(id: string): Promise<Repo | undefined> {
  const items = await getAll();
  return items.find((r) => r.id === id);
}

export async function getRepoByName(name: string): Promise<Repo | undefined> {
  const items = await getAll();
  return items.find((r) => r.name === name || r.fullName === name);
}

export async function updateRepo(id: string, updates: Partial<Repo>): Promise<Repo | undefined> {
  const items = await getAll();
  const idx = items.findIndex((r) => r.id === id);
  if (idx === -1) return undefined;
  items[idx] = { ...items[idx], ...updates };
  await saveAll(items);
  return items[idx];
}
