import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const store = mutation({
  args: {
    type: v.union(v.literal("project"), v.literal("global"), v.literal("user"), v.literal("feedback")),
    key: v.string(),
    content: v.string(),
    embedding: v.optional(v.array(v.float64())),
    projectId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("memory")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
        embedding: args.embedding,
        updatedAt: new Date().toISOString(),
      });
      return existing._id;
    }

    return await ctx.db.insert("memory", {
      type: args.type,
      key: args.key,
      content: args.content,
      embedding: args.embedding,
      projectId: args.projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },
});

export const getByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memory")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

export const listByType = query({
  args: { type: v.union(v.literal("project"), v.literal("global"), v.literal("user"), v.literal("feedback")) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memory")
      .withIndex("by_type", (q) => q.eq("type", args.type))
      .order("desc")
      .collect();
  },
});

export const listByProject = query({
  args: { projectId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memory")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const search = query({
  args: {
    embedding: v.array(v.float64()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Vector search on the memory table
    return await ctx.db
      .query("memory")
      .order("desc")
      .take(args.limit || 10);
    // Note: Convex vector search requires using ctx.vectorSearch in an action
    // For now, fall back to listing recent memories
  },
});

export const remove = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("memory")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return true;
    }
    return false;
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("memory").order("desc").take(100);
  },
});
