import { spawn } from "node:child_process";
import { getWorkspaceRoot } from "./workspace";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

const MAX_OUTPUT = 100_000;

/**
 * Execute a command with explicit args.
 */
export async function execute(
  command: string,
  args: string[] = [],
  options: { cwd?: string; timeout?: number; env?: Record<string, string> } = {}
): Promise<ExecResult> {
  const cwd = options.cwd || getWorkspaceRoot();
  const timeout = options.timeout || 60_000;

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const proc = spawn(command, args, {
      cwd,
      env: buildEnv(options.env),
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, timeout);

    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout: truncate(stdout), stderr: truncate(stderr), exitCode: code ?? 1, timedOut });
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ stdout: "", stderr: err.message, exitCode: 1, timedOut: false });
    });
  });
}

/**
 * Execute a shell command string.
 * Uses PowerShell on Windows for better npm/npx compatibility.
 */
export async function executeShell(
  command: string,
  options: { cwd?: string; timeout?: number; env?: Record<string, string> } = {}
): Promise<ExecResult> {
  const cwd = options.cwd || getWorkspaceRoot();
  const timeout = options.timeout || 60_000;

  // Use PowerShell on Windows — cmd.exe has issues with npm, npx, and path handling
  const isWindows = process.platform === "win32";
  const shell = isWindows ? "powershell.exe" : "/bin/bash";
  const shellArgs = isWindows
    ? ["-NoProfile", "-NonInteractive", "-Command", command]
    : ["-c", command];

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const proc = spawn(shell, shellArgs, {
      cwd,
      env: buildEnv(options.env),
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, timeout);

    proc.stdout.on("data", (d) => {
      stdout += d.toString();
      if (stdout.length > MAX_OUTPUT) { proc.kill(); }
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout: truncate(stdout), stderr: truncate(stderr), exitCode: code ?? 1, timedOut });
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ stdout: "", stderr: err.message, exitCode: 1, timedOut: false });
    });
  });
}

function buildEnv(extra?: Record<string, string>): NodeJS.ProcessEnv {
  const env = { ...process.env, ...extra };
  // Ensure npm/node are on PATH
  if (process.platform === "win32") {
    const npmPaths = [
      process.env.APPDATA ? `${process.env.APPDATA}\\npm` : "",
      process.env.ProgramFiles ? `${process.env.ProgramFiles}\\nodejs` : "",
      "C:\\Program Files\\nodejs",
    ].filter(Boolean);
    env.PATH = `${npmPaths.join(";")}${env.PATH ? `;${env.PATH}` : ""}`;
  }
  return env;
}

function truncate(str: string): string {
  if (str.length <= MAX_OUTPUT) return str;
  return str.slice(0, MAX_OUTPUT) + "\n... (truncated)";
}
