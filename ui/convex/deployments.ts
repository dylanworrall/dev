import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: {
    projectId: v.optional(v.string()),
    environment: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let results = await ctx.db.query("deployments").order("desc").collect();
    if (args.projectId) results = results.filter((d) => d.projectId === args.projectId);
    if (args.environment) results = results.filter((d) => d.environment === args.environment);
    if (args.status) results = results.filter((d) => d.status === args.status);
    return results;
  },
});

export const create = mutation({
  args: {
    projectId: v.string(),
    environment: v.string(),
    url: v.optional(v.string()),
    commitSha: v.string(),
    branch: v.string(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("deployments", {
      projectId: args.projectId,
      environment: args.environment as any,
      status: "building",
      url: args.url || "",
      commitSha: args.commitSha,
      branch: args.branch,
      logs: [`[${now}] Build started`],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("deployments").first();
    if (existing) return "already seeded";

    const now = new Date().toISOString();
    await ctx.db.insert("deployments", {
      projectId: "demo",
      environment: "production",
      status: "live",
      url: "https://example.com",
      commitSha: "abc123",
      branch: "main",
      logs: [`[${now}] Deployed successfully`],
      createdAt: now,
      updatedAt: now,
    });
    return "seeded";
  },
});
