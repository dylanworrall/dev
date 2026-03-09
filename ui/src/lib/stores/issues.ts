import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getDataDir } from "./paths";
import { soshiEvents } from '../../../../src/events/emitter.js';

export type IssueStatus = "open" | "in-progress" | "closed";
export type IssuePriority = "low" | "medium" | "high" | "critical";

export interface IssueComment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  labels: string[];
  assignee: string;
  comments: IssueComment[];
  repoId?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

const FILE_PATH = () => join(getDataDir(), "issues.json");

async function getAll(): Promise<Issue[]> {
  try {
    const raw = await readFile(FILE_PATH(), "utf-8");
    return JSON.parse(raw) as Issue[];
  } catch {
    return [];
  }
}

async function saveAll(items: Issue[]): Promise<void> {
  await writeFile(FILE_PATH(), JSON.stringify(items, null, 2), "utf-8");
}

export async function createIssue(data: {
  title: string;
  description?: string;
  priority?: IssuePriority;
  labels?: string[];
  assignee?: string;
  repoId?: string;
  projectId?: string;
}): Promise<Issue> {
  const items = await getAll();
  const issue: Issue = {
    id: crypto.randomUUID(),
    title: data.title,
    description: data.description || "",
    status: "open",
    priority: data.priority || "medium",
    labels: data.labels || [],
    assignee: data.assignee || "",
    comments: [],
    repoId: data.repoId,
    projectId: data.projectId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  items.push(issue);
  await saveAll(items);
  soshiEvents.emit('issue_created', { issueId: issue.id, title: issue.title, status: issue.status, priority: issue.priority, projectId: issue.projectId ?? '' });
  return issue;
}

export async function listIssues(filter?: { status?: IssueStatus; repoId?: string; projectId?: string }): Promise<Issue[]> {
  let items = await getAll();
  if (filter?.status) items = items.filter((i) => i.status === filter.status);
  if (filter?.repoId) items = items.filter((i) => i.repoId === filter.repoId);
  if (filter?.projectId) items = items.filter((i) => i.projectId === filter.projectId);
  return items;
}

export async function getIssueById(id: string): Promise<Issue | undefined> {
  const items = await getAll();
  return items.find((i) => i.id === id);
}

export async function updateIssue(id: string, updates: Partial<Omit<Issue, "id" | "createdAt">>): Promise<Issue | undefined> {
  const items = await getAll();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return undefined;
  items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() };
  await saveAll(items);
  return items[idx];
}

export async function addComment(issueId: string, author: string, body: string): Promise<IssueComment | undefined> {
  const items = await getAll();
  const issue = items.find((i) => i.id === issueId);
  if (!issue) return undefined;
  const comment: IssueComment = {
    id: crypto.randomUUID(),
    author,
    body,
    createdAt: new Date().toISOString(),
  };
  issue.comments.push(comment);
  issue.updatedAt = new Date().toISOString();
  await saveAll(items);
  return comment;
}
