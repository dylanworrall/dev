import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("projects").order("desc").collect();
  },
});

export const getById = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    url: v.string(),
    client: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("projects", {
      name: args.name,
      url: args.url,
      client: args.client,
      notes: args.notes || "",
      auditIds: [],
      crawlIds: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("projects").first();
    if (existing) return "already seeded";

    const now = new Date().toISOString();
    await ctx.db.insert("projects", {
      name: "Company Website",
      url: "https://example.com",
      client: "Internal",
      notes: "Main company website audit",
      auditIds: [],
      crawlIds: [],
      createdAt: now,
      updatedAt: now,
    });
    return "seeded";
  },
});
