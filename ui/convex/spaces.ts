import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("spaces").order("desc").collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    settings: v.optional(
      v.object({
        defaultEnvironment: v.optional(v.string()),
        defaultBranch: v.optional(v.string()),
        buildCommand: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("spaces", {
      name: args.name,
      description: args.description || "",
      icon: args.icon || "Folder",
      settings: {
        defaultEnvironment: args.settings?.defaultEnvironment || "preview",
        defaultBranch: args.settings?.defaultBranch || "main",
        buildCommand: args.settings?.buildCommand || "npm run build",
      },
      createdAt: new Date().toISOString(),
    });
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("spaces").first();
    if (existing) return "already seeded";

    const now = new Date().toISOString();
    const spaces = [
      { name: "Frontend", description: "Frontend web applications", icon: "Monitor", settings: { defaultEnvironment: "preview", defaultBranch: "main", buildCommand: "npm run build" } },
      { name: "Backend", description: "API servers and microservices", icon: "Server", settings: { defaultEnvironment: "staging", defaultBranch: "main", buildCommand: "npm run build" } },
      { name: "DevOps", description: "Infrastructure and CI/CD", icon: "Container", settings: { defaultEnvironment: "production", defaultBranch: "main", buildCommand: "terraform apply" } },
    ];
    for (const s of spaces) {
      await ctx.db.insert("spaces", { ...s, createdAt: now });
    }
    return "seeded";
  },
});
