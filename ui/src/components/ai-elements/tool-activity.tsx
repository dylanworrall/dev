"use client";

import { memo, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { WebPreviewInline } from "./web-preview-inline";
import { UserChoice } from "./user-choice";

// ASCII art frames for different tool categories
const TOOL_ART: Record<string, string[]> = {
  filesystem: [
    `   ╭──────╮
   │ ≡≡≡≡ │
   │ ≡≡≡  │
   │ ≡≡≡≡ │
   ╰──────╯`,
    `   ╭──────╮
   │ ▓▓▓▓ │
   │ ▓▓▓  │
   │ ▓▓▓▓ │
   ╰──────╯`,
  ],
  git: [
    `     ●
    / \\
   ●   ●
    \\ /
     ●`,
    `     ○
    / \\
   ●   ○
    \\ /
     ●`,
  ],
  code: [
    `  ┌─ λ ──┐
  │ > _   │
  │ ...   │
  └───────┘`,
    `  ┌─ λ ──┐
  │ > █   │
  │ ...   │
  └───────┘`,
  ],
  deploy: [
    `   ▲
  ╱ △ ╲
 ╱  │  ╲
╱───┼───╲
    │
    ▼`,
    `   ▲
  ╱ ▲ ╲
 ╱  │  ╲
╱───┼───╲
    │
    ●`,
  ],
  search: [
    `  ╭─╮
  │◎│──
  ╰─╯`,
    `  ╭─╮
  │◉│──
  ╰─╯`,
  ],
  web: [
    `  ┌──●──┐
  │ ╱ ╲ │
  ├─────┤
  │ ╲ ╱ │
  └──●──┘`,
    `  ┌──○──┐
  │ ╱ ╲ │
  ├─────┤
  │ ╲ ╱ │
  └──○──┘`,
  ],
  plan: [
    `  ☐ ───
  ☐ ───
  ☐ ───`,
    `  ☑ ───
  ☐ ───
  ☐ ───`,
  ],
  default: [
    `  ⚙ `,
    `  ⚙ `,
  ],
};

// Map tool names to categories
function getToolCategory(toolName: string): string {
  if (toolName.match(/read_file|write_file|edit_file|list_directory|search_files|search_content/)) return "filesystem";
  if (toolName.match(/git_|get_diff|get_pr|list_prs|create_pr|review_pr|merge_pr/)) return "git";
  if (toolName.match(/run_command|run_code|verify/)) return "code";
  if (toolName.match(/deploy|trigger_deploy|rollback|list_sites|full_pipeline/)) return "deploy";
  if (toolName.match(/search_code|web_search|web_fetch|crawl|find_broken/)) return "search";
  if (toolName.match(/audit|seo|check_|analyze|pagespeed|lighthouse/)) return "web";
  if (toolName.match(/plan|update_plan|reflect|mark_complete/)) return "plan";
  return "default";
}

// Friendly descriptions for each tool
const TOOL_DESCRIPTIONS: Record<string, string> = {
  // Filesystem
  read_file: "Reading file",
  write_file: "Writing file",
  edit_file: "Editing file",
  list_directory: "Listing directory",
  search_files: "Searching for files",
  search_content: "Searching file contents",
  // Git
  git_status: "Checking git status",
  git_diff: "Getting diff",
  git_log: "Reading commit history",
  git_commit: "Committing changes",
  git_branch: "Managing branches",
  git_checkout: "Switching branches",
  git_push: "Pushing to remote",
  git_pull: "Pulling from remote",
  git_stash: "Stashing changes",
  git_init: "Initializing repository",
  // GitHub
  get_diff: "Comparing branches on GitHub",
  get_pr: "Fetching pull request",
  list_prs: "Listing pull requests",
  create_pr: "Creating pull request",
  review_pr: "AI reviewing pull request",
  merge_pr: "Merging pull request",
  list_issues: "Listing issues",
  get_issue: "Fetching issue details",
  create_issue: "Creating issue",
  update_issue: "Updating issue",
  close_issue: "Closing issue",
  add_comment: "Adding comment",
  search_code: "Searching code on GitHub",
  get_file_content: "Fetching file from GitHub",
  list_branches: "Listing branches",
  list_commits: "Listing commits",
  list_repos: "Listing repositories",
  get_repo: "Fetching repo details",
  add_repo: "Tracking repository",
  create_github_repo: "Creating GitHub repository",
  // Code
  run_command: "Executing command",
  run_code: "Running code",
  verify: "Running verification checks",
  // Deploy
  list_deployments: "Listing deployments",
  get_deployment: "Fetching deploy details",
  trigger_deploy: "Triggering deployment",
  get_deploy_logs: "Reading deploy logs",
  rollback: "Rolling back deployment",
  list_sites: "Listing Netlify sites",
  // Orchestration
  deploy_and_audit: "Deploy + audit pipeline",
  audit_and_create_issues: "Audit + create issues",
  full_pipeline: "Full deploy pipeline",
  // Web
  run_lighthouse: "Running Lighthouse audit",
  get_pagespeed: "Checking PageSpeed",
  check_core_web_vitals: "Checking Core Web Vitals",
  analyze_seo: "Analyzing SEO",
  check_meta_tags: "Checking meta tags",
  check_headings: "Checking heading structure",
  check_schema_markup: "Checking structured data",
  analyze_content_seo: "Analyzing content SEO",
  suggest_keywords: "Suggesting keywords",
  check_readability: "Checking readability",
  crawl_site: "Crawling website",
  find_broken_links: "Finding broken links",
  check_redirects: "Checking redirects",
  generate_sitemap: "Generating sitemap",
  // Search
  web_search: "Searching the web",
  web_fetch: "Fetching web page",
  // Memory
  read_memory: "Reading memory",
  update_memory: "Updating memory",
  get_preferences: "Loading preferences",
  update_preferences: "Saving preferences",
  // Plan
  plan: "Creating plan",
  update_plan: "Updating plan",
  reflect: "Reflecting on progress",
  mark_complete: "Marking task complete",
  // Settings
  get_settings: "Loading settings",
  configure_integration: "Configuring integration",
  // Other
  open_browser: "Opening in browser",
  serve_file: "Starting file server",
  create_project: "Creating project",
  list_projects: "Listing projects",
  get_project: "Loading project",
  create_space: "Creating workspace",
  list_spaces: "Listing workspaces",
  get_space: "Loading workspace",
};

function getToolDescription(toolName: string): string {
  return TOOL_DESCRIPTIONS[toolName] || toolName.replace(/_/g, " ");
}

// Type guard for ask_user output
interface UserChoiceOutput {
  type: "user_choice";
  questions: Array<{ id: string; question: string; options: Array<{ label: string; description?: string }> }>;
}

function isUserChoiceOutput(output: unknown): output is UserChoiceOutput {
  if (!output || typeof output !== "object") return false;
  const o = output as Record<string, unknown>;
  return o.type === "user_choice" && Array.isArray(o.questions);
}

// Extract a localhost URL from tool output (for web preview)
function getOutputUrl(output: unknown): string | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;
  // Check common URL fields
  const url = (o.url as string) || (o.deployUrl as string) || null;
  if (url && url.startsWith("http://localhost")) return url;
  return null;
}

// Get a short summary from tool output
function getOutputSummary(toolName: string, output: unknown): string | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;
  if (o.message && typeof o.message === "string") return o.message;
  return null;
}

// ASCII animation component
const AsciiAnimation = memo(({ category }: { category: string }) => {
  const [frame, setFrame] = useState(0);
  const frames = TOOL_ART[category] || TOOL_ART.default;

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, 600);
    return () => clearInterval(interval);
  }, [frames.length]);

  return (
    <pre className="text-[10px] leading-[1.2] text-[#0A84FF]/70 font-mono select-none">
      {frames[frame]}
    </pre>
  );
});
AsciiAnimation.displayName = "AsciiAnimation";

// Main tool activity component — replaces raw JSON tool rendering
export const ToolActivity = memo(({
  toolName,
  state,
  input,
  output,
  errorText,
  onUserChoice,
}: {
  toolName: string;
  state: string;
  input: unknown;
  output?: unknown;
  errorText?: string;
  onUserChoice?: (choice: string) => void;
}) => {
  const category = getToolCategory(toolName);
  const description = getToolDescription(toolName);
  const isRunning = state === "input-available" || state === "input-streaming";
  const isCompleted = state === "output-available";
  const isError = state === "output-error";
  const summary = isCompleted ? getOutputSummary(toolName, output) : null;
  const outputUrl = isCompleted ? getOutputUrl(output) : null;

  // Extract key info from input for display
  const inputSummary = getInputSummary(toolName, input);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "mb-3 rounded-2xl border overflow-hidden shadow-sm",
        isRunning && "border-[#0A84FF]/30 bg-[#0A84FF]/5",
        isCompleted && "border-[#30D158]/20 bg-[#30D158]/5",
        isError && "border-[#FF453A]/20 bg-[#FF453A]/5",
        !isRunning && !isCompleted && !isError && "border-white/5 bg-[#2A2A2C]"
      )}
    >
      {/* Tool header with animation */}
      <div className="flex items-start gap-3 p-3">
        {/* ASCII art (only while running) */}
        {isRunning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-shrink-0 hidden sm:block"
          >
            <AsciiAnimation category={category} />
          </motion.div>
        )}

        {/* Status indicator dot */}
        {!isRunning && (
          <div className={cn(
            "mt-1 flex-shrink-0 w-2 h-2 rounded-full",
            isCompleted && "bg-[#30D158]",
            isError && "bg-[#FF453A]",
            !isCompleted && !isError && "bg-white/20"
          )} />
        )}

        {/* Description and details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-[13px] font-medium",
              isRunning && "text-[#0A84FF]",
              isCompleted && "text-[#30D158]",
              isError && "text-[#FF453A]",
            )}>
              {description}
              {isRunning && (
                <motion.span
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="ml-1"
                >
                  ...
                </motion.span>
              )}
            </span>
          </div>

          {/* Input summary — short contextual info */}
          {inputSummary && (
            <p className="text-[11px] text-white/40 mt-0.5 truncate">
              {inputSummary}
            </p>
          )}

          {/* Output summary */}
          <AnimatePresence>
            {summary && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="text-[11px] text-white/40 mt-1"
              >
                {summary}
              </motion.p>
            )}
            {errorText && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="text-[11px] text-[#FF453A] mt-1"
              >
                {errorText}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {isCompleted && outputUrl ? (
        <div className="px-3 pb-3">
          <WebPreviewInline url={outputUrl} title={description} />
        </div>
      ) : null}
      {isCompleted && toolName === "ask_user" && isUserChoiceOutput(output) ? (
        <div className="px-3 pb-3">
          <UserChoice
            questions={output.questions}
            onSubmit={(answers) => {
              // Format all answers into a single message
              const answerText = Object.entries(answers)
                .map(([id, label]) => `${id}: ${label}`)
                .join("\n");
              onUserChoice?.(answerText);
            }}
          />
        </div>
      ) : null}
    </motion.div>
  );
});
ToolActivity.displayName = "ToolActivity";

// Extract meaningful short info from tool input
function getInputSummary(toolName: string, input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const inp = input as Record<string, unknown>;

  switch (toolName) {
    case "read_file":
    case "write_file":
    case "edit_file":
      return inp.path as string || null;
    case "run_command":
      return `$ ${(inp.command as string)?.slice(0, 80)}` || null;
    case "run_code":
      return `${inp.language} (${((inp.code as string)?.split("\n").length || 0)} lines)`;
    case "git_commit":
      return inp.message as string || null;
    case "git_checkout":
      return inp.target as string || null;
    case "web_search":
    case "search_code":
    case "search_content":
      return `"${inp.query || inp.pattern}"`;
    case "web_fetch":
    case "open_browser":
      return inp.url as string || inp.target as string || null;
    case "create_pr":
    case "get_pr":
      return `#${inp.prNumber || ""} ${inp.title || inp.repoName || ""}`.trim();
    case "review_pr":
      return `PR #${inp.prNumber} in ${inp.repoName}`;
    case "create_issue":
      return inp.title as string || null;
    case "crawl_site":
    case "analyze_seo":
    case "run_lighthouse":
      return inp.url as string || null;
    case "plan":
      return inp.goal as string || null;
    case "update_plan":
      return `Step ${inp.stepId}: ${inp.status}`;
    case "search_files":
      return inp.pattern as string || null;
    case "list_directory":
      return inp.path as string || ".";
    case "create_github_repo":
      return inp.name as string || null;
    case "trigger_deploy":
      return inp.branch ? `branch: ${inp.branch}` : null;
    case "verify":
      return (inp.checks as string[])?.join(", ") || null;
    default:
      return null;
  }
}
