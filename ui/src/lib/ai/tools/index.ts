import { auditTools } from "./audit";
import { seoTools } from "./seo";
import { crawlTools } from "./crawl";
import { contentTools } from "./content";
import { projectTools } from "./projects";
import { settingsTools } from "./settings";
import { repoTools } from "./repos";
import { issueTools } from "./issues";
import { deploymentTools } from "./deployments";
import { gitTools } from "./git";
import { spaceTools } from "./spaces";
import { orchestrationTools } from "./orchestration";
import { filesystemTools } from "./filesystem";
import { localGitTools } from "./local-git";
import { bashTools } from "./bash";
import { memoryTools } from "./memory-tools";
import { webSearchTools } from "./web-search";
import { agentLoopTools } from "./agent-loop";
import { openTools } from "./open";
import { screenshotTools } from "./screenshot";
import { scaffoldTools } from "./scaffold";
import { spawnAgentTools } from "./spawn-agent";

// Legacy object export — used by chat route's tool selection
export const allTools = {
  ...auditTools,
  ...seoTools,
  ...crawlTools,
  ...contentTools,
  ...projectTools,
  ...settingsTools,
  ...spaceTools,
  ...repoTools,
  ...issueTools,
  ...gitTools,
  ...deploymentTools,
  ...orchestrationTools,
  ...filesystemTools,
  ...localGitTools,
  ...bashTools,
  ...memoryTools,
  ...webSearchTools,
  ...agentLoopTools,
  ...openTools,
  ...screenshotTools,
  ...scaffoldTools,
  ...spawnAgentTools,
};

// Soshi connector export — array format with name on each tool
export const tools = Object.entries(allTools).map(([name, t]) => ({
  name,
  ...(t as Record<string, unknown>),
}));
