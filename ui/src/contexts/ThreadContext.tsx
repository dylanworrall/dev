"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ThreadContextValue {
  chatThreadId: string;
  activeThreadId: string | null;
  newChat: () => void;
  setActiveThread: (id: string | null) => void;
  setChatThreadId: (id: string) => void;
}

const ThreadContext = createContext<ThreadContextValue | null>(null);

export function ThreadProvider({ children }: { children: ReactNode }) {
  const [chatThreadId, setChatThreadId] = useState(() => crypto.randomUUID());
  const [activeThreadId, setActiveThread] = useState<string | null>(null);

  const newChat = useCallback(() => {
    setChatThreadId(crypto.randomUUID());
    setActiveThread(null);
  }, []);

  return (
    <ThreadContext value={{ chatThreadId, activeThreadId, newChat, setActiveThread, setChatThreadId }}>
      {children}
    </ThreadContext>
  );
}

export function useThread(): ThreadContextValue {
  const ctx = useContext(ThreadContext);
  if (!ctx) throw new Error("useThread must be used within ThreadProvider");
  return ctx;
}
