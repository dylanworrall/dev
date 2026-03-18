import { tool } from "ai";
import { z } from "zod";
import { generateEmbedding, generateQueryEmbedding } from "@/lib/embeddings";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";
import {
  getProjectMemory, updateProjectMemory,
  getGlobalMemory, updateGlobalMemory,
  readMemoryFile, writeMemoryFile, listMemoryFiles,
  getUserPreferences, updateUserPreferences,
} from "@/lib/memory";

export const memoryTools = {
  remember: tool({
    description: "Save something to persistent memory. Uses Gemini embeddings for semantic search later. Memory persists across conversations.",
    inputSchema: z.object({
      key: z.string().describe("Short unique key for this memory (e.g., 'user-prefers-dark-mode', 'project-soshi-stack')"),
      content: z.string().describe("The information to remember"),
      type: z.enum(["project", "global", "user", "feedback"]).describe("Memory type: project (per-project), global (across all), user (about the user), feedback (corrections/preferences)"),
      projectId: z.string().optional().describe("Associated project ID (for project-type memories)"),
    }),
    execute: async ({ key, content, type, projectId }) => {
      try {
        // Store in Convex with embedding if available
        if (isConvexMode()) {
          const convex = getConvexClient();
          if (convex) {
            let embedding: number[] | undefined;
            try {
              embedding = await generateEmbedding(content);
            } catch {
              // Embeddings optional — continue without
            }
            await convex.mutation(api.memory.store, {
              type, key, content,
              embedding: embedding || undefined,
              projectId,
            });
            return { message: `Remembered: "${key}" (stored in Convex${embedding ? " with embedding" : ""})` };
          }
        }

        // Fallback to local file
        await writeMemoryFile(`${key}.md`, `# ${key}\nType: ${type}\n\n${content}`);
        return { message: `Remembered: "${key}" (stored locally)` };
      } catch (e: unknown) {
        return { message: `Memory error: ${(e as Error).message}` };
      }
    },
  }),

  recall: tool({
    description: "Search memory semantically. Uses Gemini embeddings to find the most relevant memories based on meaning, not just keywords.",
    inputSchema: z.object({
      query: z.string().describe("What to search for in memory (natural language)"),
      type: z.enum(["project", "global", "user", "feedback", "all"]).optional().describe("Filter by memory type"),
      projectId: z.string().optional().describe("Filter to specific project"),
      limit: z.number().optional().describe("Max results (default: 5)"),
    }),
    execute: async ({ query, type, projectId, limit }) => {
      try {
        // Semantic search via Convex vector index
        if (isConvexMode()) {
          const convex = getConvexClient();
          if (convex) {
            try {
              const queryEmbedding = await generateQueryEmbedding(query);
              const results = await convex.query(api.memory.search, {
                embedding: queryEmbedding,
                limit: limit || 5,
              });

              if (results && (results as unknown[]).length > 0) {
                return {
                  message: `Found ${(results as unknown[]).length} memory(ies) matching "${query}"`,
                  memories: (results as Array<{ key: string; content: string; type: string; updatedAt: string }>).map((m) => ({
                    key: m.key,
                    content: m.content,
                    type: m.type,
                    updatedAt: m.updatedAt,
                  })),
                };
              }
            } catch {
              // Vector search failed, fall through to listing
            }

            // Fallback: list by type
            if (type && type !== "all") {
              const memories = await convex.query(api.memory.listByType, { type });
              const filtered = (memories as Array<{ key: string; content: string; type: string; updatedAt: string }>)
                .filter((m) => m.content.toLowerCase().includes(query.toLowerCase()) || m.key.toLowerCase().includes(query.toLowerCase()));
              return {
                message: `Found ${filtered.length} memory(ies) matching "${query}"`,
                memories: filtered.slice(0, limit || 5).map((m) => ({
                  key: m.key, content: m.content, type: m.type,
                })),
              };
            }
          }
        }

        // Local fallback: search memory files
        const files = await listMemoryFiles();
        const results: Array<{ key: string; content: string }> = [];
        for (const file of files) {
          const content = await readMemoryFile(file);
          if (content.toLowerCase().includes(query.toLowerCase())) {
            results.push({ key: file, content: content.slice(0, 500) });
          }
        }

        // Also check project and global memory
        const projectMem = await getProjectMemory();
        if (projectMem && projectMem.toLowerCase().includes(query.toLowerCase())) {
          results.unshift({ key: "AGENT.md", content: projectMem.slice(0, 500) });
        }

        return {
          message: results.length > 0 ? `Found ${results.length} memory(ies)` : `No memories found for "${query}"`,
          memories: results.slice(0, limit || 5),
        };
      } catch (e: unknown) {
        return { message: `Memory search error: ${(e as Error).message}` };
      }
    },
  }),

  read_memory: tool({
    description: "Read a specific memory by key, or list all memories.",
    inputSchema: z.object({
      key: z.string().optional().describe("Memory key to read"),
      type: z.enum(["project", "global", "user", "feedback", "all"]).optional().describe("List memories of this type"),
    }),
    execute: async ({ key, type }) => {
      try {
        if (key) {
          // Try Convex first
          if (isConvexMode()) {
            const convex = getConvexClient();
            if (convex) {
              const memory = await convex.query(api.memory.getByKey, { key });
              if (memory) {
                return { message: `Memory: ${key}`, memory: { key: (memory as { key: string }).key, content: (memory as { content: string }).content, type: (memory as { type: string }).type } };
              }
            }
          }
          // Local fallback
          const content = await readMemoryFile(`${key}.md`);
          return content ? { message: `Memory: ${key}`, content } : { message: `Memory "${key}" not found` };
        }

        // List all
        if (isConvexMode()) {
          const convex = getConvexClient();
          if (convex) {
            const memories = type && type !== "all"
              ? await convex.query(api.memory.listByType, { type })
              : await convex.query(api.memory.listAll, {});
            return {
              message: `${(memories as unknown[]).length} memory(ies)`,
              memories: (memories as Array<{ key: string; type: string; updatedAt: string }>).map((m) => ({
                key: m.key, type: m.type, updatedAt: m.updatedAt,
              })),
            };
          }
        }

        const files = await listMemoryFiles();
        return { message: `${files.length} memory file(s)`, files };
      } catch (e: unknown) {
        return { message: `Memory error: ${(e as Error).message}` };
      }
    },
  }),

  update_memory: tool({
    description: "Update project memory (AGENT.md) or global memory.",
    inputSchema: z.object({
      type: z.enum(["project", "global"]).describe("project = AGENT.md in workspace, global = shared across workspaces"),
      content: z.string().describe("Content to write"),
      append: z.boolean().optional().describe("Append instead of replace"),
    }),
    execute: async ({ type, content, append }) => {
      try {
        if (type === "project") {
          if (append) {
            const existing = await getProjectMemory();
            await updateProjectMemory(existing + "\n" + content);
          } else {
            await updateProjectMemory(content);
          }
          return { message: "Project memory updated (AGENT.md)" };
        }
        if (append) {
          const existing = await getGlobalMemory();
          await updateGlobalMemory(existing + "\n" + content);
        } else {
          await updateGlobalMemory(content);
        }
        return { message: "Global memory updated" };
      } catch (e: unknown) {
        return { message: `Memory error: ${(e as Error).message}` };
      }
    },
  }),

  get_preferences: tool({
    description: "Get user preferences.",
    inputSchema: z.object({}),
    execute: async () => {
      const prefs = await getUserPreferences();
      return { message: "User preferences", preferences: prefs };
    },
  }),

  update_preferences: tool({
    description: "Update user preferences.",
    inputSchema: z.object({
      preferences: z.record(z.unknown()).describe("Preferences to set/update"),
    }),
    execute: async ({ preferences }) => {
      await updateUserPreferences(preferences);
      return { message: "Preferences updated", preferences };
    },
  }),
};
