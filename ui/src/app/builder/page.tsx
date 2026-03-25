"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Terminal } from "@/components/builder/Terminal";
import { Preview } from "@/components/builder/Preview";
import { FileExplorer } from "@/components/builder/FileExplorer";
import { BuilderChat } from "@/components/builder/BuilderChat";
import {
  getWebContainer,
  teardownWebContainer,
  onServerReady,
  syncEventToFS,
  bootstrapProject,
  readProjectFiles,
  formatFilesAsContext,
} from "@/lib/webcontainer";
import type { BootstrapState } from "@/lib/webcontainer";
import type { WebContainer } from "@webcontainer/api";
import type { Terminal as XTerm } from "@xterm/xterm";
import type { AgentEvent } from "@/lib/agents/types";
import { Onboarding } from "@/components/builder/Onboarding";
import {
  Loader2,
  MonitorSmartphone,
  FolderTree,
  TerminalSquare,
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
  const [running, setRunning] = useState(false);
  const [agentChoice, setAgentChoice] = useState<AgentChoice>("auto");
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>("idle");
  const termRef = useRef<XTerm | null>(null);

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
  // Auto-scaffolds on first prompt if not already bootstrapped.
  // Reads current WebContainer files and sends them as context.
  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || running || !wc) return;
    setRunning(true);

    pushEvent({ type: "task.progress", taskId: "user", message: `> ${text}` });

    try {
      // Auto-scaffold if this is the first prompt
      if (!bootstrapped) {
        pushEvent({ type: "task.progress", taskId: "scaffold", message: "Scaffolding project first..." });
        await bootstrapProject(wc, {
          onStateChange: (state) => {
            setBootstrapState(state);
            if (state === "ready") setBootstrapped(true);
          },
          onTerminalOutput: (data) => termRef.current?.write(data),
        });
        pushEvent({ type: "task.progress", taskId: "scaffold", message: "Project ready, sending to agent..." });
      }

      // Read current project files for context
      pushEvent({ type: "task.progress", taskId: "context", message: "Reading project files..." });
      const projectFiles = await readProjectFiles(wc);
      const fileContext = formatFilesAsContext(projectFiles);

      // Send prompt + file context to agent
      const res = await fetch("/api/builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          fileContext,
          files: projectFiles,
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
  }, [running, wc, agentChoice, bootstrapped, pushEvent, syncToWC]);

  // Bootstrap project in WebContainer using the template system
  const handleScaffold = useCallback(async () => {
    if (!wc || running || bootstrapped) return;
    setRunning(true);
    setActiveAgent("webcontainer");
    pushEvent({ type: "task.accepted", taskId: "scaffold", agent: "webcontainer" });

    try {
      await bootstrapProject(wc, {
        onStateChange: (state) => {
          setBootstrapState(state);
          const labels: Record<string, string> = {
            "writing-files": "Writing template files...",
            installing: "Installing dependencies...",
            "starting-server": "Starting dev server...",
            ready: "Project ready",
            error: "Bootstrap failed",
          };
          if (labels[state]) {
            pushEvent({ type: "task.progress", taskId: "scaffold", message: labels[state] });
          }
          if (state === "ready") {
            setBootstrapped(true);
          }
        },
        onTerminalOutput: (data) => {
          termRef.current?.write(data);
        },
      });

      pushEvent({
        type: "task.completed",
        taskId: "scaffold",
        summary: "Vite + React + Tailwind project ready",
        filesChanged: ["package.json", "index.html", "vite.config.js", "src/main.jsx", "src/App.jsx", "src/index.css"],
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
  }, [wc, running, bootstrapped, pushEvent]);

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
      <div className="flex items-center gap-3 px-4 h-11 border-b border-border bg-surface-1/80 backdrop-blur flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-accent/15 flex items-center justify-center">
            <Zap className="size-3.5 text-accent" />
          </div>
          <span className="text-sm font-semibold text-foreground">Builder</span>
        </div>

        <div className="flex-1" />

        {/* Active agent */}
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
            Booting...
          </div>
        )}
        {wc && !booting && !running && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <div className="size-1.5 rounded-full bg-emerald-400" />
            Ready
          </div>
        )}
      </div>

      {/* Main split pane */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        {/* Left panel: chat */}
        <ResizablePanel defaultSize={35} minSize={22}>
          <BuilderChat
            events={events}
            onSend={handleSend}
            running={running}
            activeAgent={activeAgent}
            agentChoice={agentChoice}
            onAgentChoiceChange={(c) => setAgentChoice(c as AgentChoice)}
          />
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
