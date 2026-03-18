import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { allTools } from "@/lib/ai/tools";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { loadDevEnv } from "@/lib/env";
import { getOrCreateCache } from "@/lib/gemini-cache";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";

// Track rate-limited models so we don't waste requests
const rateLimitedUntil: Record<string, number> = {};

// ── Minimal tool sets — send as few tools as possible ──
const TOOL_SETS: Record<string, string[]> = {
  chat: [], // No tools — just conversation
  ask: ["ask_user"], // Just asking questions
  plan: ["ask_user", "plan", "mark_complete", "create_project"],
  build: ["spawn_claude", "spawn_codex", "read_file", "list_directory", "run_command", "start_server", "find_port", "scaffold_project", "take_screenshot", "open_browser", "create_project", "resume_project", "update_plan"],
  git: ["git_status", "git_diff", "git_commit", "git_push", "git_init"],
  github: ["create_pr", "review_pr", "list_issues", "create_issue"],
  memory: ["remember", "recall", "resume_project"],
};

const INTENT_PATTERNS: Array<{ pattern: RegExp; sets: string[] }> = [
  { pattern: /^(hi|hello|hey|sup|yo|what's up|how are you|thanks|thank you|ok|okay|cool|nice|great|got it)\b/i, sets: ["chat"] },
  { pattern: /\b(build|create|make|scaffold|app|website|site|project|portfolio|landing)\b/i, sets: ["plan", "build", "memory"] },
  { pattern: /\b(fix|edit|change|modify|update|redesign|improve|add|remove|replace)\b/i, sets: ["build"] },
  { pattern: /\b(run|install|npm|node|start|serve|test|lint)\b/i, sets: ["build"] },
  { pattern: /\b(commit|push|pull|branch|merge|git|diff)\b/i, sets: ["build", "git"] },
  { pattern: /\b(pr|pull request|issue|review|github|repo)\b/i, sets: ["build", "github"] },
  { pattern: /\b(deploy|netlify|vercel|fly|ship|launch)\b/i, sets: ["build"] },
  { pattern: /\b(remember|recall|resume|continue|pick up)\b/i, sets: ["build", "memory"] },
  { pattern: /\b(search|find|look|web|fetch|browse)\b/i, sets: ["build"] },
];

function selectMinimalTools(messages: unknown[]): Record<string, unknown> | null {
  const recentText = (messages as Array<{ role: string; content: unknown }>)
    .slice(-3)
    .map((m) => typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.map((p: { text?: string }) => p.text || "").join(" ") : "")
    .join(" ");

  // Check if any tools were used recently — keep those sets active
  const usedTools = new Set<string>();
  for (const msg of (messages as Array<{ role: string; parts?: Array<{ type?: string }> }>).slice(-4)) {
    if (msg.parts) {
      for (const p of msg.parts) {
        if (p.type && String(p.type).startsWith("tool-")) {
          // Tool was used, we need build tools
          usedTools.add("build");
        }
      }
    }
  }

  const activeSets = new Set<string>(usedTools);

  for (const { pattern, sets } of INTENT_PATTERNS) {
    if (pattern.test(recentText)) {
      for (const s of sets) activeSets.add(s);
    }
  }

  // If only "chat" intent, return null (no tools)
  if (activeSets.size === 0 || (activeSets.size === 1 && activeSets.has("chat"))) {
    return null;
  }

  const toolNames = new Set<string>();
  for (const setName of activeSets) {
    for (const name of TOOL_SETS[setName] || []) {
      toolNames.add(name);
    }
  }

  return Object.fromEntries(
    Object.entries(allTools).filter(([name]) => toolNames.has(name))
  );
}

// ── System prompt cache ──
let cachedPrompt: { text: string; ts: number } | null = null;
async function getSystemPrompt(): Promise<string> {
  if (cachedPrompt && Date.now() - cachedPrompt.ts < 120_000) return cachedPrompt.text;
  const text = await buildSystemPrompt();
  cachedPrompt = { text, ts: Date.now() };
  return text;
}

// ── Main handler ──
export async function POST(req: Request) {
  loadDevEnv(true);

  const body = await req.json();
  const messages = body.messages || [];
  if (!messages.length) {
    return Response.json({ error: "No messages provided" }, { status: 400 });
  }

  // Credits
  const userEmail = body.userEmail as string | undefined;
  if (isConvexMode() && userEmail) {
    const convex = getConvexClient();
    if (convex) {
      const credits = await convex.query(api.users.getCredits, { email: userEmail });
      if (credits < 1) return Response.json({ error: "Insufficient credits." }, { status: 402 });
      await convex.mutation(api.users.deductCredits, { email: userEmail, amount: 1 });
    }
  }

  const googleApiKey = process.env.GOOGLE_API_KEY;
  if (!googleApiKey) {
    return Response.json({ error: "No Google API key configured." }, { status: 400 });
  }

  const google = createGoogleGenerativeAI({ apiKey: googleApiKey });
  const systemPrompt = await getSystemPrompt();

  // ── AGGRESSIVE context management ──
  // 1. Keep only last 6 messages
  let finalMessages = messages.slice(-6);

  // 2. Strip tool outputs completely — model reads files fresh when needed
  finalMessages = finalMessages.map((m: Record<string, unknown>) => {
    if (m.role === "assistant" && Array.isArray(m.parts)) {
      return {
        ...m,
        parts: (m.parts as Array<Record<string, unknown>>).map((p) => {
          if (p.type && String(p.type).startsWith("tool-")) {
            return { ...p, output: { done: true } };
          }
          if (p.type === "text" && typeof p.text === "string" && (p.text as string).length > 1500) {
            return { ...p, text: (p.text as string).slice(-1500) };
          }
          return p;
        }),
      };
    }
    if (m.role === "user" && Array.isArray(m.parts)) {
      return {
        ...m,
        parts: (m.parts as Array<Record<string, unknown>>).map((p) => {
          if (p.type === "text" && typeof p.text === "string" && (p.text as string).length > 800) {
            return { ...p, text: (p.text as string).slice(-800) };
          }
          return p;
        }),
      };
    }
    return m;
  });

  const modelMessages = await convertToModelMessages(finalMessages);

  // ── Step limiting ──
  const hasToolResults = messages.some((m: { role: string; parts?: Array<{ type: string }> }) =>
    m.role === "assistant" && m.parts?.some((p: { type: string }) => p.type?.startsWith("tool-"))
  );
  const isFirstFewMessages = messages.filter((m: { role: string }) => m.role === "user").length <= 1;
  const maxSteps = (isFirstFewMessages && !hasToolResults) ? 2 : 20;

  // ── Model selection with fallback ──
  const allowedModels = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-3.1-pro-preview"];
  const cookieModel = req.headers.get("cookie")?.split(";").map(c => c.trim()).find(c => c.startsWith("dev-model="))?.split("=")[1];
  const primaryModel = (cookieModel && allowedModels.includes(cookieModel))
    ? cookieModel
    : process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

  const fallbackChain = primaryModel === "gemini-3.1-pro-preview"
    ? ["gemini-3.1-pro-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"]
    : primaryModel === "gemini-2.5-flash"
      ? ["gemini-2.5-flash", "gemini-2.5-flash-lite"]
      : ["gemini-2.5-flash-lite"];

  // ── Select minimal tools ──
  const selectedTools = selectMinimalTools(modelMessages);
  const hasTools = selectedTools && Object.keys(selectedTools).length > 0;

  // ── Try each model in fallback chain ──
  for (let i = 0; i < fallbackChain.length; i++) {
    const modelName = fallbackChain[i];
    const isLast = i === fallbackChain.length - 1;

    // Check if model is known to be rate-limited (avoid wasting requests on ping checks)
    if (!isLast && rateLimitedUntil[modelName] && rateLimitedUntil[modelName] > Date.now()) {
      console.log(`[Chat] ${modelName} rate-limited for ${Math.round((rateLimitedUntil[modelName] - Date.now()) / 60000)}min, skipping`);
      continue;
    }

    try {
      const result = streamText({
        model: google(modelName),
        system: systemPrompt,
        messages: modelMessages,
        ...(hasTools ? { tools: selectedTools as typeof allTools, stopWhen: stepCountIs(maxSteps) } : {}),
        maxRetries: 0,
        onError: (error) => {
          const msg = String((error as { error?: unknown }).error || error);
          if (msg.includes("429") || msg.includes("exhausted") || msg.includes("quota")) {
            // Parse retry delay if available
            const retryMatch = msg.match(/retry in (\d+)h?(\d+)?m?(\d+)?s/i);
            let retryMs = 60_000; // default 1 min
            if (retryMatch) {
              const h = parseInt(retryMatch[1]) || 0;
              const m = parseInt(retryMatch[2]) || 0;
              const s = parseInt(retryMatch[3]) || 0;
              retryMs = (h * 3600 + m * 60 + s) * 1000;
            }
            rateLimitedUntil[modelName] = Date.now() + retryMs;
            console.log(`[Chat] ${modelName} rate limited for ${Math.round(retryMs / 60000)}min`);
          } else if (msg.includes("503") || msg.includes("UNAVAILABLE")) {
            rateLimitedUntil[modelName] = Date.now() + 30_000; // 30s for server errors
            console.log(`[Chat] ${modelName} unavailable`);
          } else {
            console.error(`[Chat ${modelName}]`, msg.slice(0, 200));
          }
        },
      });
      return result.toUIMessageStreamResponse();
    } catch {
      if (isLast) break;
      console.log(`[Chat] ${modelName} failed, trying next`);
    }
  }

  return Response.json({ error: "All models busy. Wait 30 seconds and try again." }, { status: 429 });
}
