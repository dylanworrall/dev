import { tool } from "ai";
import { z } from "zod";
import { executeShell } from "@/lib/executor";
import { resolveSafePath, getWorkspaceRoot } from "@/lib/workspace";
import { createServer } from "node:net";

// Only block the agent from editing its own source code
const DEV_CLIENT_PATH = "OneDrive/Desktop/dev/ui/src";

function isBlocked(command: string, cwd?: string): boolean {
  // Block any command that targets the dev client's own source
  if (cwd && cwd.includes(DEV_CLIENT_PATH)) return true;
  return false;
}

function findAvailablePort(startPort = 3000): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(startPort, () => {
      const port = (server.address() as { port: number }).port;
      server.close(() => resolve(port));
    });
    server.on("error", () => {
      if (startPort < 9999) resolve(findAvailablePort(startPort + 1));
      else reject(new Error("No available ports found"));
    });
  });
}

async function checkPort(port: number, retries = 5, delayMs = 2000): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(2000) });
      // Any response means the server is up (even 500 = app error but server runs)
      return true;
    } catch { /* not ready */ }
    if (i < retries - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

export const bashTools = {
  find_port: tool({
    description: "Find an available port on localhost. Use this before starting any server.",
    inputSchema: z.object({
      startFrom: z.number().optional().describe("Port to start searching from (default: 3000)"),
    }),
    execute: async ({ startFrom }) => {
      try {
        const port = await findAvailablePort(startFrom || 3000);
        return { message: `Port ${port} is available`, port };
      } catch (e: unknown) {
        return { message: `Failed to find port: ${(e as Error).message}` };
      }
    },
  }),

  check_port: tool({
    description: "Check if a server is running on a port and identify which project it is.",
    inputSchema: z.object({
      port: z.number().describe("Port to check"),
    }),
    execute: async ({ port }) => {
      const up = await checkPort(port, 1, 0);

      // Try to identify the project by fetching the page title
      let title = "";
      let projectDir = "";
      if (up) {
        try {
          const res = await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(3000) });
          const html = await res.text();
          title = html.match(/<title>(.*?)<\/title>/)?.[1] || "";
        } catch {}

        // Try to find the project directory from the PID
        try {
          const { executeShell } = await import("@/lib/executor");
          const netstat = await executeShell(`netstat -ano | findstr LISTENING | findstr :${port}`, { timeout: 5000 });
          const pid = netstat.stdout.trim().split(/\s+/).pop();
          if (pid) {
            const wmic = await executeShell(`powershell -Command "(Get-Process -Id ${pid}).Path"`, { timeout: 5000 });
            projectDir = wmic.stdout.trim();
          }
        } catch {}
      }

      return {
        message: up ? `Port ${port}: ${title || "running"}` : `Port ${port}: not responding`,
        port,
        responding: up,
        title: title || undefined,
        projectDir: projectDir || undefined,
        url: up ? `http://localhost:${port}` : null,
      };
    },
  }),

  start_server: tool({
    description: "Start a dev server or long-running process in the background. Returns immediately with the URL. Use this for: npm run dev, npm start, npx serve, etc. NEVER use run_command for these — it will hang forever.",
    inputSchema: z.object({
      command: z.string().describe("Command to run (e.g., 'npm run dev'). Do NOT prefix with 'cd dir &&'."),
      cwd: z.string().optional().describe("Working directory. Use this instead of 'cd dir &&'."),
      port: z.number().optional().describe("Port to use. If not given, one is auto-found."),
    }),
    execute: async ({ command, cwd, port }) => {
      const workDir = cwd ? resolveSafePath(cwd) : getWorkspaceRoot();
      const { existsSync: dirExists, mkdirSync: mkDir } = await import("node:fs");
      if (!dirExists(workDir)) mkDir(workDir, { recursive: true });
      const serverPort = port || await findAvailablePort(3000);

      // Inject port into command
      let finalCommand = command.replace(/\{port\}/g, String(serverPort));
      if (!command.includes("--port") && !command.includes("-p ")) {
        if (command.includes("next dev") || command.includes("npm run dev")) {
          finalCommand = `${command} -- --port ${serverPort}`;
        } else if (command.includes("npx serve")) {
          finalCommand = `${command} -l ${serverPort}`;
        }
      }

      try {
        const { existsSync, unlinkSync, openSync, readFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const { spawn } = await import("node:child_process");

        // Clean stale Next.js lock files
        const lockPath = join(workDir, ".next", "dev", "lock");
        if (existsSync(lockPath)) {
          try { unlinkSync(lockPath); } catch { /* ignore */ }
        }

        // Create a log file to capture errors
        const logFile = join(workDir, ".dev-server.log");
        const logFd = openSync(logFile, "w");

        // Spawn detached process with output captured to log file
        const isWindows = process.platform === "win32";
        const shell = isWindows ? "cmd.exe" : "/bin/bash";
        const shellArgs = isWindows ? ["/c", finalCommand] : ["-c", finalCommand];

        const child = spawn(shell, shellArgs, {
          cwd: workDir,
          detached: true,
          stdio: ["ignore", logFd, logFd],
          env: { ...process.env, PORT: String(serverPort) },
        });
        child.unref();

        // Wait for the port to come up
        const isUp = await checkPort(serverPort, 10, 2000);

        if (isUp) {
          return {
            message: `Server running at http://localhost:${serverPort}`,
            port: serverPort,
            url: `http://localhost:${serverPort}`,
            status: "running",
            pid: child.pid,
          };
        }

        // Server didn't come up — read the log to find out why
        let errorLog = "";
        try {
          errorLog = readFileSync(logFile, "utf-8").slice(-2000);
        } catch { /* ignore */ }

        return {
          message: `Server failed to start on port ${serverPort}`,
          port: serverPort,
          status: "failed",
          error: errorLog || "No output captured. The process may have crashed immediately.",
          suggestion: "Read the error above and fix the issue. Common problems: missing dependencies (run npm install), build errors in code, or port conflicts.",
        };
      } catch (e: unknown) {
        return { message: `Failed to start server: ${(e as Error).message}` };
      }
    },
  }),

  run_command: tool({
    description: "Execute a shell command and wait for it to finish. Do NOT use for dev servers — use start_server instead. Use the 'cwd' parameter for working directory, NOT 'cd dir &&'.",
    inputSchema: z.object({
      command: z.string().describe("Shell command. Do NOT prefix with 'cd dir &&'. Do NOT use for dev servers."),
      cwd: z.string().optional().describe("Working directory (relative to workspace root). Use this instead of 'cd dir &&'."),
      timeout: z.number().optional().describe("Timeout in ms (default: 60000, max: 300000)"),
    }),
    execute: async ({ command, cwd, timeout }) => {
      if (isBlocked(command, cwd)) {
        return { message: "Blocked: cannot modify the dev client's own source code from the UI." };
      }
      const workDir = cwd ? resolveSafePath(cwd) : getWorkspaceRoot();
      // Ensure directory exists
      const { existsSync, mkdirSync } = await import("node:fs");
      if (!existsSync(workDir)) {
        mkdirSync(workDir, { recursive: true });
      }
      const execTimeout = Math.min(timeout || 60_000, 300_000);
      const result = await executeShell(command, { cwd: workDir, timeout: execTimeout });
      return {
        message: result.timedOut
          ? `Command timed out after ${execTimeout / 1000}s`
          : result.exitCode === 0
            ? "Command succeeded"
            : `Command failed (exit code ${result.exitCode})`,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        timedOut: result.timedOut,
      };
    },
  }),

  run_code: tool({
    description: "Execute code in a specific language. For interactive apps, build a web UI instead.",
    inputSchema: z.object({
      language: z.enum(["javascript", "typescript", "python", "bash"]).describe("Programming language"),
      code: z.string().describe("Code to execute. Must run non-interactively."),
      timeout: z.number().optional().describe("Timeout in ms (default: 30000)"),
    }),
    execute: async ({ language, code, timeout }) => {
      const execTimeout = Math.min(timeout || 30_000, 120_000);
      const tmpDir = process.platform === "win32" ? process.env.TEMP || "C:\\Temp" : "/tmp";
      const langConfig: Record<string, { ext: string; cmd: string }> = {
        javascript: { ext: ".js", cmd: "node" },
        typescript: { ext: ".ts", cmd: "npx tsx" },
        python: { ext: ".py", cmd: "python3" },
        bash: { ext: ".sh", cmd: "bash" },
      };
      const config = langConfig[language];
      const filename = `dev_exec_${Date.now()}${config.ext}`;
      const filepath = `${tmpDir}/${filename}`;
      const { writeFile, unlink } = await import("node:fs/promises");
      await writeFile(filepath, code, "utf-8");
      try {
        const result = await executeShell(`${config.cmd} "${filepath}"`, {
          cwd: getWorkspaceRoot(),
          timeout: execTimeout,
        });
        return {
          message: result.exitCode === 0 ? `${language} code executed` : `Execution failed (exit ${result.exitCode})`,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          timedOut: result.timedOut,
        };
      } finally {
        try { await unlink(filepath); } catch { /* ignore */ }
      }
    },
  }),
};
