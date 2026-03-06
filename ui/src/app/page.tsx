"use client";

import { useChat } from "@ai-sdk/react";
import { isToolUIPart } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

const taglines = [
  "Audit any site in seconds.",
  "Ship faster with AI.",
  "Debug, deploy, repeat.",
  "Your AI dev toolkit.",
];

const suggestions = [
  "Run a site audit",
  "List my projects",
  "Check SEO",
  "Crawl a site",
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
  const [authChecked, setAuthChecked] = useState(false);
  const { messages, sendMessage, status } = useChat();
  const isLoading = status === "submitted" || status === "streaming";
  const hasMessages = messages.length > 0;

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
          <Conversation className="flex-1">
            <ConversationContent className="max-w-3xl mx-auto w-full">
              {messages.map((msg) => (
                <Message key={msg.id} from={msg.role}>
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
                      if (isToolUIPart(part)) {
                        const toolName = "toolName" in part ? (part as { toolName: string }).toolName : undefined;
                        return (
                          <Tool key={i}>
                            <ToolHeader {...({ type: part.type, state: part.state, ...(toolName ? { toolName } : {}) } as React.ComponentProps<typeof ToolHeader>)} />
                            <ToolContent>
                              <ToolInput input={part.input} />
                              {part.state === "output-available" && (
                                <ToolOutput output={part.output} errorText={"errorText" in part ? (part as { errorText?: string }).errorText : undefined} />
                              )}
                            </ToolContent>
                          </Tool>
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
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="px-4 pb-4 pt-2 max-w-3xl mx-auto w-full">
            <PromptInput
              onSubmit={(message) => {
                if (message.text.trim()) {
                  sendMessage({ text: message.text });
                }
              }}
            >
              <PromptInputTextarea placeholder="Ask about SEO, performance, audits..." />
              <PromptInputSubmit disabled={isLoading} />
            </PromptInput>
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
          <div className="w-full max-w-3xl">
            <PromptInput
              onSubmit={(message) => {
                if (message.text.trim()) {
                  sendMessage({ text: message.text });
                }
              }}
            >
              <PromptInputTextarea placeholder="Ask about SEO, performance, audits..." />
              <PromptInputSubmit disabled={isLoading} />
            </PromptInput>
          </div>
        </div>
      )}
    </div>
  );
}
