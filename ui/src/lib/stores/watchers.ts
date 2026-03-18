import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getDataDir } from "./paths";

export interface WatcherAgent {
  id: string;
  name: string;
  repoFullName: string; // owner/repo
  enabled: boolean;
  watchIssues: boolean;
  watchCommits: boolean;
  watchBranches: boolean;
  watchPRs: boolean;
  notifyUser: boolean; // show in UI
  reportToAgent: boolean; // feed back to chat agent
  lastCheckedAt: string | null;
  createdAt: string;
}

export interface WatcherEvent {
  id: string;
  watcherId: string;
  type: "new_issue" | "new_commit" | "new_branch" | "new_pr" | "pr_merged" | "issue_closed";
  title: string;
  description: string;
  url: string;
  repo: string;
  timestamp: string;
  seen: boolean;
}

const WATCHERS_PATH = () => join(getDataDir(), "watchers.json");
const EVENTS_PATH = () => join(getDataDir(), "watcher-events.json");

async function getWatchers(): Promise<WatcherAgent[]> {
  try {
    return JSON.parse(await readFile(WATCHERS_PATH(), "utf-8"));
  } catch { return []; }
}

async function saveWatchers(items: WatcherAgent[]): Promise<void> {
  await writeFile(WATCHERS_PATH(), JSON.stringify(items, null, 2), "utf-8");
}

async function getEvents(): Promise<WatcherEvent[]> {
  try {
    return JSON.parse(await readFile(EVENTS_PATH(), "utf-8"));
  } catch { return []; }
}

async function saveEvents(items: WatcherEvent[]): Promise<void> {
  await writeFile(EVENTS_PATH(), JSON.stringify(items, null, 2), "utf-8");
}

export async function createWatcher(data: Omit<WatcherAgent, "id" | "lastCheckedAt" | "createdAt">): Promise<WatcherAgent> {
  const items = await getWatchers();
  const watcher: WatcherAgent = {
    id: crypto.randomUUID(),
    ...data,
    lastCheckedAt: null,
    createdAt: new Date().toISOString(),
  };
  items.push(watcher);
  await saveWatchers(items);
  return watcher;
}

export async function listWatchers(): Promise<WatcherAgent[]> {
  return getWatchers();
}

export async function updateWatcher(id: string, updates: Partial<WatcherAgent>): Promise<WatcherAgent | undefined> {
  const items = await getWatchers();
  const idx = items.findIndex((w) => w.id === id);
  if (idx === -1) return undefined;
  items[idx] = { ...items[idx], ...updates };
  await saveWatchers(items);
  return items[idx];
}

export async function deleteWatcher(id: string): Promise<boolean> {
  const items = await getWatchers();
  const filtered = items.filter((w) => w.id !== id);
  if (filtered.length === items.length) return false;
  await saveWatchers(filtered);
  return true;
}

export async function addEvent(event: Omit<WatcherEvent, "id" | "seen">): Promise<WatcherEvent> {
  const items = await getEvents();
  const entry: WatcherEvent = { id: crypto.randomUUID(), ...event, seen: false };
  items.unshift(entry); // newest first
  // Keep last 200 events
  if (items.length > 200) items.length = 200;
  await saveEvents(items);
  return entry;
}

export async function listEvents(watcherId?: string, limit = 50): Promise<WatcherEvent[]> {
  let items = await getEvents();
  if (watcherId) items = items.filter((e) => e.watcherId === watcherId);
  return items.slice(0, limit);
}

export async function markEventsSeen(eventIds: string[]): Promise<void> {
  const items = await getEvents();
  const idSet = new Set(eventIds);
  for (const item of items) {
    if (idSet.has(item.id)) item.seen = true;
  }
  await saveEvents(items);
}

export async function getUnseenCount(): Promise<number> {
  const items = await getEvents();
  return items.filter((e) => !e.seen).length;
}
