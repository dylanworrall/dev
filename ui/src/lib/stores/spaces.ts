import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getDataDir } from "./paths";

export interface SpaceSettings {
  defaultEnvironment: string;
  defaultBranch: string;
  buildCommand: string;
}

export interface Space {
  id: string;
  name: string;
  description: string;
  icon: string;
  settings: SpaceSettings;
  createdAt: string;
}

const FILE_PATH = () => join(getDataDir(), "spaces.json");

const DEFAULT_SPACES: Space[] = [
  { id: "frontend", name: "Frontend", description: "Frontend web applications", icon: "Monitor", settings: { defaultEnvironment: "preview", defaultBranch: "main", buildCommand: "npm run build" }, createdAt: new Date().toISOString() },
  { id: "backend", name: "Backend", description: "API servers and microservices", icon: "Server", settings: { defaultEnvironment: "staging", defaultBranch: "main", buildCommand: "npm run build" }, createdAt: new Date().toISOString() },
  { id: "mobile", name: "Mobile", description: "Mobile applications", icon: "Smartphone", settings: { defaultEnvironment: "dev", defaultBranch: "develop", buildCommand: "npx expo build" }, createdAt: new Date().toISOString() },
  { id: "devops", name: "DevOps", description: "Infrastructure and CI/CD", icon: "Container", settings: { defaultEnvironment: "production", defaultBranch: "main", buildCommand: "terraform apply" }, createdAt: new Date().toISOString() },
];

async function getAll(): Promise<Space[]> {
  try {
    const raw = await readFile(FILE_PATH(), "utf-8");
    const items = JSON.parse(raw) as Space[];
    return items.length > 0 ? items : DEFAULT_SPACES;
  } catch {
    return DEFAULT_SPACES;
  }
}

async function saveAll(items: Space[]): Promise<void> {
  await writeFile(FILE_PATH(), JSON.stringify(items, null, 2), "utf-8");
}

export async function listSpaces(): Promise<Space[]> {
  return getAll();
}

export async function getSpaceById(id: string): Promise<Space | undefined> {
  const items = await getAll();
  return items.find((s) => s.id === id);
}

export async function createSpace(data: { name: string; description?: string; icon?: string; settings?: Partial<SpaceSettings> }): Promise<Space> {
  const items = await getAll();
  const space: Space = {
    id: crypto.randomUUID(),
    name: data.name,
    description: data.description || "",
    icon: data.icon || "Folder",
    settings: {
      defaultEnvironment: data.settings?.defaultEnvironment || "preview",
      defaultBranch: data.settings?.defaultBranch || "main",
      buildCommand: data.settings?.buildCommand || "npm run build",
    },
    createdAt: new Date().toISOString(),
  };
  items.push(space);
  await saveAll(items);
  return space;
}
