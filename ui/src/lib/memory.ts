import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { getWorkspaceRoot } from "./workspace";

const MEMORY_DIR = () => join(homedir(), ".dev-client", "memory");
const AGENT_MD = "AGENT.md";

/**
 * Get project-level memory (AGENT.md in workspace root)
 */
export async function getProjectMemory(): Promise<string> {
  const root = getWorkspaceRoot();
  const agentPath = join(root, AGENT_MD);
  try {
    return await readFile(agentPath, "utf-8");
  } catch {
    return "";
  }
}

/**
 * Update project-level memory
 */
export async function updateProjectMemory(content: string): Promise<void> {
  const root = getWorkspaceRoot();
  const agentPath = join(root, AGENT_MD);
  await writeFile(agentPath, content, "utf-8");
}

/**
 * Get global memory
 */
export async function getGlobalMemory(): Promise<string> {
  const memDir = MEMORY_DIR();
  const globalPath = join(memDir, "global.md");
  try {
    return await readFile(globalPath, "utf-8");
  } catch {
    return "";
  }
}

/**
 * Update global memory
 */
export async function updateGlobalMemory(content: string): Promise<void> {
  const memDir = MEMORY_DIR();
  if (!existsSync(memDir)) await mkdir(memDir, { recursive: true });
  await writeFile(join(memDir, "global.md"), content, "utf-8");
}

/**
 * Read a specific memory file
 */
export async function readMemoryFile(filename: string): Promise<string> {
  const memDir = MEMORY_DIR();
  try {
    return await readFile(join(memDir, filename), "utf-8");
  } catch {
    return "";
  }
}

/**
 * Write a specific memory file
 */
export async function writeMemoryFile(filename: string, content: string): Promise<void> {
  const memDir = MEMORY_DIR();
  if (!existsSync(memDir)) await mkdir(memDir, { recursive: true });
  await writeFile(join(memDir, filename), content, "utf-8");
}

/**
 * List all memory files
 */
export async function listMemoryFiles(): Promise<string[]> {
  const memDir = MEMORY_DIR();
  if (!existsSync(memDir)) return [];
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(memDir);
  return files.filter((f) => f.endsWith(".md") || f.endsWith(".json"));
}

/**
 * Get user preferences
 */
export async function getUserPreferences(): Promise<Record<string, unknown>> {
  const memDir = MEMORY_DIR();
  try {
    const raw = await readFile(join(memDir, "preferences.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(prefs: Record<string, unknown>): Promise<void> {
  const memDir = MEMORY_DIR();
  if (!existsSync(memDir)) await mkdir(memDir, { recursive: true });
  const current = await getUserPreferences();
  const merged = { ...current, ...prefs };
  await writeFile(join(memDir, "preferences.json"), JSON.stringify(merged, null, 2), "utf-8");
}
