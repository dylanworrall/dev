import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { GoogleGenAI, Type } from "@google/genai";
import { getEnvVar, setEnvVar } from "../auth.js";
import { execSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer } from "node:net";

const cwd = process.cwd();
const resolvePath = (p: string) => resolve(cwd, p || ".");

// ── Port helpers ──

function findAvailablePort(start = 3000): Promise<number> {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.listen(start, () => { const p = (srv.address() as { port: number }).port; srv.close(() => res(p)); });
    srv.on("error", () => start < 9999 ? res(findAvailablePort(start + 1)) : rej(new Error("No ports")));
  });
}

// ── Shell exec helper ──

function shell(cmd: string, execCwd?: string, timeout = 120_000): { stdout: string; stderr: string; exitCode: number } {
  const dir = execCwd || cwd;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  try {
    const result = execSync(cmd, {
      cwd: dir, timeout, maxBuffer: 1024 * 1024, encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32" ? "powershell.exe" : "/bin/bash",
    });
    return { stdout: result.slice(-3000), stderr: "", exitCode: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    return { stdout: (err.stdout || "").slice(-2000), stderr: (err.stderr || "").slice(-2000), exitCode: err.status || 1 };
  }
}

// ── GitHub API helper ──

async function ghFetch(path: string, method = "GET", body?: unknown): Promise<unknown> {
  const token = getEnvVar("GITHUB_TOKEN");
  if (!token) throw new Error("GITHUB_TOKEN not set. Run: dev chat, then say 'configure github'");
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  return res.status === 204 ? {} : res.json();
}

function parseRepo(name: string): { owner: string; repo: string } {
  if (name.includes("/")) { const [owner, repo] = name.split("/"); return { owner, repo }; }
  const defaultOwner = getEnvVar("GITHUB_DEFAULT_OWNER");
  if (!defaultOwner) throw new Error(`Provide owner/repo format or set GITHUB_DEFAULT_OWNER`);
  return { owner: defaultOwner, repo: name };
}

// ── Memory helpers ──

import { homedir } from "node:os";
const MEMORY_DIR = join(homedir(), ".dev-client", "memory");

function readMemory(key: string): string {
  try { return readFileSync(join(MEMORY_DIR, `${key}.md`), "utf-8"); } catch { return ""; }
}

function writeMemory(key: string, content: string): void {
  if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true });
  writeFileSync(join(MEMORY_DIR, `${key}.md`), content, "utf-8");
}

function listMemories(): string[] {
  if (!existsSync(MEMORY_DIR)) return [];
  return readdirSync(MEMORY_DIR).filter(f => f.endsWith(".md"));
}

// ── Tool definitions ──

const tools = [
  // Filesystem (6)
  { name: "read_file", description: "Read a file. Returns content with line numbers.", parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "File path relative to cwd" } }, required: ["path"] } },
  { name: "write_file", description: "Write content to a file. Creates dirs if needed.", parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING }, content: { type: Type.STRING } }, required: ["path", "content"] } },
  { name: "edit_file", description: "Replace text in a file. old_text must match exactly.", parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING }, old_text: { type: Type.STRING }, new_text: { type: Type.STRING } }, required: ["path", "old_text", "new_text"] } },
  { name: "list_directory", description: "List files and dirs at a path.", parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "Dir path (default: cwd)" } } } },
  { name: "search_files", description: "Find files by name pattern.", parameters: { type: Type.OBJECT, properties: { pattern: { type: Type.STRING }, path: { type: Type.STRING } }, required: ["pattern"] } },
  { name: "search_content", description: "Search file contents (like grep).", parameters: { type: Type.OBJECT, properties: { pattern: { type: Type.STRING }, path: { type: Type.STRING } }, required: ["pattern"] } },

  // Bash (5)
  { name: "run_command", description: "Execute a shell command. Use cwd param, not cd &&. Do NOT use for dev servers.", parameters: { type: Type.OBJECT, properties: { command: { type: Type.STRING }, cwd: { type: Type.STRING, description: "Working directory" } }, required: ["command"] } },
  { name: "run_code", description: "Execute code in JS/TS/Python/Bash.", parameters: { type: Type.OBJECT, properties: { language: { type: Type.STRING, description: "javascript|typescript|python|bash" }, code: { type: Type.STRING } }, required: ["language", "code"] } },
  { name: "start_server", description: "Start a dev server in background. Returns immediately.", parameters: { type: Type.OBJECT, properties: { command: { type: Type.STRING }, cwd: { type: Type.STRING }, port: { type: Type.NUMBER } }, required: ["command"] } },
  { name: "find_port", description: "Find an available port.", parameters: { type: Type.OBJECT, properties: { startFrom: { type: Type.NUMBER } } } },
  { name: "check_port", description: "Check if a server is responding on a port.", parameters: { type: Type.OBJECT, properties: { port: { type: Type.NUMBER } }, required: ["port"] } },

  // Git (5)
  { name: "git_status", description: "Show git working tree status.", parameters: { type: Type.OBJECT, properties: {} } },
  { name: "git_diff", description: "Show changes.", parameters: { type: Type.OBJECT, properties: { staged: { type: Type.BOOLEAN }, ref: { type: Type.STRING } } } },
  { name: "git_commit", description: "Stage files and commit.", parameters: { type: Type.OBJECT, properties: { message: { type: Type.STRING }, all: { type: Type.BOOLEAN } }, required: ["message"] } },
  { name: "git_push", description: "Push to remote.", parameters: { type: Type.OBJECT, properties: { remote: { type: Type.STRING }, branch: { type: Type.STRING }, setUpstream: { type: Type.BOOLEAN } } } },
  { name: "git_init", description: "Initialize a git repo.", parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING } } } },

  // Scaffold (1)
  { name: "scaffold_project", description: "Create a new project. Templates: nextjs-shadcn, nextjs, vite-react-tailwind, html", parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, template: { type: Type.STRING, description: "nextjs-shadcn|nextjs|vite-react-tailwind|html" }, extras: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Extra npm packages" } }, required: ["name", "template"] } },

  // Screenshot (1)
  { name: "take_screenshot", description: "Analyze a localhost page (headings, errors, structure).", parameters: { type: Type.OBJECT, properties: { url: { type: Type.STRING } }, required: ["url"] } },

  // Web (2)
  { name: "web_fetch", description: "Fetch a URL and extract text content.", parameters: { type: Type.OBJECT, properties: { url: { type: Type.STRING } }, required: ["url"] } },
  { name: "web_search", description: "Search the web (requires BRAVE_API_KEY).", parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ["query"] } },

  // Agent (4)
  { name: "plan", description: "Create a structured plan. Do NOT use for questions — use ask_user.", parameters: { type: Type.OBJECT, properties: { goal: { type: Type.STRING }, steps: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.NUMBER }, description: { type: Type.STRING } } } } }, required: ["goal", "steps"] } },
  { name: "ask_user", description: "Ask the user questions with multiple choice. Put ALL questions in one call. STOP after calling.", parameters: { type: Type.OBJECT, properties: { questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, question: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { label: { type: Type.STRING } } } } } } } }, required: ["questions"] } },
  { name: "verify", description: "Run checks: typecheck, lint, test, build.", parameters: { type: Type.OBJECT, properties: { checks: { type: Type.ARRAY, items: { type: Type.STRING } }, cwd: { type: Type.STRING } }, required: ["checks"] } },
  { name: "mark_complete", description: "Signal task is done.", parameters: { type: Type.OBJECT, properties: { summary: { type: Type.STRING } }, required: ["summary"] } },

  // Memory (2)
  { name: "remember", description: "Save to persistent memory.", parameters: { type: Type.OBJECT, properties: { key: { type: Type.STRING }, content: { type: Type.STRING } }, required: ["key", "content"] } },
  { name: "recall", description: "Search memory by keyword.", parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ["query"] } },

  // GitHub (4)
  { name: "create_pr", description: "Create a pull request on GitHub.", parameters: { type: Type.OBJECT, properties: { repoName: { type: Type.STRING, description: "owner/repo" }, title: { type: Type.STRING }, head: { type: Type.STRING }, base: { type: Type.STRING }, body: { type: Type.STRING } }, required: ["repoName", "title", "head", "base"] } },
  { name: "review_pr", description: "Fetch PR diff and post an AI review.", parameters: { type: Type.OBJECT, properties: { repoName: { type: Type.STRING }, prNumber: { type: Type.NUMBER } }, required: ["repoName", "prNumber"] } },
  { name: "list_issues", description: "List GitHub issues.", parameters: { type: Type.OBJECT, properties: { repoName: { type: Type.STRING }, state: { type: Type.STRING } }, required: ["repoName"] } },
  { name: "create_issue", description: "Create a GitHub issue.", parameters: { type: Type.OBJECT, properties: { repoName: { type: Type.STRING }, title: { type: Type.STRING }, body: { type: Type.STRING }, labels: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["repoName", "title"] } },
];

// ── Tool execution ──

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "read_file": {
        const p = resolvePath(args.path as string);
        if (!existsSync(p)) return J({ error: `Not found: ${args.path}` });
        const c = readFileSync(p, "utf-8");
        return J({ content: c.split("\n").map((l, i) => `${String(i + 1).padStart(4)}  ${l}`).join("\n"), lines: c.split("\n").length });
      }
      case "write_file": {
        const p = resolvePath(args.path as string);
        const dir = join(p, ".."); if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(p, args.content as string, "utf-8");
        return J({ message: `Written: ${args.path}` });
      }
      case "edit_file": {
        const p = resolvePath(args.path as string);
        if (!existsSync(p)) return J({ error: `Not found: ${args.path}` });
        const c = readFileSync(p, "utf-8");
        if (!c.includes(args.old_text as string)) return J({ error: "Text not found" });
        writeFileSync(p, c.replace(args.old_text as string, args.new_text as string), "utf-8");
        return J({ message: `Edited: ${args.path}` });
      }
      case "list_directory": {
        const p = resolvePath((args.path as string) || ".");
        if (!existsSync(p)) return J({ error: "Not found" });
        return J({ items: readdirSync(p, { withFileTypes: true }).filter(f => !f.name.startsWith(".") && f.name !== "node_modules").map(f => ({ name: f.name, type: f.isDirectory() ? "dir" : "file" })) });
      }
      case "search_files": {
        const dir = args.path ? resolvePath(args.path as string) : cwd;
        const r = shell(`Get-ChildItem -Recurse -File -Filter '${args.pattern}' -Exclude node_modules,.git,.next | Select-Object -First 30 -ExpandProperty FullName`, dir, 15000);
        return J({ files: r.stdout.split("\n").filter(Boolean) });
      }
      case "search_content": {
        const dir = args.path ? resolvePath(args.path as string) : cwd;
        const r = shell(`Get-ChildItem -Recurse -File -Exclude node_modules,.git,.next | Select-String -Pattern '${(args.pattern as string).replace(/'/g, "''")}' | Select-Object -First 20 | ForEach-Object { $_.ToString() }`, dir, 15000);
        return J({ matches: r.stdout.split("\n").filter(Boolean) });
      }
      case "run_command": {
        const r = shell(args.command as string, args.cwd ? resolvePath(args.cwd as string) : undefined);
        return J(r);
      }
      case "run_code": {
        const ext: Record<string, string> = { javascript: ".js", typescript: ".ts", python: ".py", bash: ".sh" };
        const cmd: Record<string, string> = { javascript: "node", typescript: "npx tsx", python: "python3", bash: "bash" };
        const lang = args.language as string;
        const tmp = join(process.env.TEMP || "/tmp", `dev_${Date.now()}${ext[lang] || ".js"}`);
        writeFileSync(tmp, args.code as string, "utf-8");
        try { const r = shell(`${cmd[lang] || "node"} "${tmp}"`); return J(r); }
        finally { try { unlinkSync(tmp); } catch {} }
      }
      case "start_server": {
        const serverCwd = args.cwd ? resolvePath(args.cwd as string) : cwd;
        if (!existsSync(serverCwd)) mkdirSync(serverCwd, { recursive: true });
        const port = (args.port as number) || await findAvailablePort(3000);
        const lock = join(serverCwd, ".next", "dev", "lock");
        if (existsSync(lock)) try { unlinkSync(lock); } catch {}
        let cmd = args.command as string;
        if (!cmd.includes("--port") && !cmd.includes("-p")) {
          if (cmd.includes("next dev") || cmd.includes("npm run dev")) cmd += ` -- --port ${port}`;
        }
        const sh = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
        const shArgs = process.platform === "win32" ? ["/c", cmd] : ["-c", cmd];
        const child = spawn(sh, shArgs, { cwd: serverCwd, detached: true, stdio: "ignore", env: { ...process.env, PORT: String(port) } });
        child.unref();
        for (let i = 0; i < 10; i++) { await new Promise(r => setTimeout(r, 2000)); try { await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(2000) }); return J({ message: `Server running at http://localhost:${port}`, port, url: `http://localhost:${port}` }); } catch {} }
        return J({ message: `Started on port ${port} (may still be building)`, port });
      }
      case "find_port": return J({ port: await findAvailablePort((args.startFrom as number) || 3000) });
      case "check_port": {
        try { await fetch(`http://localhost:${args.port}`, { signal: AbortSignal.timeout(2000) }); return J({ responding: true, port: args.port }); }
        catch { return J({ responding: false, port: args.port }); }
      }
      case "git_status": return J({ output: shell("git status -s").stdout || "(clean)" });
      case "git_diff": {
        const a = ["git", "diff"]; if (args.staged) a.push("--cached"); if (args.ref) a.push(args.ref as string);
        return J({ output: shell(a.join(" ")).stdout || "(no changes)" });
      }
      case "git_commit": {
        if (args.all) shell("git add -A");
        const r = shell(`git commit -m "${(args.message as string).replace(/"/g, '\\"')}"`);
        return J({ message: r.exitCode === 0 ? `Committed: ${args.message}` : r.stderr, exitCode: r.exitCode });
      }
      case "git_push": {
        const a = ["git", "push"]; if (args.setUpstream) a.push("-u"); a.push((args.remote as string) || "origin"); if (args.branch) a.push(args.branch as string);
        const r = shell(a.join(" "));
        return J({ message: r.exitCode === 0 ? "Pushed" : r.stderr });
      }
      case "git_init": {
        const dir = args.path ? resolvePath(args.path as string) : cwd;
        shell("git init", dir);
        shell("git add -A", dir);
        shell('git commit -m "Initial commit"', dir);
        return J({ message: `Git repo initialized at ${dir}` });
      }
      case "scaffold_project": {
        const projName = args.name as string;
        const template = args.template as string;
        const projDir = resolvePath(projName);
        if (existsSync(projDir)) return J({ message: `${projName} already exists`, path: projDir, exists: true });
        mkdirSync(projDir, { recursive: true });
        const steps: string[] = [];
        if (template === "nextjs" || template === "nextjs-shadcn") {
          shell(`npx create-next-app@latest "${projDir}" --typescript --tailwind --eslint --app --no-src-dir --no-import-alias --yes`, cwd, 120000);
          steps.push("Next.js created");
          shell("npm install -D @tailwindcss/postcss", projDir, 60000);
          // Fix postcss
          const pc = join(projDir, "postcss.config.mjs");
          if (existsSync(pc)) { const c = readFileSync(pc, "utf-8"); if (c.includes("tailwindcss") && !c.includes("@tailwindcss/postcss")) writeFileSync(pc, c.replace(/tailwindcss/g, "@tailwindcss/postcss"), "utf-8"); steps.push("Fixed postcss for Tailwind v4"); }
          if (template === "nextjs-shadcn") {
            shell("npm install class-variance-authority clsx tailwind-merge lucide-react @radix-ui/react-slot", projDir, 60000);
            shell("npm install -D tailwindcss-animate", projDir, 60000);
            const libDir = join(projDir, "lib"); if (!existsSync(libDir)) mkdirSync(libDir);
            writeFileSync(join(libDir, "utils.ts"), `import { type ClassValue, clsx } from "clsx"\nimport { twMerge } from "tailwind-merge"\n\nexport function cn(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs))\n}\n`);
            shell("npx shadcn@latest init -d -y", projDir, 60000);
            shell("npx shadcn@latest add button card input textarea badge separator -y", projDir, 60000);
            steps.push("shadcn/ui added");
          }
        } else if (template === "vite-react-tailwind") {
          shell(`npm create vite@latest "${projName}" -- --template react-ts`, cwd, 60000);
          shell("npm install", projDir, 60000);
          shell("npm install -D tailwindcss @tailwindcss/vite", projDir, 60000);
          steps.push("Vite + React + Tailwind created");
        } else if (template === "html") {
          writeFileSync(join(projDir, "index.html"), `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${projName}</title>\n<link rel="stylesheet" href="style.css">\n</head>\n<body>\n<div id="app"></div>\n<script src="script.js"></script>\n</body>\n</html>`);
          writeFileSync(join(projDir, "style.css"), `* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: system-ui, sans-serif; background: #0a0a0a; color: #fafafa; }\n`);
          writeFileSync(join(projDir, "script.js"), `console.log("Ready");\n`);
          steps.push("HTML project created");
        }
        if (args.extras) { shell(`npm install ${(args.extras as string[]).join(" ")}`, projDir, 60000); steps.push(`Installed: ${(args.extras as string[]).join(", ")}`); }
        return J({ message: `Scaffolded: ${projName}`, path: projDir, steps });
      }
      case "take_screenshot": {
        const url = args.url as string;
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
          const html = await res.text();
          const title = html.match(/<title>(.*?)<\/title>/)?.[1] || "";
          const h1s = [...html.matchAll(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi)].map(m => m[1].replace(/<[^>]+>/g, "").trim()).slice(0, 10);
          const hasError = html.includes("error") || html.includes("Error") || html.includes("Module not found");
          const bodyText = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
          return J({ title, headings: h1s, hasError, textPreview: bodyText, htmlSize: `${(html.length / 1024).toFixed(1)}KB` });
        } catch (e: unknown) { return J({ error: (e as Error).message }); }
      }
      case "web_fetch": {
        const res = await fetch(args.url as string, { headers: { "User-Agent": "DevAgent/1.0" }, signal: AbortSignal.timeout(15000) });
        const html = await res.text();
        const title = html.match(/<title>(.*?)<\/title>/)?.[1] || "";
        const text = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000);
        return J({ title, content: text });
      }
      case "web_search": {
        const key = getEnvVar("BRAVE_API_KEY");
        if (!key) return J({ error: "BRAVE_API_KEY not set" });
        const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(args.query as string)}&count=5`, { headers: { "X-Subscription-Token": key, Accept: "application/json" } });
        const data = await res.json() as { web?: { results: Array<{ title: string; url: string; description: string }> } };
        return J({ results: (data.web?.results || []).map(r => ({ title: r.title, url: r.url, snippet: r.description })) });
      }
      case "plan": return J({ message: `Plan: ${args.goal}`, steps: args.steps });
      case "ask_user": {
        // In CLI, we actually prompt the user interactively
        const questions = args.questions as Array<{ id: string; question: string; options: Array<{ label: string }> }>;
        const answers: Record<string, string> = {};
        for (const q of questions) {
          const { answer } = await inquirer.prompt([{
            type: "list",
            name: "answer",
            message: q.question,
            choices: q.options.map(o => o.label),
          }]);
          answers[q.id] = answer;
          console.log(chalk.dim(`  → ${q.id}: ${answer}`));
        }
        return J({ answers, message: Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join(", ") });
      }
      case "verify": {
        const checks = args.checks as string[];
        const checkCwd = args.cwd ? resolvePath(args.cwd as string) : cwd;
        const results: Record<string, { passed: boolean; output: string }> = {};
        for (const check of checks) {
          const cmd = check === "typecheck" ? "npx tsc --noEmit" : check === "lint" ? "npx eslint . --max-warnings 0" : check === "test" ? "npm test" : "npm run build";
          const r = shell(cmd, checkCwd);
          results[check] = { passed: r.exitCode === 0, output: (r.stdout + "\n" + r.stderr).trim().slice(-1000) };
        }
        return J({ allPassed: Object.values(results).every(r => r.passed), results });
      }
      case "mark_complete": return J({ message: `Done: ${args.summary}` });
      case "remember": { writeMemory(args.key as string, args.content as string); return J({ message: `Remembered: ${args.key}` }); }
      case "recall": {
        const q = (args.query as string).toLowerCase();
        const files = listMemories();
        const matches: Array<{ key: string; content: string }> = [];
        for (const f of files) { const c = readMemory(f.replace(".md", "")); if (c.toLowerCase().includes(q) || f.toLowerCase().includes(q)) matches.push({ key: f, content: c.slice(0, 300) }); }
        return J({ matches: matches.slice(0, 5), message: matches.length ? `${matches.length} match(es)` : "No memories found" });
      }
      case "create_pr": {
        const { owner, repo } = parseRepo(args.repoName as string);
        const pr = await ghFetch(`/repos/${owner}/${repo}/pulls`, "POST", { title: args.title, head: args.head, base: args.base, body: args.body }) as { number: number; html_url: string };
        return J({ message: `PR #${pr.number} created`, url: pr.html_url });
      }
      case "review_pr": {
        const { owner, repo } = parseRepo(args.repoName as string);
        const files = await ghFetch(`/repos/${owner}/${repo}/pulls/${args.prNumber}/files`) as Array<{ filename: string; patch?: string; additions: number; deletions: number }>;
        const diff = files.map(f => `### ${f.filename} (+${f.additions}/-${f.deletions})\n${f.patch?.slice(0, 1000) || ""}`).join("\n\n");
        return J({ message: `PR #${args.prNumber}: ${files.length} files changed`, diff: diff.slice(0, 5000) });
      }
      case "list_issues": {
        const { owner, repo } = parseRepo(args.repoName as string);
        const issues = await ghFetch(`/repos/${owner}/${repo}/issues?state=${args.state || "open"}&per_page=20`) as Array<{ number: number; title: string; state: string; labels: Array<{ name: string }> }>;
        return J({ issues: issues.filter(i => !(i as Record<string, unknown>).pull_request).map(i => ({ number: i.number, title: i.title, state: i.state, labels: i.labels.map(l => l.name) })) });
      }
      case "create_issue": {
        const { owner, repo } = parseRepo(args.repoName as string);
        const issue = await ghFetch(`/repos/${owner}/${repo}/issues`, "POST", { title: args.title, body: args.body, labels: args.labels }) as { number: number; html_url: string };
        return J({ message: `Issue #${issue.number} created`, url: issue.html_url });
      }
      case "open_browser": { const o = await import("open"); await o.default(args.url as string); return J({ message: `Opened: ${args.url}` }); }
      default: return J({ error: `Unknown tool: ${name}` });
    }
  } catch (e: unknown) { return J({ error: (e as Error).message }); }
}

const J = (o: unknown) => JSON.stringify(o);

// ── System prompt ──

const SYSTEM_PROMPT = `You are Dev Agent — an autonomous AI dev agent running in a terminal on Windows.

## Rules
- Build web apps, never CLI apps with interactive prompts
- Use start_server for dev servers, run_command for everything else
- Use cwd param, never cd dir &&
- Windows — use PowerShell-compatible commands
- find_port before start_server
- Default stack: Next.js + TypeScript + Tailwind + shadcn/ui (use scaffold_project)
- NEVER use single quotes for strings with apostrophes — use double quotes
- NEVER manually write shadcn components — use npx shadcn@latest add
- ALWAYS npm install deps before importing them
- ALWAYS create lib/utils.ts with cn() helper before using shadcn
- Use @tailwindcss/postcss not tailwindcss in postcss.config
- After building, take_screenshot to check for errors, then open_browser
- Use ask_user for ALL questions — it prompts interactively in the terminal. Put ALL questions in ONE call, then STOP.
- Build beautiful polished UIs with gradient text, glass cards, dark mode

## Style
Fast, precise, ship-focused.`;

// ── Chat loop ──

export const chatCommand = new Command("chat")
  .description("Interactive AI dev agent in the terminal")
  .action(async () => {
    let apiKey = getEnvVar("GOOGLE_API_KEY");
    if (!apiKey) {
      const { key } = await inquirer.prompt([{ type: "input", name: "key", message: "Enter your Google API key:" }]);
      setEnvVar("GOOGLE_API_KEY", key.trim());
      apiKey = key.trim();
    }

    const ai = new GoogleGenAI({ apiKey: apiKey! });

    console.log(chalk.dim("─".repeat(50)));
    console.log(chalk.bold("  Dev Agent") + chalk.dim(" · Gemini 3.1 Pro · 30 tools · /quit to exit"));
    console.log(chalk.dim("─".repeat(50)));
    console.log();

    const history: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];

    while (true) {
      const { input } = await inquirer.prompt([{ type: "input", name: "input", message: chalk.hex("#F97316")("›"), prefix: "" }]);
      if (!input.trim()) continue;
      if (input.trim() === "/quit" || input.trim() === "/exit") break;

      history.push({ role: "user", parts: [{ text: input }] });

      try {
        let response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: history as Parameters<typeof ai.models.generateContent>[0]["contents"],
          config: { systemInstruction: SYSTEM_PROMPT, tools: [{ functionDeclarations: tools }] },
        });

        let iterations = 0;
        while (iterations < 25) {
          const parts = response.candidates?.[0]?.content?.parts;
          if (!parts) break;

          let hasToolCall = false;
          for (const part of parts) { if (part.text) { console.log(); console.log(chalk.white(part.text)); } }

          const toolResponses: Array<{ functionResponse: { name: string; response: unknown } }> = [];
          for (const part of parts) {
            if (part.functionCall) {
              hasToolCall = true;
              const { name, args } = part.functionCall;
              const display = name === "write_file" ? `${(args as Record<string, unknown>).path}`
                : name === "run_command" ? `$ ${(args as Record<string, unknown>).command}`
                : name === "scaffold_project" ? `${(args as Record<string, unknown>).name} (${(args as Record<string, unknown>).template})`
                : JSON.stringify(args).slice(0, 60);

              console.log(chalk.dim(`\n  ⚙ ${chalk.cyan(name)} ${chalk.dim(display)}`));
              const result = await executeTool(name, args as Record<string, unknown>);
              const parsed = JSON.parse(result);

              if (parsed.error) console.log(chalk.red(`    ✗ ${parsed.error}`));
              else if (parsed.message) console.log(chalk.green(`    ✓ ${parsed.message}`));
              else if (parsed.exitCode === 0) console.log(chalk.green(`    ✓ OK`));
              else if (parsed.exitCode) { console.log(chalk.red(`    ✗ Exit ${parsed.exitCode}`)); if (parsed.stderr) console.log(chalk.dim(`    ${parsed.stderr.slice(0, 150)}`)); }

              // ask_user returns answers — show them
              if (name === "ask_user" && parsed.answers) {
                console.log(chalk.green(`    ✓ ${parsed.message}`));
              }

              toolResponses.push({ functionResponse: { name, response: parsed } });
            }
          }

          if (!hasToolCall) break;

          history.push({ role: "model", parts: parts as Array<Record<string, unknown>> });
          history.push({ role: "user", parts: toolResponses as Array<Record<string, unknown>> });

          response = await ai.models.generateContent({
            model: "gemini-3.1-pro-preview",
            contents: history as Parameters<typeof ai.models.generateContent>[0]["contents"],
            config: { systemInstruction: SYSTEM_PROMPT, tools: [{ functionDeclarations: tools }] },
          });
          iterations++;
        }

        const finalParts = response.candidates?.[0]?.content?.parts;
        if (finalParts) {
          for (const part of finalParts) { if (part.text) { console.log(); console.log(chalk.white(part.text)); } }
          history.push({ role: "model", parts: finalParts as Array<Record<string, unknown>> });
        }
      } catch (e: unknown) { console.log(chalk.red(`\nError: ${(e as Error).message}`)); }
      console.log();
    }
    console.log(chalk.dim("\nGoodbye!"));
  });
