"use client";

import { cn } from "@/lib/utils";
import { SendIcon } from "lucide-react";
import { useState, useRef, useCallback, type FormEvent, type KeyboardEvent } from "react";

interface PromptInputProps {
  onSubmit: (value: string) => void;
  isLoading?: boolean;
  className?: string;
}

export function PromptInput({ onSubmit, isLoading, className }: PromptInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const trimmed = value.trim();
      if (!trimmed || isLoading) return;
      onSubmit(trimmed);
      setValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    },
    [value, isLoading, onSubmit]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, []);

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)}>
      <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface-1 px-4 py-3 shadow-elevation-2 focus-within:ring-2 focus-within:ring-accent/50">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Audit a site, check SEO, find broken links..."
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none max-h-[200px]"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!value.trim() || isLoading}
          className={cn(
            "flex-shrink-0 p-2 rounded-xl transition-colors cursor-pointer",
            value.trim() && !isLoading
              ? "bg-accent text-white hover:bg-accent/90"
              : "bg-surface-3 text-muted-foreground"
          )}
        >
          <SendIcon className="size-4" />
        </button>
      </div>
    </form>
  );
}
