"use client";

import type { WebContainer } from "@webcontainer/api";
import type { AgentEvent } from "@/lib/agents/types";

/**
 * Sync an AgentEvent to the WebContainer filesystem.
 * Call this for every file.created / file.modified / file.deleted event.
 */
export async function syncEventToFS(
  wc: WebContainer,
  event: AgentEvent
): Promise<void> {
  switch (event.type) {
    case "file.created":
    case "file.modified": {
      // Ensure parent directory exists
      const dir = event.path.substring(0, event.path.lastIndexOf("/"));
      if (dir) {
        await wc.fs.mkdir(dir, { recursive: true });
      }
      await wc.fs.writeFile(event.path, event.content);
      break;
    }
    case "file.deleted": {
      try {
        await wc.fs.rm(event.path);
      } catch {
        // File may not exist, ignore
      }
      break;
    }
  }
}

/**
 * Write a batch of files to the WebContainer.
 * Useful for initial project seeding.
 */
export async function writeFiles(
  wc: WebContainer,
  files: Record<string, string>
): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    const dir = path.substring(0, path.lastIndexOf("/"));
    if (dir) {
      await wc.fs.mkdir(dir, { recursive: true });
    }
    await wc.fs.writeFile(path, content);
  }
}

/**
 * Read a file from the WebContainer.
 */
export async function readFile(
  wc: WebContainer,
  path: string
): Promise<string> {
  return await wc.fs.readFile(path, "utf-8");
}

/**
 * List directory contents.
 */
export async function listDir(
  wc: WebContainer,
  path: string
): Promise<string[]> {
  return await wc.fs.readdir(path);
}

/**
 * Run a shell command in the WebContainer.
 * Returns { exitCode, output }.
 */
export async function runCommand(
  wc: WebContainer,
  command: string,
  args: string[] = [],
  onOutput?: (data: string) => void
): Promise<{ exitCode: number; output: string }> {
  const process = await wc.spawn(command, args);
  let output = "";

  const writable = new WritableStream({
    write(data) {
      output += data;
      onOutput?.(data);
    },
  });

  process.output.pipeTo(writable).catch(() => {});

  const exitCode = await process.exit;
  return { exitCode, output };
}
