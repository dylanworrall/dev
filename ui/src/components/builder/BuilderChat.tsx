"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
} from "@/components/ai-elements/message";
import type { AgentEvent } from "@/lib/agents/types";
import {
  Bot,
  CheckCircle,
  FileCode,
  Loader2,
  MonitorSmartphone,
  Send,
  TerminalSquare,
  XCircle,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  events?: AgentEvent[];
  agent?: string;
  status?: "streaming" | "done" | "error";
}

interface BuilderChatProps {
  events: AgentEvent[];
  onSend: (prompt: string) => void;
  running: boolean;
  activeAgent: string | null;
  agentChoice: string;
  onAgentChoiceChange: (choice: string) => void;
}

function AgentEventItem({ event, done }: { event: AgentEvent; done: boolean }) {
  switch (event.type) {
    case "task.accepted":
      return (
        <div className="flex items-center gap-2 text-xs text-accent">
          <Bot className="size-3.5" />
          <span className="font-medium">{event.agent}</span>
        </div>
      );

    case "task.progress":
      if (event.message.startsWith("> ")) return null; // user messages handled separately
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {done ? <CheckCircle className="size-3 text-zinc-600" /> : <Loader2 className="size-3 animate-spin" />}
          <span>{event.message}</span>
        </div>
      );

    case "file.modified":
    case "file.created":
      return (
        <div className="flex items-center gap-2 text-xs text-emerald-400/70">
          <FileCode className="size-3" />
          <span className="font-mono">{event.path}</span>
        </div>
      );

    case "command.started":
      return (
        <div className="flex items-center gap-2 text-xs text-blue-400/70 font-mono">
          <TerminalSquare className="size-3" />
          <span>$ {event.command}</span>
        </div>
      );

    case "task.completed":
      return (
        <div className="flex items-start gap-2 text-xs text-emerald-400 mt-1">
          <CheckCircle className="size-3.5 mt-0.5 flex-shrink-0" />
          <span>{event.summary.slice(0, 300)}</span>
        </div>
      );

    case "task.failed":
      return (
        <div className="flex items-start gap-2 text-xs text-red-400 mt-1">
          <XCircle className="size-3.5 mt-0.5 flex-shrink-0" />
          <span>{event.error}</span>
        </div>
      );

    case "preview.ready":
      return (
        <div className="flex items-center gap-2 text-xs text-accent mt-1">
          <MonitorSmartphone className="size-3.5" />
          <span>Preview ready</span>
        </div>
      );

    default:
      return null;
  }
}

function collapseFileEvents(events: AgentEvent[]): AgentEvent[] {
  const fileEvents = events.filter(e => e.type === "file.modified" || e.type === "file.created");
  if (fileEvents.length <= 3) return events;

  // Replace all file events with a single summary, keep everything else
  let replacedFirst = false;
  return events.filter(e => {
    if (e.type === "file.modified" || e.type === "file.created") {
      if (!replacedFirst) {
        replacedFirst = true;
        return true; // keep first one — we'll render it as summary
      }
      return false;
    }
    return true;
  }).map(e => {
    if ((e.type === "file.modified" || e.type === "file.created") && replacedFirst) {
      return { ...e, path: `${fileEvents.length} files updated` } as typeof e;
    }
    return e;
  });
}

export function BuilderChat({
  events,
  onSend,
  running,
  activeAgent,
  agentChoice,
  onAgentChoiceChange,
}: BuilderChatProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Build chat messages from events
  const messages: ChatMessage[] = [];
  let currentAssistant: ChatMessage | null = null;

  for (const event of events) {
    // User message
    if (event.type === "task.progress" && "message" in event && event.message.startsWith("> ")) {
      // Close any open assistant message
      if (currentAssistant) {
        currentAssistant.status = "done";
        currentAssistant = null;
      }
      messages.push({
        id: `user-${messages.length}`,
        role: "user",
        content: event.message.slice(2),
      });
      continue;
    }

    // Start new assistant message on task.accepted
    if (event.type === "task.accepted") {
      if (currentAssistant) currentAssistant.status = "done";
      currentAssistant = {
        id: `assistant-${messages.length}`,
        role: "assistant",
        content: "",
        events: [],
        agent: event.agent,
        status: "streaming",
      };
      messages.push(currentAssistant);
    }

    // Accumulate events in current assistant message
    if (currentAssistant) {
      currentAssistant.events!.push(event);
      if (event.type === "task.completed") {
        currentAssistant.content = event.summary;
        currentAssistant.status = "done";
      }
      if (event.type === "task.failed") {
        currentAssistant.content = event.error;
        currentAssistant.status = "error";
      }
    }
  }

  const handleSubmit = useCallback(() => {
    if (!input.trim() || running) return;
    onSend(input.trim());
    setInput("");
  }, [input, running, onSend]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Chat area */}
      <Conversation className="flex-1">
        <ConversationContent className="gap-4 px-3 py-4">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<MonitorSmartphone className="size-10 opacity-20" />}
              title="What do you want to build?"
              description="Describe your app and the AI agent will generate it with live preview."
            />
          ) : (
            messages.map((msg) => (
              <Message key={msg.id} from={msg.role}>
                <MessageContent>
                  {msg.role === "user" ? (
                    <p>{msg.content}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {collapseFileEvents(msg.events || []).map((event, i) => (
                        <AgentEventItem key={i} event={event} done={msg.status !== "streaming"} />
                      ))}
                    </div>
                  )}
                </MessageContent>
              </Message>
            ))
          )}

          {/* Typing indicator */}
          {running && !activeAgent && (
            <Message from="assistant">
              <MessageContent>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Starting...</span>
                </div>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
      </Conversation>

      {/* Input area */}
      <div className="border-t border-border p-3 bg-surface-0">
        {/* Agent selector pills */}
        <div className="flex items-center gap-1 mb-2">
          {(["auto", "claude-code", "codex"] as const).map((agent) => (
            <button
              key={agent}
              type="button"
              onClick={() => onAgentChoiceChange(agent)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                agentChoice === agent
                  ? "bg-accent/15 text-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-zinc-800/50"
              }`}
            >
              {agent === "auto" ? "Auto" : agent === "claude-code" ? "Claude Code" : "Codex"}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={running ? "Agent working..." : "Build a todo app with dark theme..."}
            disabled={running}
            rows={1}
            className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:opacity-50 min-h-[42px] max-h-[120px]"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || running}
            className="self-end p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {running ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
