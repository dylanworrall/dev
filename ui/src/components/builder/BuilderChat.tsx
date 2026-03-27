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
        <div className="flex items-center gap-2 text-[12px] font-medium text-[#0A84FF]">
          <Bot size={12} />
          <span>{event.agent}</span>
        </div>
      );

    case "task.progress":
      if (event.message.startsWith("> ")) return null;
      return (
        <div className="flex items-center gap-2 text-[12px] font-medium text-white/40">
          {done ? <CheckCircle size={10} className="text-white/20" /> : <Loader2 size={10} className="animate-spin" />}
          <span>{event.message}</span>
        </div>
      );

    case "file.modified":
    case "file.created":
      return (
        <div className="flex items-center gap-2 text-[12px] font-medium text-[#30D158]/70">
          <FileCode size={10} />
          <span className="font-mono">{event.path}</span>
        </div>
      );

    case "command.started":
      return (
        <div className="flex items-center gap-2 text-[12px] font-medium text-[#0A84FF]/70 font-mono">
          <TerminalSquare size={10} />
          <span>$ {event.command}</span>
        </div>
      );

    case "task.completed":
      return (
        <div className="flex items-start gap-2 text-[12px] font-medium text-[#30D158] mt-1">
          <CheckCircle size={12} className="mt-0.5 flex-shrink-0" />
          <span>{event.summary.slice(0, 300)}</span>
        </div>
      );

    case "task.failed":
      return (
        <div className="flex items-start gap-2 text-[12px] font-medium text-[#FF453A] mt-1">
          <XCircle size={12} className="mt-0.5 flex-shrink-0" />
          <span>{event.error}</span>
        </div>
      );

    case "preview.ready":
      return (
        <div className="flex items-center gap-2 text-[12px] font-medium text-[#0A84FF] mt-1">
          <MonitorSmartphone size={12} />
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

  let replacedFirst = false;
  return events.filter(e => {
    if (e.type === "file.modified" || e.type === "file.created") {
      if (!replacedFirst) {
        replacedFirst = true;
        return true;
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

  const messages: ChatMessage[] = [];
  let currentAssistant: ChatMessage | null = null;

  for (const event of events) {
    if (event.type === "task.progress" && "message" in event && event.message.startsWith("> ")) {
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
              icon={<MonitorSmartphone size={40} className="text-white/20" />}
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
                <div className="flex items-center gap-2 text-[12px] font-medium text-white/40">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Starting...</span>
                </div>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
      </Conversation>

      {/* Input area */}
      <div className="border-t border-white/5 p-3">
        {/* Agent selector pills */}
        <div className="flex items-center gap-1 mb-2">
          {(["auto", "claude-code", "codex"] as const).map((agent) => (
            <button
              key={agent}
              type="button"
              onClick={() => onAgentChoiceChange(agent)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                agentChoice === agent
                  ? "bg-[#0A84FF]/10 text-[#0A84FF]"
                  : "text-white/40 hover:text-white hover:bg-[#3A3A3C]"
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
            className="flex-1 bg-[#1C1C1E] border border-white/5 rounded-lg px-4 py-2.5 text-[14px] font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-[#0A84FF]/50 transition-colors resize-none disabled:opacity-40 disabled:cursor-not-allowed min-h-[42px] max-h-[120px]"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || running}
            className="self-end p-2.5 rounded-lg bg-[#0A84FF] text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
