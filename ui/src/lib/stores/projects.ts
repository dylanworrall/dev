import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getDataDir } from "./paths";

export interface Project {
  id: string;
  name: string;
  url: string;
  client: string;
  notes: string;
  auditIds: string[];
  crawlIds: string[];
  createdAt: string;
  updatedAt: string;
}

const FILE_PATH = () => join(getDataDir(), "projects.json");

async function getAll(): Promise<Project[]> {
  try {
    const raw = await readFile(FILE_PATH(), "utf-8");
    return JSON.parse(raw) as Project[];
  } catch {
    return [];
  }
}

async function saveAll(items: Project[]): Promise<void> {
  await writeFile(FILE_PATH(), JSON.stringify(items, null, 2), "utf-8");
}

export async function createProject(data: { name: string; url: string; client: string; notes?: string }): Promise<Project> {
  const items = await getAll();
  const project: Project = {
    id: crypto.randomUUID(),
    name: data.name,
    url: data.url,
    client: data.client,
    notes: data.notes || "",
    auditIds: [],
    crawlIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  items.push(project);
  await saveAll(items);
  return project;
}

export async function listProjects(): Promise<Project[]> {
  return getAll();
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  const items = await getAll();
  return items.find((p) => p.id === id);
}

export async function linkAuditToProject(projectId: string, auditId: string): Promise<void> {
  const items = await getAll();
  const project = items.find((p) => p.id === projectId);
  if (project) {
    project.auditIds.push(auditId);
    project.updatedAt = new Date().toISOString();
    await saveAll(items);
  }
}

export async function linkCrawlToProject(projectId: string, crawlId: string): Promise<void> {
  const items = await getAll();
  const project = items.find((p) => p.id === projectId);
  if (project) {
    project.crawlIds.push(crawlId);
    project.updatedAt = new Date().toISOString();
    await saveAll(items);
  }
}
