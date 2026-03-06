import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getDataDir } from "./paths";

export interface CrawledPage {
  url: string;
  statusCode: number;
  title: string;
  metaDescription: string;
  wordCount: number;
  internalLinks: string[];
  externalLinks: string[];
}

export interface BrokenLink {
  url: string;
  statusCode: number;
  foundOn: string;
  linkText: string;
}

export interface Redirect {
  from: string;
  to: string;
  statusCode: number;
  chain: string[];
}

export interface SiteCrawl {
  id: string;
  rootUrl: string;
  timestamp: string;
  pages: CrawledPage[];
  totalPages: number;
  brokenLinks: BrokenLink[];
  redirects: Redirect[];
  projectId?: string;
}

const FILE_PATH = () => join(getDataDir(), "crawls.json");

async function getAll(): Promise<SiteCrawl[]> {
  try {
    const raw = await readFile(FILE_PATH(), "utf-8");
    return JSON.parse(raw) as SiteCrawl[];
  } catch {
    return [];
  }
}

async function saveAll(items: SiteCrawl[]): Promise<void> {
  await writeFile(FILE_PATH(), JSON.stringify(items, null, 2), "utf-8");
}

export async function addCrawl(data: Omit<SiteCrawl, "id" | "timestamp">): Promise<SiteCrawl> {
  const items = await getAll();
  const crawl: SiteCrawl = {
    ...data,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  items.unshift(crawl);
  await saveAll(items);
  return crawl;
}

export async function getCrawls(projectId?: string): Promise<SiteCrawl[]> {
  const items = await getAll();
  if (projectId) return items.filter((c) => c.projectId === projectId);
  return items;
}

export async function getCrawlById(id: string): Promise<SiteCrawl | undefined> {
  const items = await getAll();
  return items.find((c) => c.id === id);
}
