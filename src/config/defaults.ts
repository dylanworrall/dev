import type { DevConfig } from "../types/config.js";

export const DEFAULT_CONFIG: DevConfig = {
  anthropicApiKey: "",
  anthropicModel: "claude-sonnet-4-20250514",
  googleApiKey: "",
  defaultCategories: ["performance", "seo", "accessibility", "best-practices"],
  crawlMaxPages: 50,
  crawlRateLimit: 1000,
  respectRobotsTxt: true,
};
