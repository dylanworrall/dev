export interface DevConfig {
  anthropicApiKey: string;
  anthropicModel: string;
  googleApiKey: string;
  defaultCategories: string[];
  crawlMaxPages: number;
  crawlRateLimit: number;
  respectRobotsTxt: boolean;
}
