"use client";

import { usePathname } from "next/navigation";
import { TopBar } from "./TopBar";
import { ThreadProvider } from "@/contexts/ThreadContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { ToastContainer } from "@/components/Toast";
import { useSession, authClient } from "@/lib/auth-client";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  const isBuilder = pathname.startsWith("/builder");

  // Login bypasses everything
  if (isLogin) {
    return <>{children}</>;
  }

  // Builder gets TopBar integrated into its own layout
  if (isBuilder) {
    return (
      <ToastProvider>
        <ThreadProvider>
          <div className="h-screen flex flex-col bg-[#1C1C1E]">
            <TopBar />
            <div className="flex-1 min-h-0">
              {children}
            </div>
          </div>
          <ToastContainer />
        </ThreadProvider>
      </ToastProvider>
    );
  }

  // All other pages: TopBar + content
  return (
    <ToastProvider>
      <ThreadProvider>
        <div className="min-h-screen bg-[#1C1C1E]">
          <TopBar />
          <main>{children}</main>
        </div>
        <ToastContainer />
      </ThreadProvider>
    </ToastProvider>
  );
}
