import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { projectId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.projectId) {
      return await ctx.db
        .query("audits")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .order("desc")
        .collect();
    }
    return await ctx.db.query("audits").order("desc").collect();
  },
});

export const getById = query({
  args: { id: v.id("audits") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const add = mutation({
  args: {
    url: v.string(),
    source: v.union(v.literal("lighthouse"), v.literal("pagespeed")),
    scores: v.object({
      performance: v.number(),
      seo: v.number(),
      accessibility: v.number(),
      bestPractices: v.number(),
    }),
    issues: v.array(v.any()),
    coreWebVitals: v.optional(v.any()),
    projectId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("audits", {
      ...args,
      timestamp: new Date().toISOString(),
    });
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("audits").first();
    if (existing) return "already seeded";

    await ctx.db.insert("audits", {
      url: "https://example.com",
      timestamp: new Date().toISOString(),
      source: "pagespeed",
      scores: { performance: 85, seo: 92, accessibility: 88, bestPractices: 90 },
      issues: [
        { id: "1", title: "Reduce unused CSS", description: "Remove dead rules from stylesheets", score: null, priority: "medium", category: "performance" },
      ],
    });
    return "seeded";
  },
});
