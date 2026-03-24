"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { MainContent } from "./MainContent";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ThreadProvider } from "@/contexts/ThreadContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { SpaceProvider } from "@/contexts/SpaceContext";
import { ToastContainer } from "@/components/Toast";
import { useSession, authClient } from "@/lib/auth-client";

const hasAuth = !!authClient;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const isLogin = pathname === "/login";
  const isBuilder = pathname.startsWith("/builder");

  useEffect(() => {
    if (hasAuth && !isPending && !session && !isLogin && !isBuilder) {
      router.replace("/login");
    }
  }, [isPending, session, isLogin, isBuilder, router]);

  // Builder and login bypass auth — builder uses COOP/COEP headers that break auth
  if (isLogin || isBuilder) {
    return <>{children}</>;
  }

  // Skip session gate when auth is not configured (local mode)
  if (hasAuth) {
    if (isPending) {
      return (
        <div className="min-h-screen bg-surface-0 flex items-center justify-center">
          <div className="size-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (!session) {
      return null;
    }
  }

  return (
    <ToastProvider>
      <SidebarProvider>
        <SpaceProvider>
          <ThreadProvider>
            <Sidebar />
            <MainContent>{children}</MainContent>
            <ToastContainer />
          </ThreadProvider>
        </SpaceProvider>
      </SidebarProvider>
    </ToastProvider>
  );
}
