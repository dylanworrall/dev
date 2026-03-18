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
  core: [
    "read_file", "write_file", "edit_file", "list_directory",
    "run_command", "start_server", "find_port", "open_browser",
    "plan", "update_plan", "mark_complete", "ask_user",
    "create_project", "resume_project", "take_screenshot",
    "remember", "recall", "scaffold_project",
  ],
  code: ["run_code", "verify", "check_port", "serve_file", "search_files", "search_content"],
  git: ["git_status", "git_diff", "git_log", "git_commit", "git_branch", "git_checkout", "git_push", "git_pull", "git_init"],
  github: ["get_pr", "list_prs", "create_pr", "review_pr", "merge_pr", "list_issues", "create_issue", "update_issue", "close_issue", "add_comment", "get_diff", "list_commits", "search_code", "get_file_content", "list_repos", "get_repo", "add_repo", "create_github_repo", "list_branches"],
  deploy: ["list_deployments", "get_deployment", "trigger_deploy", "get_deploy_logs", "rollback", "list_sites", "vercel_list_projects", "vercel_deploy", "fly_list_apps", "fly_deploy", "deployment_platforms", "deploy_and_audit", "full_pipeline"],
  audit: ["run_lighthouse", "get_pagespeed", "check_core_web_vitals", "analyze_seo", "check_meta_tags", "check_headings", "check_schema_markup", "analyze_content_seo", "check_readability", "suggest_keywords", "crawl_site", "find_broken_links", "check_redirects", "generate_sitemap", "audit_and_create_issues"],
  misc: ["web_search", "web_fetch", "get_settings", "configure_integration", "list_projects", "get_project", "create_space", "list_spaces", "get_space", "read_memory", "update_memory", "get_preferences", "update_preferences", "reflect"],
};

const GROUP_TRIGGERS: Record<string, RegExp> = {
  code: /\b(code|run|test|build|install|npm|node|python|typescript|verify|lint|serve)\b/i,
  git: /\b(git|commit|branch|push|pull|stash|checkout|merge|diff|init)\b/i,
  github: /\b(github|pr|pull request|issue|review|repo|repository)\b/i,
  deploy: /\b(deploy|netlify|vercel|fly\.io|rollback|pipeline|ship|launch|release|hosting)\b/i,
  audit: /\b(audit|seo|lighthouse|pagespeed|crawl|broken link|sitemap|accessibility)\b/i,
  misc: /\b(search|settings|config|memory|preference|space|workspace|web)\b/i,
};

function selectTools(messages: unknown[]): typeof allTools {
  const selected = new Set(TOOL_GROUPS.core);

  const recentText = (messages as Array<{ role: string; content: unknown }>)
    .slice(-4)
    .map((m) => typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.map((p: { text?: string }) => p.text || "").join(" ") : "")
    .join(" ");

  for (const [group, trigger] of Object.entries(GROUP_TRIGGERS)) {
    if (trigger.test(recentText)) {
      for (const name of TOOL_GROUPS[group]) selected.add(name);
    }
  }

  return Object.fromEntries(
    Object.entries(allTools).filter(([name]) => selected.has(name))
  ) as typeof allTools;
}

// Cache system prompt for 60s to avoid rebuilding every request
let cachedPrompt: { text: string; ts: number } | null = null;

async function getSystemPrompt(): Promise<string> {
  if (cachedPrompt && Date.now() - cachedPrompt.ts < 60_000) {
    return cachedPrompt.text;
  }
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

  // Compact if needed, then convert once
  let finalMessages = messages;
  if (shouldCompact(messages as Array<{ role: string; content: string }>)) {
    finalMessages = await compactMessages(messages as Array<{ role: string; content: string }>);
  }
  const modelMessages = await convertToModelMessages(finalMessages);

  // Detect if user just answered ask_user or if this is early in conversation.
  // If no tool results in history yet, limit steps so the model asks questions first.
  const hasToolResults = messages.some((m: { role: string; parts?: Array<{ type: string }> }) =>
    m.role === "assistant" && m.parts?.some((p: { type: string }) => p.type?.startsWith("tool-"))
  );
  const isFirstFewMessages = messages.filter((m: { role: string }) => m.role === "user").length <= 1;
  // For first interaction: only allow 2 steps (ask_user + text response, no execution)
  // After that: full 25 steps for building
  const maxSteps = (isFirstFewMessages && !hasToolResults) ? 2 : 25;

  try {
    const result = streamText({
      model: google("gemini-3.1-pro-preview"),
      system: systemPrompt,
      messages: modelMessages,
      tools: selectTools(modelMessages),
      stopWhen: stepCountIs(maxSteps),
      onError: (error) => console.error("[Chat Error]", error),
    });
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[Chat Route Error]", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
