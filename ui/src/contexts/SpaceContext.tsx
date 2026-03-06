"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface SpaceContextValue {
  activeSpaceId: string | null;
  setActiveSpaceId: (id: string | null) => void;
}

const SpaceContext = createContext<SpaceContextValue | null>(null);
const STORAGE_KEY = "dev-active-space";

export function SpaceProvider({ children }: { children: ReactNode }) {
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setActiveSpaceId(stored);
  }, []);

  const handleSet = (id: string | null) => {
    setActiveSpaceId(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <SpaceContext value={{ activeSpaceId, setActiveSpaceId: handleSet }}>
      {children}
    </SpaceContext>
  );
}

export function useSpace(): SpaceContextValue {
  const ctx = useContext(SpaceContext);
  if (!ctx) throw new Error("useSpace must be used within SpaceProvider");
  return ctx;
}
