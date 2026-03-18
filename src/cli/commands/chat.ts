import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { GoogleGenAI, Type } from "@google/genai";
import { getEnvVar, setEnvVar } from "../auth.js";
import { log } from "../../utils/logger.js";
import { execSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, resolve, relative, extname } from "node:path";
import { createServer } from "node:net";

// ── Tool definitions for Gemini ──

const tools = [
  {
    name: "read_file",
    description: "Read a file from disk. Returns content with line numbers.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "File path (relative to cwd)" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file. Creates directories if needed.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "File path" },
        content: { type: Type.STRING, description: "File content" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "run_command",
    description: "Execute a shell command. Returns stdout, stderr, exit code. Use cwd to set working directory.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        command: { type: Type.STRING, description: "Command to run" },
        cwd: { type: Type.STRING, description: "Working directory (optional)" },
      },
      required: ["command"],
    },
  },
  {
    name: "list_directory",
    description: "List files and directories at a path.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "Directory path (default: cwd)" },
      },
    },
  },
  {
    name: "edit_file",
    description: "Replace text in a file. old_text must match exactly.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "File path" },
        old_text: { type: Type.STRING, description: "Text to find" },
        new_text: { type: Type.STRING, description: "Replacement text" },
      },
      required: ["path", "old_text", "new_text"],
    },
  },
  {
    name: "search_content",
    description: "Search for text patterns in files (like grep).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        pattern: { type: Type.STRING, description: "Search pattern" },
        path: { type: Type.STRING, description: "Directory to search in" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "start_server",
    description: "Start a dev server in background. Returns immediately.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        command: { type: Type.STRING, description: "Command (e.g., npm run dev)" },
        cwd: { type: Type.STRING, description: "Working directory" },
        port: { type: Type.NUMBER, description: "Port to use" },
      },
      required: ["command"],
    },
  },
  {
    name: "find_port",
    description: "Find an available port.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        startFrom: { type: Type.NUMBER, description: "Port to start from (default: 3000)" },
      },
    },
  },
  {
    name: "open_browser",
    description: "Open a URL in the default browser.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING, description: "URL to open" },
      },
      required: ["url"],
    },
  },
];

// ── Tool execution ──

const cwd = process.cwd();

function resolvePath(p: string): string {
  return resolve(cwd, p || ".");
}

function findAvailablePort(start = 3000): Promise<number> {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.listen(start, () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => res(port));
    });
    srv.on("error", () => {
      if (start < 9999) res(findAvailablePort(start + 1));
      else rej(new Error("No ports available"));
    });
  });
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "read_file": {
        const p = resolvePath(args.path as string);
        if (!existsSync(p)) return JSON.stringify({ error: `File not found: ${args.path}` });
        const content = readFileSync(p, "utf-8");
        const lines = content.split("\n").map((l, i) => `${String(i + 1).padStart(4)}  ${l}`).join("\n");
        return JSON.stringify({ content: lines, lines: content.split("\n").length });
      }

      case "write_file": {
        const p = resolvePath(args.path as string);
        const dir = join(p, "..");
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(p, args.content as string, "utf-8");
        return JSON.stringify({ message: `Written: ${args.path}` });
      }

      case "edit_file": {
        const p = resolvePath(args.path as string);
        if (!existsSync(p)) return JSON.stringify({ error: `File not found: ${args.path}` });
        const content = readFileSync(p, "utf-8");
        const oldText = args.old_text as string;
        if (!content.includes(oldText)) return JSON.stringify({ error: "Text not found in file" });
        writeFileSync(p, content.replace(oldText, args.new_text as string), "utf-8");
        return JSON.stringify({ message: `Edited: ${args.path}` });
      }

      case "run_command": {
        const cmdCwd = args.cwd ? resolvePath(args.cwd as string) : cwd;
        if (!existsSync(cmdCwd)) mkdirSync(cmdCwd, { recursive: true });
        try {
          const result = execSync(args.command as string, {
            cwd: cmdCwd,
            timeout: 120_000,
            maxBuffer: 1024 * 1024,
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "pipe"],
            shell: process.platform === "win32" ? "powershell.exe" : "/bin/bash",
          });
          return JSON.stringify({ stdout: result.slice(-3000), exitCode: 0 });
        } catch (e: unknown) {
          const err = e as { stdout?: string; stderr?: string; status?: number };
          return JSON.stringify({
            stdout: (err.stdout || "").slice(-2000),
            stderr: (err.stderr || "").slice(-2000),
            exitCode: err.status || 1,
          });
        }
      }

      case "list_directory": {
        const p = resolvePath((args.path as string) || ".");
        if (!existsSync(p)) return JSON.stringify({ error: "Directory not found" });
        const items = readdirSync(p, { withFileTypes: true })
          .filter((f) => !f.name.startsWith(".") && f.name !== "node_modules")
          .map((f) => ({ name: f.name, type: f.isDirectory() ? "dir" : "file" }));
        return JSON.stringify({ items });
      }

      case "search_content": {
        const searchDir = args.path ? resolvePath(args.path as string) : cwd;
        try {
          const result = execSync(
            `powershell -NoProfile -Command "Get-ChildItem -Recurse -File -Exclude node_modules,.git,.next | Select-String -Pattern '${(args.pattern as string).replace(/'/g, "''")}' | Select-Object -First 20 | ForEach-Object { $_.ToString() }"`,
            { cwd: searchDir, timeout: 15_000, encoding: "utf-8", maxBuffer: 512 * 1024 }
          );
          return JSON.stringify({ matches: result.split("\n").filter(Boolean).slice(0, 20) });
        } catch {
          return JSON.stringify({ matches: [] });
        }
      }

      case "start_server": {
        const serverCwd = args.cwd ? resolvePath(args.cwd as string) : cwd;
        if (!existsSync(serverCwd)) mkdirSync(serverCwd, { recursive: true });
        const port = (args.port as number) || await findAvailablePort(3000);

        // Clean Next.js lock
        const lockPath = join(serverCwd, ".next", "dev", "lock");
        if (existsSync(lockPath)) try { unlinkSync(lockPath); } catch {}

        let cmd = args.command as string;
        if (!cmd.includes("--port") && !cmd.includes("-p")) {
          if (cmd.includes("next dev") || cmd.includes("npm run dev")) cmd += ` -- --port ${port}`;
        }

        const shell = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
        const shellArgs = process.platform === "win32" ? ["/c", cmd] : ["-c", cmd];
        const child = spawn(shell, shellArgs, {
          cwd: serverCwd,
          detached: true,
          stdio: "ignore",
          env: { ...process.env, PORT: String(port) },
        });
        child.unref();

        // Wait for port
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          try {
            const res = await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(2000) });
            if (res) return JSON.stringify({ message: `Server running at http://localhost:${port}`, port, url: `http://localhost:${port}` });
          } catch {}
        }
        return JSON.stringify({ message: `Server started on port ${port} (may still be building)`, port });
      }

      case "find_port": {
        const port = await findAvailablePort((args.startFrom as number) || 3000);
        return JSON.stringify({ port });
      }

      case "open_browser": {
        const openMod = await import("open");
        await openMod.default(args.url as string);
        return JSON.stringify({ message: `Opened: ${args.url}` });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (e: unknown) {
    return JSON.stringify({ error: (e as Error).message });
  }
}

// ── System prompt ──

const SYSTEM_PROMPT = `You are Dev Agent — an autonomous AI dev agent running in a terminal. You have filesystem, terminal, git, and browser access.

## Rules
- Build web apps (HTML/JS/React/Next.js), never CLI apps with interactive prompts
- Use start_server for dev servers, run_command for everything else
- Use cwd parameter for working directory, never cd dir && command
- This is Windows — use PowerShell-compatible commands
- Use find_port before start_server
- Always npm install dependencies before writing code that uses them
- Default stack: Next.js + TypeScript + Tailwind + shadcn/ui
- Build beautiful, polished UIs — gradient text, glass cards, proper dark mode
- Never use placeholder content like "Project Title 1" or "Lorem ipsum"
- After building, use open_browser to show the result

## Style
Fast, precise, ship-focused. Show what you're doing with short status messages.`;

// ── Chat loop ──

export const chatCommand = new Command("chat")
  .description("Interactive AI dev agent in the terminal")
  .action(async () => {
    const apiKey = getEnvVar("GOOGLE_API_KEY");
    if (!apiKey) {
      const { key } = await inquirer.prompt([{
        type: "input",
        name: "key",
        message: "Enter your Google API key:",
      }]);
      setEnvVar("GOOGLE_API_KEY", key.trim());
    }

    const ai = new GoogleGenAI({ apiKey: getEnvVar("GOOGLE_API_KEY")! });

    console.log(chalk.dim("─".repeat(50)));
    console.log(chalk.bold("  Dev Agent") + chalk.dim(" · Gemini 3.1 Pro · type /quit to exit"));
    console.log(chalk.dim("─".repeat(50)));
    console.log();

    const history: Array<{ role: string; parts: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> }; functionResponse?: { name: string; response: unknown } }> }> = [];

    while (true) {
      const { input } = await inquirer.prompt([{
        type: "input",
        name: "input",
        message: chalk.hex("#F97316")("›"),
        prefix: "",
      }]);

      if (!input.trim()) continue;
      if (input.trim() === "/quit" || input.trim() === "/exit") break;

      history.push({ role: "user", parts: [{ text: input }] });

      try {
        let response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: history as Parameters<typeof ai.models.generateContent>[0]["contents"],
          config: {
            systemInstruction: SYSTEM_PROMPT,
            tools: [{ functionDeclarations: tools }],
          },
        });

        // Tool call loop
        let iterations = 0;
        while (iterations < 25) {
          const candidate = response.candidates?.[0];
          if (!candidate?.content?.parts) break;

          const parts = candidate.content.parts;
          let hasToolCall = false;

          // Show text parts
          for (const part of parts) {
            if (part.text) {
              console.log();
              console.log(chalk.white(part.text));
            }
          }

          // Handle tool calls
          const toolResponses: Array<{ functionResponse: { name: string; response: unknown } }> = [];

          for (const part of parts) {
            if (part.functionCall) {
              hasToolCall = true;
              const { name, args } = part.functionCall;
              const displayArgs = name === "write_file"
                ? `${(args as Record<string, unknown>).path} (${((args as Record<string, unknown>).content as string)?.split("\n").length || 0} lines)`
                : name === "run_command"
                  ? `$ ${(args as Record<string, unknown>).command}`
                  : JSON.stringify(args).slice(0, 80);

              console.log(chalk.dim(`\n  ⚙ ${chalk.cyan(name)} ${chalk.dim(displayArgs)}`));

              const result = await executeTool(name, args as Record<string, unknown>);
              const parsed = JSON.parse(result);

              // Show brief result
              if (parsed.error) {
                console.log(chalk.red(`    ✗ ${parsed.error}`));
              } else if (parsed.message) {
                console.log(chalk.green(`    ✓ ${parsed.message}`));
              } else if (parsed.exitCode === 0) {
                console.log(chalk.green(`    ✓ Command succeeded`));
              } else if (parsed.exitCode) {
                console.log(chalk.red(`    ✗ Exit code ${parsed.exitCode}`));
                if (parsed.stderr) console.log(chalk.dim(`    ${parsed.stderr.slice(0, 200)}`));
              }

              toolResponses.push({
                functionResponse: { name, response: parsed },
              });
            }
          }

          if (!hasToolCall) break;

          // Add assistant response + tool results to history
          history.push({ role: "model", parts: parts as typeof history[0]["parts"] });
          history.push({ role: "user", parts: toolResponses as typeof history[0]["parts"] });

          // Continue the conversation
          response = await ai.models.generateContent({
            model: "gemini-3.1-pro-preview",
            contents: history as Parameters<typeof ai.models.generateContent>[0]["contents"],
            config: {
              systemInstruction: SYSTEM_PROMPT,
              tools: [{ functionDeclarations: tools }],
            },
          });

          iterations++;
        }

        // Add final response to history
        const finalParts = response.candidates?.[0]?.content?.parts;
        if (finalParts) {
          for (const part of finalParts) {
            if (part.text) {
              console.log();
              console.log(chalk.white(part.text));
            }
          }
          history.push({ role: "model", parts: finalParts as typeof history[0]["parts"] });
        }

      } catch (e: unknown) {
        console.log(chalk.red(`\nError: ${(e as Error).message}`));
      }

      console.log();
    }

    console.log(chalk.dim("\nGoodbye!"));
  });
