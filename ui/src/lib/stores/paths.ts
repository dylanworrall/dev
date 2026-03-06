import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync, existsSync } from "node:fs";

export function getDataDir(): string {
  const dir = join(process.env.DEV_CLIENT_HOME || join(homedir(), ".dev-client"), "data");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}
