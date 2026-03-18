import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  projects: defineTable({
    name: v.string(),
    url: v.string(),
    client: v.string(),
    notes: v.string(),
    auditIds: v.array(v.string()),
    crawlIds: v.array(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }),

  audits: defineTable({
    url: v.string(),
    timestamp: v.string(),
    source: v.union(v.literal("lighthouse"), v.literal("pagespeed")),
    scores: v.object({
      performance: v.number(),
      seo: v.number(),
      accessibility: v.number(),
      bestPractices: v.number(),
    }),
    issues: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        description: v.string(),
        score: v.union(v.number(), v.null()),
        priority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
        category: v.string(),
      })
    ),
    coreWebVitals: v.optional(
      v.object({
        lcp: v.object({ value: v.number(), rating: v.string() }),
        inp: v.object({ value: v.number(), rating: v.string() }),
        cls: v.object({ value: v.number(), rating: v.string() }),
      })
    ),
    projectId: v.optional(v.string()),
  }).index("by_projectId", ["projectId"]),

  crawls: defineTable({
    rootUrl: v.string(),
    timestamp: v.string(),
    pages: v.array(
      v.object({
        url: v.string(),
        statusCode: v.number(),
        title: v.string(),
        metaDescription: v.string(),
        wordCount: v.number(),
        internalLinks: v.array(v.string()),
        externalLinks: v.array(v.string()),
      })
    ),
    totalPages: v.number(),
    brokenLinks: v.array(
      v.object({
        url: v.string(),
        statusCode: v.number(),
        foundOn: v.string(),
        linkText: v.string(),
      })
    ),
    redirects: v.array(
      v.object({
        from: v.string(),
        to: v.string(),
        statusCode: v.number(),
        chain: v.array(v.string()),
      })
    ),
    projectId: v.optional(v.string()),
  }).index("by_projectId", ["projectId"]),

  issues: defineTable({
    title: v.string(),
    description: v.string(),
    status: v.union(v.literal("open"), v.literal("in-progress"), v.literal("closed")),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    labels: v.array(v.string()),
    assignee: v.string(),
    comments: v.array(
      v.object({
        id: v.string(),
        author: v.string(),
        body: v.string(),
        createdAt: v.string(),
      })
    ),
    repoId: v.optional(v.string()),
    projectId: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_status", ["status"])
    .index("by_projectId", ["projectId"]),

  repos: defineTable({
    name: v.string(),
    fullName: v.string(),
    url: v.string(),
    language: v.string(),
    description: v.string(),
    stars: v.number(),
    lastPush: v.string(),
    defaultBranch: v.string(),
    projectId: v.optional(v.string()),
  }),

  deployments: defineTable({
    projectId: v.string(),
    environment: v.union(v.literal("production"), v.literal("staging"), v.literal("preview"), v.literal("dev")),
    status: v.union(v.literal("building"), v.literal("deploying"), v.literal("live"), v.literal("failed"), v.literal("rolled-back")),
    url: v.string(),
    commitSha: v.string(),
    branch: v.string(),
    logs: v.array(v.string()),
    buildDuration: v.optional(v.number()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_status", ["status"]),

  chatMessages: defineTable({
    threadId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    toolCalls: v.array(
      v.object({
        id: v.string(),
        toolName: v.string(),
        input: v.any(),
        output: v.optional(v.any()),
      })
    ),
    createdAt: v.string(),
  }).index("by_thread", ["threadId"]),

  spaces: defineTable({
    name: v.string(),
    description: v.string(),
    icon: v.string(),
    settings: v.object({
      defaultEnvironment: v.string(),
      defaultBranch: v.string(),
      buildCommand: v.string(),
    }),
    createdAt: v.string(),
  }),

  activity: defineTable({
    type: v.string(),
    summary: v.string(),
    timestamp: v.string(),
    metadata: v.optional(v.any()),
  }).index("by_timestamp", ["timestamp"]),

  memory: defineTable({
    type: v.union(v.literal("project"), v.literal("global"), v.literal("user"), v.literal("feedback")),
    key: v.string(),
    content: v.string(),
    embedding: v.optional(v.array(v.float64())),
    projectId: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_type", ["type"])
    .index("by_key", ["key"])
    .index("by_project", ["projectId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["type", "projectId"],
    }),

  settings: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),

  users: defineTable({
    email: v.string(),
    name: v.string(),
    credits: v.number(),
    createdAt: v.string(),
  }).index("by_email", ["email"]),
});
