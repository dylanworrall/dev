"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { MainContent } from "./MainContent";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ThreadProvider } from "@/contexts/ThreadContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { SpaceProvider } from "@/contexts/SpaceContext";
import { ToastContainer } from "@/components/Toast";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) {
    return <>{children}</>;
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
