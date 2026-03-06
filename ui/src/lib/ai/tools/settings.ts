import { tool } from "ai";
import { z } from "zod";
import { getSettings } from "@/lib/stores/settings";

export const settingsTools = {
  get_settings: tool({
    description: "View current Dev Client settings and configuration.",
    inputSchema: z.object({}),
    execute: async () => {
      const settings = await getSettings();
      return {
        message: "Current settings",
        settings,
      };
    },
  }),
};
