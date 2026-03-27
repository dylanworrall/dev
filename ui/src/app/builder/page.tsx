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

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || running || !wc) return;
    setRunning(true);

    pushEvent({ type: "task.progress", taskId: "user", message: `> ${text}` });

    try {
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

      pushEvent({ type: "task.progress", taskId: "context", message: "Reading project files..." });
      const projectFiles = await readProjectFiles(wc);
      const fileContext = formatFilesAsContext(projectFiles);

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

            if (event.type === "task.accepted") {
              setActiveAgent(event.agent);
            }

            await syncToWC(event);

            if (event.type === "command.started") {
              termRef.current?.writeln(`\x1b[38;2;10;132;255m$\x1b[0m ${event.command}`);
            }
            if (event.type === "command.output") {
              termRef.current?.write(event.output);
            }

            if (event.type === "task.completed" || event.type === "task.failed") {
              setActiveAgent(null);
              // Auto-refresh preview after agent finishes
              if (event.type === "task.completed") {
                setTimeout(() => {
                  const iframe = document.getElementById("wc-preview") as HTMLIFrameElement;
                  if (iframe?.src) iframe.src = iframe.src;
                }, 500);
              }
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
    <div className="h-full flex flex-col p-2 gap-2">
      {/* Status bar */}
      <div className="flex items-center justify-end gap-3 px-3 h-7 flex-shrink-0">
        {activeAgent && (
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#0A84FF]">
            <Bot size={12} className="animate-pulse" />
            {activeAgent}
          </div>
        )}
        {booting && (
          <div className="flex items-center gap-1.5 text-[11px] text-white/40">
            <Loader2 size={12} className="animate-spin" />
            Booting...
          </div>
        )}
        {wc && !booting && !running && (
          <div className="flex items-center gap-1.5 text-[11px] text-[#30D158]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#30D158]" />
            Ready
          </div>
        )}
      </div>

      {/* Main content — resizable panels */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          {/* Left: Chat */}
          <ResizablePanel defaultSize="35%" minSize="20%" maxSize="55%">
            <div className="h-full mr-1 rounded-2xl bg-[#2A2A2C] border border-white/5 shadow-sm overflow-hidden">
              <BuilderChat
                events={events}
                onSend={handleSend}
                running={running}
                activeAgent={activeAgent}
                agentChoice={agentChoice}
                onAgentChoiceChange={(c) => setAgentChoice(c as AgentChoice)}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: Preview + Terminal */}
          <ResizablePanel defaultSize="65%" minSize="30%">
            <div className="h-full ml-1">
              <ResizablePanelGroup orientation="vertical" className="h-full">
                {/* Preview / Files */}
                <ResizablePanel defaultSize="72%" minSize="25%">
                  <div className="h-full mb-1 rounded-2xl bg-[#2A2A2C] border border-white/5 shadow-sm overflow-hidden flex flex-col">
                    {/* Tabs */}
                    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setRightTab("preview")}
                        className={`flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium rounded-md transition-colors ${
                          rightTab === "preview"
                            ? "bg-[#3A3A3C] text-white shadow-sm"
                            : "text-white/40 hover:text-white hover:bg-[#3A3A3C]"
                        }`}
                      >
                        <MonitorSmartphone size={12} />
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => setRightTab("files")}
                        className={`flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium rounded-md transition-colors ${
                          rightTab === "files"
                            ? "bg-[#3A3A3C] text-white shadow-sm"
                            : "text-white/40 hover:text-white hover:bg-[#3A3A3C]"
                        }`}
                      >
                        <FolderTree size={12} />
                        Files
                      </button>
                    </div>

                    <div className="flex-1 overflow-hidden">
                      {rightTab === "preview" && <Preview url={previewUrl} />}
                      {rightTab === "files" && <FileExplorer wc={wc} />}
                    </div>
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Terminal */}
                <ResizablePanel defaultSize="28%" minSize="10%">
                  <div className="h-full mt-1 rounded-2xl bg-[#2A2A2C] border border-white/5 shadow-sm overflow-hidden flex flex-col">
                    <div className="flex items-center px-3 py-1.5 border-b border-white/5 flex-shrink-0">
                      <span className="flex items-center gap-1.5 text-[12px] font-medium text-white/40">
                        <TerminalSquare size={12} />
                        Terminal
                      </span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <Terminal onReady={(t) => { termRef.current = t; }} />
                    </div>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
