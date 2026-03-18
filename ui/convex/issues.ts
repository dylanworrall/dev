import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: {
    status: v.optional(v.string()),
    repoId: v.optional(v.string()),
    projectId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let results = await ctx.db.query("issues").order("desc").collect();
    if (args.status) results = results.filter((i) => i.status === args.status);
    if (args.repoId) results = results.filter((i) => i.repoId === args.repoId);
    if (args.projectId) results = results.filter((i) => i.projectId === args.projectId);
    return results;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(v.string()),
    labels: v.optional(v.array(v.string())),
    assignee: v.optional(v.string()),
    repoId: v.optional(v.string()),
    projectId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("issues", {
      title: args.title,
      description: args.description || "",
      status: "open",
      priority: (args.priority as any) || "medium",
      labels: args.labels || [],
      assignee: args.assignee || "",
      comments: [],
      repoId: args.repoId,
      projectId: args.projectId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("issues").first();
    if (existing) return "already seeded";

    const now = new Date().toISOString();
    await ctx.db.insert("issues", {
      title: "Fix mobile responsive layout",
      description: "Navigation breaks on screens under 768px",
      status: "open",
      priority: "high",
      labels: ["bug", "frontend"],
      assignee: "",
      comments: [],
      createdAt: now,
      updatedAt: now,
    });
    return "seeded";
  },
});
