import { z } from "zod";

export const ConfigFileSchema = z.object({
  anthropicApiKey: z.string().optional(),
  anthropicModel: z.string().optional(),
  googleApiKey: z.string().optional(),
  defaultCategories: z.array(z.string()).optional(),
  crawlMaxPages: z.number().optional(),
  crawlRateLimit: z.number().optional(),
  respectRobotsTxt: z.boolean().optional(),
});

export type ConfigFile = z.infer<typeof ConfigFileSchema>;
