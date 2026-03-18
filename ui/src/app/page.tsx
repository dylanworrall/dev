"use client";

import { useChat } from "@ai-sdk/react";
import { isToolUIPart, getToolName } from "ai";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { ToolActivity } from "@/components/ai-elements/tool-activity";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

const MODELS = [
  { id: "gemini-2.5-flash-lite", label: "Flash Lite", desc: "Fast, free tier friendly" },
  { id: "gemini-2.5-flash", label: "Flash", desc: "Balanced speed & quality" },
  { id: "gemini-3.1-pro-preview", label: "3.1 Pro", desc: "Best quality, higher quota usage" },
];

function ModelPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1 bg-muted/30 rounded-full p-0.5">
      {MODELS.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          title={m.desc}
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
            value === m.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

const taglines = [
  "Audit any site in seconds.",
  "Ship faster with AI.",
  "Debug, deploy, repeat.",
  "Your AI dev toolkit.",
];

const suggestions = [
  "Build me a web app",
  "Audit a website",
  "Review a PR",
  "Deploy my site",
  "Search the web",
  "Run some code",
];

function RotatingTagline() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % taglines.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-7 relative overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
          className="text-muted-foreground text-base absolute inset-x-0"
        >
          {taglines[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authChecked, setAuthChecked] = useState(false);
  const [model, setModel] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("dev-model") || "gemini-2.5-flash-lite";
    return "gemini-2.5-flash-lite";
  });
  const chat = useChat();
  const { status, setMessages } = chat;
  // Auto-trim: if messages exceed 30, keep only the last 15
  const messages = chat.messages;
  const sendMessage = chat.sendMessage;
  useEffect(() => {
    if (messages.length > 15) {
      setMessages(messages.slice(-8));
    }
  }, [messages.length, messages, setMessages]);

  // Sync model choice to cookie so server can read it
  useEffect(() => {
    document.cookie = `dev-model=${model};path=/;max-age=31536000`;
  }, [model]);
  const isLoading = status === "submitted" || status === "streaming";
  const hasMessages = messages.length > 0;
  const resumeSent = useRef(false);

  const handleModelChange = useCallback((newModel: string) => {
    setModel(newModel);
    localStorage.setItem("dev-model", newModel);
  }, []);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => {
        if (!data.connected) {
          router.replace("/login");
        } else {
          setAuthChecked(true);
        }
      })
      .catch(() => setAuthChecked(true));
  }, [router]);

  // Auto-resume project when navigating from Projects tab
  useEffect(() => {
    const projectName = searchParams.get("project");
    if (projectName && authChecked && !resumeSent.current && !hasMessages) {
      resumeSent.current = true;
      if (projectName === "connect-github") {
        sendMessage({ text: "Help me connect my GitHub account so I can track repos and manage PRs" });
      } else {
        sendMessage({ text: `Resume working on "${projectName}"` });
      }
      router.replace("/", { scroll: false });
    }
  }, [searchParams, authChecked, hasMessages, sendMessage, router]);

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {hasMessages ? (
        <>
          {/* New Chat button */}
          <div className="flex justify-end px-4 pt-2">
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-muted-foreground hover:text-foreground px-3 py-1 rounded-md border border-border hover:border-accent/30 transition-colors"
            >
              + New Chat
            </button>
          </div>
          <Conversation className="flex-1">
            <ConversationContent className="max-w-3xl mx-auto w-full">
              {messages.map((msg, msgIdx) => (
                <Message key={`${msg.id}-${msgIdx}`} from={msg.role}>
                  <MessageContent>
                    {msg.parts.map((part, i) => {
                      if (part.type === "text" && part.text) {
                        return (
                          <MessageResponse
                            key={i}
                            mode={status === "streaming" && msg === messages[messages.length - 1] && msg.role === "assistant" ? "streaming" : "static"}
                          >
                            {part.text}
                          </MessageResponse>
                        );
                      }
                      if (isToolUIPart(part) && part.state) {
                        const toolName = getToolName(part);
                        return (
                          <ToolActivity
                            key={i}
                            toolName={toolName}
                            state={part.state}
                            input={part.input}
                            output={part.state === "output-available" ? part.output : undefined}
                            errorText={"errorText" in part ? (part as { errorText?: string }).errorText : undefined}
                            onUserChoice={(choice) => {
                              sendMessage({ text: choice });
                            }}
                          />
                        );
                      }
                      return null;
                    })}
                  </MessageContent>
                </Message>
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <Shimmer className="text-sm">Thinking...</Shimmer>
              )}
              {status === "error" && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 mx-2">
                  Model failed to respond — likely quota exhausted. Try switching to a lighter model or wait a minute.
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="px-4 pb-4 pt-2 max-w-3xl mx-auto w-full space-y-2">
            <PromptInput
              onSubmit={(message) => {
                if (message.text.trim()) {
                  sendMessage({ text: message.text });
                }
              }}
            >
              <PromptInputTextarea placeholder="What do you want to build?" />
              <PromptInputSubmit disabled={isLoading} />
            </PromptInput>
            <div className="flex items-center justify-between px-1">
              <ModelPicker value={model} onChange={handleModelChange} />
              <span className="text-[10px] text-muted-foreground">{messages.length} messages</span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6 float">
              <span className="text-accent font-bold text-2xl">D</span>
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-3">Dev</h1>
            <RotatingTagline />
          </motion.div>

          {/* Suggestion chips */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-wrap gap-2 justify-center mb-10 max-w-md"
          >
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => sendMessage({ text: s })}
                className="px-4 py-2 rounded-full border border-border bg-surface-1 text-sm text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors cursor-pointer"
              >
                {s}
              </button>
            ))}
          </motion.div>

          {/* Prompt input */}
          <div className="w-full max-w-3xl space-y-2">
            <PromptInput
              onSubmit={(message) => {
                if (message.text.trim()) {
                  sendMessage({ text: message.text });
                }
              }}
            >
              <PromptInputTextarea placeholder="What do you want to build?" />
              <PromptInputSubmit disabled={isLoading} />
            </PromptInput>
            <div className="flex justify-center">
              <ModelPicker value={model} onChange={handleModelChange} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
