import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { allTools } from "@/lib/ai/tools";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { loadDevEnv } from "@/lib/env";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";
import { shouldCompact, compactMessages } from "@/lib/compaction";

// Tool groups — select relevant tools based on conversation
const TOOL_GROUPS: Record<string, string[]> = {
  core: ["ask_user", "plan", "mark_complete", "remember", "recall"],
  build: [
    "read_file", "write_file", "edit_file", "list_directory",
    "run_command", "start_server", "find_port", "open_browser",
    "scaffold_project", "take_screenshot", "create_project", "resume_project",
    "update_plan",
  ],
  code: ["run_code", "verify", "check_port", "serve_file", "search_files", "search_content"],
  git: ["git_status", "git_diff", "git_log", "git_commit", "git_branch", "git_checkout", "git_push", "git_pull", "git_init"],
  github: ["get_pr", "list_prs", "create_pr", "review_pr", "merge_pr", "list_issues", "create_issue", "update_issue", "close_issue", "add_comment", "get_diff", "list_commits", "search_code", "get_file_content", "list_repos", "get_repo", "add_repo", "create_github_repo", "list_branches"],
  deploy: ["list_deployments", "get_deployment", "trigger_deploy", "get_deploy_logs", "rollback", "list_sites", "vercel_list_projects", "vercel_deploy", "fly_list_apps", "fly_deploy", "deployment_platforms", "deploy_and_audit", "full_pipeline"],
  audit: ["run_lighthouse", "get_pagespeed", "check_core_web_vitals", "analyze_seo", "check_meta_tags", "check_headings", "check_schema_markup", "analyze_content_seo", "check_readability", "suggest_keywords", "crawl_site", "find_broken_links", "check_redirects", "generate_sitemap", "audit_and_create_issues"],
  misc: ["web_search", "web_fetch", "get_settings", "configure_integration", "list_projects", "get_project", "create_space", "list_spaces", "get_space", "read_memory", "update_memory", "get_preferences", "update_preferences", "reflect"],
};

const GROUP_TRIGGERS: Record<string, RegExp> = {
  build: /\b(build|create|make|scaffold|app|website|site|project|portfolio|landing|page|component|design|redesign|update|fix|edit|change|modify|write|add|implement|develop|continue|resume|finish)\b/i,
  code: /\b(code|run|test|install|npm|node|python|typescript|verify|lint|serve)\b/i,
  git: /\b(git|commit|branch|push|pull|stash|checkout|merge|diff|init)\b/i,
  github: /\b(github|pr|pull request|issue|review|repo|repository)\b/i,
  deploy: /\b(deploy|netlify|vercel|fly\.io|rollback|pipeline|ship|launch|release|hosting)\b/i,
  audit: /\b(audit|seo|lighthouse|pagespeed|crawl|broken link|sitemap|accessibility)\b/i,
  misc: /\b(search|settings|config|memory|preference|space|workspace|web)\b/i,
};

function selectTools(messages: unknown[]): typeof allTools | null {
  const selected = new Set(TOOL_GROUPS.core);

  const recentText = (messages as Array<{ role: string; content: unknown }>)
    .slice(-4)
    .map((m) => typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.map((p: { text?: string }) => p.text || "").join(" ") : "")
    .join(" ");

  let triggered = false;
  for (const [group, trigger] of Object.entries(GROUP_TRIGGERS)) {
    if (trigger.test(recentText)) {
      triggered = true;
      for (const name of TOOL_GROUPS[group]) selected.add(name);
    }
  }

  // No triggers = just chatting, don't send any tools (saves tokens)
  if (!triggered) return null;

  return Object.fromEntries(
    Object.entries(allTools).filter(([name]) => selected.has(name))
  ) as typeof allTools;
}

// Cache system prompt
let cachedPrompt: { text: string; ts: number } | null = null;
async function getSystemPrompt(): Promise<string> {
  if (cachedPrompt && Date.now() - cachedPrompt.ts < 60_000) return cachedPrompt.text;
  const text = await buildSystemPrompt();
  cachedPrompt = { text, ts: Date.now() };
  return text;
}

export async function POST(req: Request) {
  loadDevEnv(true);

  const body = await req.json();
  const messages = body.messages || [];
  if (!messages.length) {
    return Response.json({ error: "No messages provided" }, { status: 400 });
  }

  // Credits check
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

  // AGGRESSIVE context management to prevent quota exhaustion
  // 1. Keep only last 8 messages
  let finalMessages = messages.length > 8 ? messages.slice(-8) : messages;

  // 2. Strip ALL tool outputs — the model doesn't need to see old tool results
  //    It only needs the text parts to understand conversation flow
  finalMessages = finalMessages.map((m: Record<string, unknown>) => {
    if (m.role === "assistant" && Array.isArray(m.parts)) {
      return {
        ...m,
        parts: (m.parts as Array<Record<string, unknown>>).map((p) => {
          if (p.type && String(p.type).startsWith("tool-")) {
            // Keep tool name and a tiny summary, strip the full output
            const output = p.output as Record<string, unknown> | undefined;
            const message = output?.message || "done";
            return { ...p, output: { message } };
          }
          // Truncate long text parts too
          if (p.type === "text" && typeof p.text === "string" && (p.text as string).length > 2000) {
            return { ...p, text: (p.text as string).slice(-2000) };
          }
          return p;
        }),
      };
    }
    // Truncate long user messages
    if (m.role === "user" && Array.isArray(m.parts)) {
      return {
        ...m,
        parts: (m.parts as Array<Record<string, unknown>>).map((p) => {
          if (p.type === "text" && typeof p.text === "string" && (p.text as string).length > 1000) {
            return { ...p, text: (p.text as string).slice(-1000) };
          }
          return p;
        }),
      };
    }
    return m;
  });

  const modelMessages = await convertToModelMessages(finalMessages);

  // Step limiting
  const hasToolResults = messages.some((m: { role: string; parts?: Array<{ type: string }> }) =>
    m.role === "assistant" && m.parts?.some((p: { type: string }) => p.type?.startsWith("tool-"))
  );
  const isFirstFewMessages = messages.filter((m: { role: string }) => m.role === "user").length <= 1;
  const maxSteps = (isFirstFewMessages && !hasToolResults) ? 2 : 25;

  // Model selection: cookie > env var > default
  const allowedModels = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-3.1-pro-preview"];
  const cookieModel = req.headers.get("cookie")?.split(";").map(c => c.trim()).find(c => c.startsWith("dev-model="))?.split("=")[1];
  const modelName = (cookieModel && allowedModels.includes(cookieModel))
    ? cookieModel
    : process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const selectedTools = selectTools(modelMessages);
  const hasTools = selectedTools && Object.keys(selectedTools).length > 0;

  // Model fallback chain — if selected model fails, try lighter ones
  const fallbackChain = modelName === "gemini-3.1-pro-preview"
    ? ["gemini-3.1-pro-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"]
    : modelName === "gemini-2.5-flash"
      ? ["gemini-2.5-flash", "gemini-2.5-flash-lite"]
      : ["gemini-2.5-flash-lite"];

  // Test the first model with a quick ping before streaming
  for (let i = 0; i < fallbackChain.length; i++) {
    const tryModel = fallbackChain[i];
    const isLast = i === fallbackChain.length - 1;

    // Quick availability check (skip for last fallback — just try it)
    if (!isLast) {
      try {
        const testRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${tryModel}:generateContent?key=${googleApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "ok" }] }], generationConfig: { maxOutputTokens: 1 } }),
            signal: AbortSignal.timeout(5000),
          }
        );
        if (testRes.status === 429 || testRes.status === 503) {
          console.log(`[Chat] ${tryModel} unavailable (${testRes.status}), trying next`);
          continue;
        }
      } catch {
        console.log(`[Chat] ${tryModel} ping failed, trying next`);
        continue;
      }
    }

    try {
      const result = streamText({
        model: google(tryModel),
        system: systemPrompt,
        messages: modelMessages,
        ...(hasTools ? { tools: selectedTools, stopWhen: stepCountIs(maxSteps) } : {}),
        maxRetries: 0,
        onError: (error) => console.error(`[Chat ${tryModel}]`, error),
      });
      return result.toUIMessageStreamResponse();
    } catch (error) {
      console.log(`[Chat] ${tryModel} stream failed`);
      if (isLast) {
        return Response.json({ error: "All models unavailable. Wait a minute and try again." }, { status: 429 });
      }
    }
  }

  return Response.json({ error: "No models available" }, { status: 429 });
}
