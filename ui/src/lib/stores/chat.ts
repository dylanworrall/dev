import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getDataDir } from "./paths";

export interface ChatToolCall {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: ChatToolCall[];
  createdAt: string;
}

const FILE_PATH = () => join(getDataDir(), "chat.json");

async function getAll(): Promise<ChatMessage[]> {
  try {
    const raw = await readFile(FILE_PATH(), "utf-8");
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

async function saveAll(items: ChatMessage[]): Promise<void> {
  await writeFile(FILE_PATH(), JSON.stringify(items, null, 2), "utf-8");
}

export async function addChatMessage(data: {
  threadId: string;
  role: ChatMessage["role"];
  content: string;
  toolCalls?: ChatToolCall[];
}): Promise<ChatMessage> {
  const items = await getAll();
  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    threadId: data.threadId,
    role: data.role,
    content: data.content,
    toolCalls: data.toolCalls || [],
    createdAt: new Date().toISOString(),
  };
  items.push(msg);
  await saveAll(items);
  return msg;
}

export async function getThreadMessages(threadId: string): Promise<ChatMessage[]> {
  const items = await getAll();
  return items.filter((m) => m.threadId === threadId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function listThreads(): Promise<{ threadId: string; messageCount: number; lastMessage: string }[]> {
  const items = await getAll();
  const threads = new Map<string, ChatMessage[]>();
  for (const msg of items) {
    if (!threads.has(msg.threadId)) threads.set(msg.threadId, []);
    threads.get(msg.threadId)!.push(msg);
  }
  return Array.from(threads.entries()).map(([threadId, msgs]) => ({
    threadId,
    messageCount: msgs.length,
    lastMessage: msgs[msgs.length - 1]?.createdAt || "",
  })).sort((a, b) => new Date(b.lastMessage).getTime() - new Date(a.lastMessage).getTime());
}
