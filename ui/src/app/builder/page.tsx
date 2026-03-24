"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Terminal } from "@/components/builder/Terminal";
import { Preview } from "@/components/builder/Preview";
import { FileExplorer } from "@/components/builder/FileExplorer";
import { ProgressStream } from "@/components/builder/ProgressStream";
import {
  getWebContainer,
  teardownWebContainer,
  onServerReady,
  syncEventToFS,
} from "@/lib/webcontainer";
import { runCommand, writeFiles } from "@/lib/webcontainer/fs-sync";
import type { WebContainer } from "@webcontainer/api";
import type { Terminal as XTerm } from "@xterm/xterm";
import type { AgentEvent } from "@/lib/agents/types";
import { Onboarding } from "@/components/builder/Onboarding";
import {
  Play,
  Loader2,
  MonitorSmartphone,
  FolderTree,
  TerminalSquare,
  Send,
  Bot,
  Zap,
} from "lucide-react";

type RightTab = "preview" | "files" | "terminal";
type AgentChoice = "auto" | "claude-code" | "codex";

export default function BuilderPage() {
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("builder-onboarded");
  });
  const [wc, setWc] = useState<WebContainer | null>(null);
  const [booting, setBooting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [rightTab, setRightTab] = useState<RightTab>("preview");
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [agentChoice, setAgentChoice] = useState<AgentChoice>("auto");
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Boot WebContainer on mount
  useEffect(() => {
    let cancelled = false;
    setBooting(true);

    getWebContainer().then((instance) => {
      if (!cancelled) {
        setWc(instance);
        setBooting(false);
      }
    }).catch((err) => {
      if (!cancelled) {
        setBooting(false);
        setEvents([{
          type: "task.failed",
          taskId: "boot",
          error: `WebContainer boot failed: ${err.message}. Make sure you're accessing /builder (COOP/COEP headers required).`,
          recoverable: false,
        }]);
      }
    });

    return () => {
      cancelled = true;
      teardownWebContainer();
    };
  }, []);

  // Listen for server-ready
  useEffect(() => {
    const unsub = onServerReady((_port, url) => {
      setPreviewUrl(url);
      setRightTab("preview");
      pushEvent({
        type: "preview.ready",
        taskId: "wc",
        url,
        port: _port,
      });
    });
    return unsub;
  }, []);

  // Scroll events to bottom
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const pushEvent = useCallback((event: AgentEvent) => {
    setEvents((prev) => [...prev, event]);
  }, []);

  // Sync an agent event to WebContainer
  const syncToWC = useCallback(async (event: AgentEvent) => {
    if (!wc) return;
    if (event.type === "file.created" || event.type === "file.modified" || event.type === "file.deleted") {
      await syncEventToFS(wc, event);
    }
  }, [wc]);

  // Send prompt to /api/builder, stream SSE events
  const handleSend = useCallback(async () => {
    if (!prompt.trim() || running) return;
    const text = prompt;
    setPrompt("");
    setRunning(true);

    pushEvent({ type: "task.progress", taskId: "user", message: `> ${text}` });

    try {
      const res = await fetch("/api/builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          preferredAgent: agentChoice === "auto" ? undefined : agentChoice,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        pushEvent({
          type: "task.failed",
          taskId: "api",
          error: err.error || `API error ${res.status}`,
          recoverable: true,
        });
        return;
      }

      // Parse SSE stream
      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;

          try {
            const event: AgentEvent = JSON.parse(data);
            pushEvent(event);

            // Track active agent
            if (event.type === "task.accepted") {
              setActiveAgent(event.agent);
            }

            // Sync file changes to WebContainer
            await syncToWC(event);

            // Write terminal output for commands
            if (event.type === "command.started") {
              termRef.current?.writeln(`\x1b[38;2;249;115;22m$\x1b[0m ${event.command}`);
            }
            if (event.type === "command.output") {
              termRef.current?.write(event.output);
            }

            // Clear active agent on completion
            if (event.type === "task.completed" || event.type === "task.failed") {
              setActiveAgent(null);
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (err) {
      pushEvent({
        type: "task.failed",
        taskId: "network",
        error: err instanceof Error ? err.message : "Network error",
        recoverable: true,
      });
    } finally {
      setRunning(false);
      setActiveAgent(null);
    }
  }, [prompt, running, agentChoice, pushEvent, syncToWC]);

  // Quick scaffold: creates a Vite React app inside WebContainer
  const handleScaffold = useCallback(async () => {
    if (!wc || running) return;
    setRunning(true);
    setActiveAgent("webcontainer");
    pushEvent({ type: "task.accepted", taskId: "scaffold", agent: "webcontainer" });

    try {
      await writeFiles(wc, {
        "package.json": JSON.stringify({
          name: "wc-project",
          private: true,
          type: "module",
          scripts: { dev: "vite", build: "vite build" },
          dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" },
          devDependencies: { "@vitejs/plugin-react": "^4.5.0", vite: "^6.0.0" },
        }, null, 2),
        "index.html": `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Dev</title></head>
<body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>`,
        "vite.config.js": `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });`,
        "src/main.jsx": `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nReactDOM.createRoot(document.getElementById('root')).render(<App />);`,
        "src/App.jsx": `export default function App() {\n  return (\n    <div style={{ minHeight: '100vh', background: '#050507', color: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>\n      <div style={{ textAlign: 'center' }}>\n        <h1 style={{ fontSize: '2.5rem', fontWeight: 700 }}>Dev Builder</h1>\n        <p style={{ color: '#8E8E93', marginTop: 8 }}>Edit src/App.jsx to get started</p>\n      </div>\n    </div>\n  );\n}`,
      });

      pushEvent({ type: "file.created", taskId: "scaffold", path: "package.json", content: "" });
      pushEvent({ type: "file.created", taskId: "scaffold", path: "src/App.jsx", content: "" });

      // npm install
      pushEvent({ type: "command.started", taskId: "scaffold", command: "npm install" });
      termRef.current?.writeln("\x1b[38;2;249;115;22m$\x1b[0m npm install");
      const install = await runCommand(wc, "npm", ["install"], (data) => {
        termRef.current?.write(data);
      });
      pushEvent({ type: "command.completed", taskId: "scaffold", command: "npm install", exitCode: install.exitCode });

      // npm run dev
      pushEvent({ type: "command.started", taskId: "scaffold", command: "npm run dev" });
      termRef.current?.writeln("\x1b[38;2;249;115;22m$\x1b[0m npm run dev");
      const devProc = await wc.spawn("npm", ["run", "dev"]);
      devProc.output.pipeTo(new WritableStream({
        write(data) {
          termRef.current?.write(data);
        },
      }));

      pushEvent({
        type: "task.completed",
        taskId: "scaffold",
        summary: "Vite React project scaffolded and running",
        filesChanged: ["package.json", "index.html", "vite.config.js", "src/main.jsx", "src/App.jsx"],
      });
    } catch (err) {
      pushEvent({
        type: "task.failed",
        taskId: "scaffold",
        error: err instanceof Error ? err.message : "Scaffold failed",
        recoverable: true,
      });
    } finally {
      setRunning(false);
      setActiveAgent(null);
    }
  }, [wc, running, pushEvent]);

  const tabClass = (tab: RightTab) =>
    `px-3 py-1.5 text-xs font-medium transition-colors ${
      rightTab === tab
        ? "text-accent border-b-2 border-accent"
        : "text-muted-foreground hover:text-foreground"
    }`;

  if (showOnboarding) {
    return (
      <Onboarding
        onComplete={() => {
          localStorage.setItem("builder-onboarded", "1");
          setShowOnboarding(false);
        }}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-surface-0">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 h-12 border-b border-border bg-surface-1 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center">
            <span className="text-accent font-bold text-[10px]">B</span>
          </div>
          <span className="text-sm font-semibold text-foreground">Builder</span>
        </div>

        {/* Agent selector */}
        <div className="flex items-center gap-1 ml-2">
          {(["auto", "claude-code", "codex"] as const).map((agent) => (
            <button
              key={agent}
              type="button"
              onClick={() => setAgentChoice(agent)}
              className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                agentChoice === agent
                  ? "bg-accent/15 text-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
              }`}
            >
              {agent === "auto" ? "Auto" : agent === "claude-code" ? "Claude Code" : "Codex"}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Active agent indicator */}
        {activeAgent && (
          <div className="flex items-center gap-1.5 text-xs text-accent">
            <Bot className="size-3.5 animate-pulse" />
            {activeAgent}
          </div>
        )}

        {/* Status */}
        {booting && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Booting WebContainer...
          </div>
        )}
        {wc && !booting && (
          <div className="flex items-center gap-1.5 text-xs text-accent-green">
            <div className="size-1.5 rounded-full bg-accent-green" />
            Ready
          </div>
        )}

        {/* Quick scaffold button */}
        <button
          type="button"
          disabled={!wc || running}
          onClick={handleScaffold}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40 transition-colors"
        >
          {running ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
          Scaffold
        </button>
      </div>

      {/* Main split pane */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        {/* Left panel: chat + progress */}
        <ResizablePanel defaultSize={35} minSize={20}>
          <div className="h-full flex flex-col">
            {/* Progress events */}
            <div className="flex-1 overflow-y-auto">
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 px-6">
                  <MonitorSmartphone className="size-10 opacity-20" />
                  <div className="text-center">
                    <p className="text-sm font-medium">What do you want to build?</p>
                    <p className="text-xs opacity-60 mt-1">
                      Type a prompt below or click <span className="text-accent">Scaffold</span> to start with Vite + React
                    </p>
                  </div>
                </div>
              ) : (
                <ProgressStream events={events} />
              )}
              <div ref={eventsEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder={running ? "Agent working..." : "Describe what to build..."}
                  disabled={running}
                  className="flex-1 bg-surface-1 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!prompt.trim() || running}
                  className="p-2 rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-40 transition-colors"
                >
                  {running ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </button>
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right panel: preview / files / terminal */}
        <ResizablePanel defaultSize={65} minSize={30}>
          <ResizablePanelGroup orientation="vertical">
            {/* Top: Preview or Files */}
            <ResizablePanel defaultSize={70} minSize={30}>
              <div className="h-full flex flex-col">
                {/* Tabs */}
                <div className="flex items-center border-b border-border bg-surface-1 flex-shrink-0">
                  <button type="button" onClick={() => setRightTab("preview")} className={tabClass("preview")}>
                    <span className="flex items-center gap-1.5">
                      <MonitorSmartphone className="size-3.5" />
                      Preview
                    </span>
                  </button>
                  <button type="button" onClick={() => setRightTab("files")} className={tabClass("files")}>
                    <span className="flex items-center gap-1.5">
                      <FolderTree className="size-3.5" />
                      Files
                    </span>
                  </button>
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-hidden">
                  {rightTab === "preview" && <Preview url={previewUrl} />}
                  {rightTab === "files" && <FileExplorer wc={wc} />}
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Bottom: Terminal */}
            <ResizablePanel defaultSize={30} minSize={15}>
              <div className="h-full flex flex-col">
                <div className="flex items-center px-3 py-1.5 border-b border-border bg-surface-1 flex-shrink-0">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <TerminalSquare className="size-3.5" />
                    Terminal
                  </span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <Terminal onReady={(t) => { termRef.current = t; }} />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
