import { readFile } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import type { DevConfig } from "../types/config.js";
import { ConfigFileSchema } from "./schema.js";
import { DEFAULT_CONFIG } from "./defaults.js";
import { getEnvPath } from "./paths.js";
import { log } from "../utils/logger.js";

const homeEnvPath = getEnvPath();
if (existsSync(homeEnvPath)) {
  loadEnv({ path: homeEnvPath });
}
loadEnv();

async function tryLoadJson(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const validated = ConfigFileSchema.parse(parsed);
    log.debug(`Loaded config from ${filePath}`);
    return validated as Record<string, unknown>;
  } catch {
    return null;
  }
}

function deepMerge<T extends Record<string, unknown>>(base: T, override: Record<string, unknown>): T {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value !== undefined && value !== null) {
      if (
        typeof value === "object" &&
        !Array.isArray(value) &&
        typeof (result as Record<string, unknown>)[key] === "object" &&
        !Array.isArray((result as Record<string, unknown>)[key])
      ) {
        (result as Record<string, unknown>)[key] = deepMerge(
          (result as Record<string, unknown>)[key] as Record<string, unknown>,
          value as Record<string, unknown>
        );
      } else {
        (result as Record<string, unknown>)[key] = value;
      }
    }
  }
  return result;
}

export async function loadConfig(cliConfigPath?: string): Promise<DevConfig> {
  let config = { ...DEFAULT_CONFIG } as Record<string, unknown>;

  const homeConfig = await tryLoadJson(
    path.join(homedir(), ".dev-client", "config.json")
  );
  if (homeConfig) config = deepMerge(config, homeConfig);

  const localConfig = await tryLoadJson(
    path.join(process.cwd(), "dev.config.json")
  );
  if (localConfig) config = deepMerge(config, localConfig);

  if (cliConfigPath) {
    const cliConfig = await tryLoadJson(cliConfigPath);
    if (cliConfig) config = deepMerge(config, cliConfig);
  }

  if (process.env.ANTHROPIC_API_KEY) config.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (process.env.GOOGLE_API_KEY) config.googleApiKey = process.env.GOOGLE_API_KEY;
  if (process.env.ANTHROPIC_MODEL) config.anthropicModel = process.env.ANTHROPIC_MODEL;

  return config as unknown as DevConfig;
}
