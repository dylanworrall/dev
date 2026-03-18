import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

const DEFAULTS = {
  anthropicModel: "claude-sonnet-4-20250514",
  defaultCategories: ["performance", "seo", "accessibility", "best-practices"],
  crawlMaxPages: 50,
  crawlRateLimit: 1000,
  respectRobotsTxt: true,
};

export const get = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("settings").collect();
    const settings: Record<string, unknown> = { ...DEFAULTS };
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return settings;
  },
});

export const update = mutation({
  args: { updates: v.any() },
  handler: async (ctx, args) => {
    const entries = Object.entries(args.updates as Record<string, unknown>);
    for (const [key, value] of entries) {
      const existing = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { value });
      } else {
        await ctx.db.insert("settings", { key, value });
      }
    }
    return args.updates;
  },
});
