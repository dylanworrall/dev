import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getDataDir } from "./paths";

export interface ActivityLogEntry {
  id: string;
  type: "audit_run" | "crawl_run" | "project_created" | "seo_analysis" | "sitemap_generated" | "github_pr_created" | "github_pr_reviewed" | "github_issue_created" | "deploy_triggered" | "deploy_completed" | "deploy_rolled_back" | "pipeline_run";
  summary: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const FILE_PATH = () => join(getDataDir(), "activity.json");

async function getAll(): Promise<ActivityLogEntry[]> {
  try {
    const raw = await readFile(FILE_PATH(), "utf-8");
    return JSON.parse(raw) as ActivityLogEntry[];
  } catch {
    return [];
  }
}

async function saveAll(items: ActivityLogEntry[]): Promise<void> {
  await writeFile(FILE_PATH(), JSON.stringify(items, null, 2), "utf-8");
}

export async function addActivity(
  type: ActivityLogEntry["type"],
  summary: string,
  metadata?: Record<string, unknown>
): Promise<ActivityLogEntry> {
  const items = await getAll();
  const entry: ActivityLogEntry = {
    id: crypto.randomUUID(),
    type,
    summary,
    timestamp: new Date().toISOString(),
    metadata,
  };
  items.unshift(entry);
  await saveAll(items);
  return entry;
}

export async function getActivity(limit = 20): Promise<ActivityLogEntry[]> {
  const items = await getAll();
  return items.slice(0, limit);
}
