"use client";

import { useSidebar } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";

export function MainContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <main
      className={cn(
        "min-h-screen transition-[margin-left] duration-300",
        collapsed ? "ml-22" : "ml-62"
      )}
    >
      {children}
    </main>
  );
}
