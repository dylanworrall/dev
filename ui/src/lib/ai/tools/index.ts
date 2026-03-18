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

export const allTools = {
  // Auditing & SEO
  ...auditTools,
  ...seoTools,
  ...crawlTools,
  ...contentTools,
  // Project management
  ...projectTools,
  ...settingsTools,
  ...spaceTools,
  // GitHub integration
  ...repoTools,
  ...issueTools,
  ...gitTools,
  // Deployments
  ...deploymentTools,
  // Orchestration workflows
  ...orchestrationTools,
  // Filesystem & local git
  ...filesystemTools,
  ...localGitTools,
  // Code execution
  ...bashTools,
  // Memory
  ...memoryTools,
  // Web search
  ...webSearchTools,
  // Agent loop
  ...agentLoopTools,
  // Browser / serving / screenshot
  ...openTools,
  ...screenshotTools,
  ...scaffoldTools,
  ...spawnAgentTools,
};
