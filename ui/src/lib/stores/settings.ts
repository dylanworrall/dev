import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getDataDir } from "./paths";

export interface Settings {
  anthropicModel: string;
  defaultCategories: string[];
  crawlMaxPages: number;
  crawlRateLimit: number;
  respectRobotsTxt: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  anthropicModel: "claude-sonnet-4-20250514",
  defaultCategories: ["performance", "seo", "accessibility", "best-practices"],
  crawlMaxPages: 50,
  crawlRateLimit: 1000,
  respectRobotsTxt: true,
};

const FILE_PATH = () => join(getDataDir(), "settings.json");

export async function getSettings(): Promise<Settings> {
  try {
    const raw = await readFile(FILE_PATH(), "utf-8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as Settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function updateSettings(updates: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const merged = { ...current, ...updates };
  await writeFile(FILE_PATH(), JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}
