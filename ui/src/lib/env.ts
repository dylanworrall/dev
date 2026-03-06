import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

let loaded = false;

function getEnvPath(): string {
  return join(homedir(), ".dev-client", ".env");
}

function readEnvFile(): Record<string, string> {
  const envPath = getEnvPath();
  const vars: Record<string, string> = {};
  if (!existsSync(envPath)) return vars;
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    vars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
  }
  return vars;
}

/**
 * Load env vars from ~/.dev-client/.env into process.env.
 * Does not override already-set vars unless force=true.
 */
export function loadDevEnv(force = false): void {
  if (loaded && !force) return;
  loaded = true;

  const vars = readEnvFile();
  for (const [key, value] of Object.entries(vars)) {
    if (force || !process.env[key]) {
      process.env[key] = value;
    }
  }
}

/**
 * Save a key=value to ~/.dev-client/.env (creates dir if needed).
 */
export function saveDevEnvVar(key: string, value: string): void {
  const dir = join(homedir(), ".dev-client");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const vars = readEnvFile();
  vars[key] = value;

  const envPath = getEnvPath();
  const lines = Object.entries(vars).map(([k, v]) => `${k}=${v}`);
  writeFileSync(envPath, lines.join("\n") + "\n");
}
