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

export const allTools = {
  ...auditTools,
  ...seoTools,
  ...crawlTools,
  ...contentTools,
  ...projectTools,
  ...settingsTools,
  ...repoTools,
  ...issueTools,
  ...deploymentTools,
  ...gitTools,
  ...spaceTools,
};
