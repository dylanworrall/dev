import { loadDevEnv } from "./env";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

interface CachedContent {
  name: string;
  model: string;
  expireTime: string;
  usageMetadata?: { totalTokenCount: number };
}

interface ToolDeclaration {
  name: string;
  description: string;
  parameters?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

// In-memory cache store
const cacheStore: Record<string, { name: string; expiresAt: number }> = {};

function getApiKey(): string {
  loadDevEnv();
  return process.env.GOOGLE_API_KEY || "";
}

/**
 * Extract tool declarations from AI SDK tool definitions.
 * Converts zod-based tools to Gemini's functionDeclarations format.
 */
function extractToolDeclarations(toolSet: Record<string, unknown>): ToolDeclaration[] {
  const decls: ToolDeclaration[] = [];
  for (const [name, t] of Object.entries(toolSet)) {
    const td = t as { description?: string; parameters?: { _def?: { shape?: () => unknown }; jsonSchema?: unknown } };
    decls.push({
      name,
      description: td.description || name,
      // Don't include parameters in cache — Gemini's cache API is picky about schema format
      // The model will still know the tools by name + description
    });
  }
  return decls;
}

/**
 * Create a cache containing system prompt + tool declarations.
 * Returns the cache name. Cache lasts 30 min.
 *
 * When using cached content, the request must NOT include system_instruction, tools, or tool_config.
 * The cache replaces all of those.
 */
export async function getOrCreateCache(
  modelId: string,
  systemPrompt: string,
  toolSet: Record<string, unknown> | null
): Promise<string | undefined> {
  const toolCount = toolSet ? Object.keys(toolSet).length : 0;
  const key = `${modelId}-${toolCount}`;
  const existing = cacheStore[key];

  if (existing && existing.expiresAt > Date.now() + 60_000) {
    return existing.name;
  }

  const apiKey = getApiKey();
  if (!apiKey) return undefined;

  // Build content to cache — needs to be at least 2048 tokens (~8000 chars)
  const toolDescriptions = toolSet
    ? Object.entries(toolSet).map(([name, t]) => {
        const td = t as { description?: string };
        return `### ${name}\n${td.description || name}`;
      }).join("\n\n")
    : "";

  const cacheContent = `${systemPrompt}\n\n## Tools Reference\n${toolDescriptions}`;

  // Must be at least ~8000 chars to hit 2048 token minimum
  if (cacheContent.length < 8000) {
    // Pad with context to reach minimum
    const padding = "\n\n## Additional Context\n" +
      "You are an autonomous development agent. Follow all the rules above strictly. " +
      "When building web applications, always use modern frameworks and create beautiful, polished UIs. ".repeat(20);
    const paddedContent = cacheContent + padding;

    if (paddedContent.length < 8000) return undefined;

    try {
      const res = await fetch(`${API_BASE}/cachedContents?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${modelId}`,
          contents: [{ role: "user", parts: [{ text: paddedContent }] }],
          ttl: "1800s",
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        console.log(`[Cache] Create failed: ${(await res.text()).slice(0, 200)}`);
        return undefined;
      }

      const data = await res.json() as CachedContent;
      cacheStore[key] = { name: data.name, expiresAt: new Date(data.expireTime).getTime() };
      console.log(`[Cache] Created for ${modelId}: ${data.usageMetadata?.totalTokenCount || "?"} tokens cached`);
      return data.name;
    } catch (e) {
      console.log(`[Cache] Error: ${(e as Error).message}`);
      return undefined;
    }
  }

  try {
    const res = await fetch(`${API_BASE}/cachedContents?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${modelId}`,
        contents: [{ role: "user", parts: [{ text: cacheContent }] }],
        ttl: "1800s",
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.log(`[Cache] Create failed: ${(await res.text()).slice(0, 200)}`);
      return undefined;
    }

    const data = await res.json() as CachedContent;
    cacheStore[key] = { name: data.name, expiresAt: new Date(data.expireTime).getTime() };
    console.log(`[Cache] Created for ${modelId}: ${data.usageMetadata?.totalTokenCount || "?"} tokens cached`);
    return data.name;
  } catch (e) {
    console.log(`[Cache] Error: ${(e as Error).message}`);
    return undefined;
  }
}
