import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("repos").order("desc").collect();
  },
});

export const add = mutation({
  args: {
    name: v.string(),
    fullName: v.string(),
    url: v.string(),
    language: v.string(),
    description: v.string(),
    stars: v.number(),
    lastPush: v.string(),
    defaultBranch: v.string(),
    projectId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("repos", args);
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("repos").first();
    if (existing) return "already seeded";

    await ctx.db.insert("repos", {
      name: "company-site",
      fullName: "org/company-site",
      url: "https://github.com/org/company-site",
      language: "TypeScript",
      description: "Company marketing website",
      stars: 12,
      lastPush: new Date().toISOString(),
      defaultBranch: "main",
    });
    return "seeded";
  },
});
