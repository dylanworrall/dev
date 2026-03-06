import path from "node:path";
import { homedir } from "node:os";

export function getHomeDir(): string {
  return process.env.DEV_CLIENT_HOME || path.join(homedir(), ".dev-client");
}

export function getConfigPath(): string {
  return path.join(getHomeDir(), "config.json");
}

export function getDataDir(): string {
  return path.join(getHomeDir(), "data");
}

export function getEnvPath(): string {
  return path.join(getHomeDir(), ".env");
}
