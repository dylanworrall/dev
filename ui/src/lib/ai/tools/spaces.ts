import { tool } from "ai";
import { z } from "zod";
import { listSpaces, getSpaceById, createSpace } from "@/lib/stores/spaces";

export const spaceTools = {
  list_spaces: tool({
    description: "List all workspaces/spaces.",
    inputSchema: z.object({}),
    execute: async () => {
      const spaces = await listSpaces();
      return { message: `${spaces.length} space(s)`, spaces };
    },
  }),

  get_space: tool({
    description: "Get details of a specific workspace/space.",
    inputSchema: z.object({
      spaceId: z.string().describe("The space ID"),
    }),
    execute: async ({ spaceId }) => {
      const space = await getSpaceById(spaceId);
      if (!space) return { message: "Space not found", space: null };
      return { message: `Space: ${space.name}`, space };
    },
  }),

  create_space: tool({
    description: "Create a new workspace/space.",
    inputSchema: z.object({
      name: z.string().describe("Space name"),
      description: z.string().optional().describe("Space description"),
      icon: z.string().optional().describe("Lucide icon name"),
      defaultEnvironment: z.string().optional().describe("Default deploy environment"),
      defaultBranch: z.string().optional().describe("Default branch"),
      buildCommand: z.string().optional().describe("Default build command"),
    }),
    execute: async ({ name, description, icon, defaultEnvironment, defaultBranch, buildCommand }) => {
      const space = await createSpace({
        name,
        description,
        icon,
        settings: { defaultEnvironment, defaultBranch, buildCommand },
      });
      return { message: `Created space "${space.name}"`, space };
    },
  }),
};
