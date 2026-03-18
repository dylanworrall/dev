import { tool } from "ai";
import { z } from "zod";
import { getSettings } from "@/lib/stores/settings";
import { saveDevEnvVar, loadDevEnv } from "@/lib/env";
import { isGitHubConfigured } from "@/lib/github";
import { isNetlifyConfigured } from "@/lib/netlify";
import { isVercelConfigured } from "@/lib/vercel";
import { isFlyConfigured } from "@/lib/flyio";

export const settingsTools = {
  get_settings: tool({
    description: "View current Dev Client settings, configuration, and integration status.",
    inputSchema: z.object({}),
    execute: async () => {
      loadDevEnv();
      const settings = await getSettings();
      return {
        message: "Current settings",
        settings,
        integrations: {
          github: {
            configured: isGitHubConfigured(),
            defaultOwner: process.env.GITHUB_DEFAULT_OWNER || null,
          },
          netlify: {
            configured: isNetlifyConfigured(),
            defaultSiteId: process.env.NETLIFY_SITE_ID || null,
          },
          vercel: {
            configured: isVercelConfigured(),
          },
          flyio: {
            configured: isFlyConfigured(),
          },
          google: {
            configured: !!process.env.GOOGLE_API_KEY,
          },
          anthropic: {
            configured: !!process.env.ANTHROPIC_API_KEY,
          },
        },
      };
    },
  }),

  configure_integration: tool({
    description: "Configure an integration by setting its API token/key. Tokens are stored securely in ~/.dev-client/.env",
    inputSchema: z.object({
      integration: z.enum(["github", "netlify", "vercel", "flyio", "google", "anthropic"]).describe("Which integration to configure"),
      token: z.string().describe("API token or key"),
      extras: z.record(z.string()).optional().describe("Additional config (e.g., { defaultOwner: 'myorg', siteId: 'abc123' })"),
    }),
    execute: async ({ integration, token, extras }) => {
      const envMap: Record<string, string> = {
        github: "GITHUB_TOKEN",
        netlify: "NETLIFY_TOKEN",
        vercel: "VERCEL_TOKEN",
        flyio: "FLY_API_TOKEN",
        google: "GOOGLE_API_KEY",
        anthropic: "ANTHROPIC_API_KEY",
      };

      const envKey = envMap[integration];
      saveDevEnvVar(envKey, token);
      process.env[envKey] = token;

      // Handle extras
      if (extras) {
        if (extras.defaultOwner || extras.default_owner) {
          const owner = extras.defaultOwner || extras.default_owner;
          saveDevEnvVar("GITHUB_DEFAULT_OWNER", owner);
          process.env.GITHUB_DEFAULT_OWNER = owner;
        }
        if (extras.siteId || extras.site_id) {
          const siteId = extras.siteId || extras.site_id;
          saveDevEnvVar("NETLIFY_SITE_ID", siteId);
          process.env.NETLIFY_SITE_ID = siteId;
        }
      }

      return {
        message: `${integration} configured successfully`,
        integration,
        configured: true,
      };
    },
  }),
};
