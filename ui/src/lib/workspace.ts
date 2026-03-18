import { existsSync, statSync } from "node:fs";
import { resolve, relative, sep } from "node:path";
import { homedir } from "node:os";
import { loadDevEnv } from "./env";

/**
 * Get the configured workspace root directory.
 * Defaults to user home directory if not configured.
 */
export function getWorkspaceRoot(): string {
  loadDevEnv();
  return process.env.WORKSPACE_ROOT || homedir();
}

/**
 * Resolve a path relative to the workspace root, with safety checks.
 * Throws if the resolved path escapes the workspace root.
 */
export function resolveSafePath(relativePath: string): string {
  const root = getWorkspaceRoot();
  const resolved = resolve(root, relativePath);

  // Normalize separators for Windows compatibility
  const normalizedResolved = resolved.split(sep).join("/");
  const normalizedRoot = root.split(sep).join("/");

  if (!normalizedResolved.startsWith(normalizedRoot)) {
    throw new Error(`Path traversal denied: "${relativePath}" resolves outside workspace root.`);
  }

  return resolved;
}

/**
 * Get the relative path from workspace root
 */
export function getRelativePath(absolutePath: string): string {
  const root = getWorkspaceRoot();
  return relative(root, absolutePath).split(sep).join("/");
}

/**
 * Check if a file/directory exists within the workspace
 */
export function existsInWorkspace(relativePath: string): boolean {
  try {
    const fullPath = resolveSafePath(relativePath);
    return existsSync(fullPath);
  } catch {
    return false;
  }
}

/**
 * Check if a path is a directory
 */
export function isDirectory(relativePath: string): boolean {
  try {
    const fullPath = resolveSafePath(relativePath);
    return existsSync(fullPath) && statSync(fullPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Detect if the workspace root is a git repository
 */
export function isGitRepo(): boolean {
  return existsInWorkspace(".git");
}
