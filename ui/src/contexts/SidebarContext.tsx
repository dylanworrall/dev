"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

const STORAGE_KEY = "dev-sidebar-collapsed";

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "false") setCollapsed(false);
  }, []);

  const handleSetCollapsed = (value: boolean) => {
    setCollapsed(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  };

  const toggle = () => handleSetCollapsed(!collapsed);

  return (
    <SidebarContext value={{ collapsed, setCollapsed: handleSetCollapsed, toggle }}>
      {children}
    </SidebarContext>
  );
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
