import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getDataDir } from "./paths";

export interface AuditScores {
  performance: number;
  seo: number;
  accessibility: number;
  bestPractices: number;
}

export interface AuditIssue {
  id: string;
  title: string;
  description: string;
  score: number | null;
  priority: "high" | "medium" | "low";
  category: string;
}

export interface CoreWebVitals {
  lcp: { value: number; rating: "good" | "needs-improvement" | "poor" };
  inp: { value: number; rating: "good" | "needs-improvement" | "poor" };
  cls: { value: number; rating: "good" | "needs-improvement" | "poor" };
}

export interface AuditResult {
  id: string;
  url: string;
  timestamp: string;
  source: "lighthouse" | "pagespeed";
  scores: AuditScores;
  issues: AuditIssue[];
  coreWebVitals?: CoreWebVitals;
  projectId?: string;
}

const FILE_PATH = () => join(getDataDir(), "audits.json");

async function getAll(): Promise<AuditResult[]> {
  try {
    const raw = await readFile(FILE_PATH(), "utf-8");
    return JSON.parse(raw) as AuditResult[];
  } catch {
    return [];
  }
}

async function saveAll(items: AuditResult[]): Promise<void> {
  await writeFile(FILE_PATH(), JSON.stringify(items, null, 2), "utf-8");
}

export async function addAudit(data: Omit<AuditResult, "id" | "timestamp">): Promise<AuditResult> {
  const items = await getAll();
  const audit: AuditResult = {
    ...data,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  items.unshift(audit);
  await saveAll(items);
  return audit;
}

export async function getAudits(projectId?: string): Promise<AuditResult[]> {
  const items = await getAll();
  if (projectId) return items.filter((a) => a.projectId === projectId);
  return items;
}

export async function getAuditById(id: string): Promise<AuditResult | undefined> {
  const items = await getAll();
  return items.find((a) => a.id === id);
}
