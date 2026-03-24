"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/contexts/SidebarContext";
import {
  MessageSquareIcon,
  HammerIcon,
  FolderKanbanIcon,
  GitBranchIcon,
  CircleDotIcon,
  RocketIcon,
  SettingsIcon,
  LogOutIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SpaceSelector } from "@/components/SpaceSelector";
import { signOut, authClient } from "@/lib/auth-client";

const navItems = [
  { href: "/", label: "Chat", icon: MessageSquareIcon },
  { href: "/builder", label: "Builder", icon: HammerIcon },
  { href: "/projects", label: "Projects", icon: FolderKanbanIcon },
  { href: "/repos", label: "Repos", icon: GitBranchIcon },
  { href: "/issues", label: "Issues", icon: CircleDotIcon },
  { href: "/deployments", label: "Deployments", icon: RocketIcon },
];

export function Sidebar() {
  const { collapsed, toggle } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const [hoverExpanded, setHoverExpanded] = useState(false);

  const isExpanded = !collapsed || hoverExpanded;
  const settingsActive = pathname.startsWith("/settings");

  const handleLogout = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <aside
      onMouseEnter={() => { if (collapsed) setHoverExpanded(true); }}
      onMouseLeave={() => setHoverExpanded(false)}
      className={cn(
        "fixed top-3 left-3 bottom-3 rounded-xl border border-border bg-surface-1 flex flex-col transition-[width] duration-300 z-50",
        isExpanded ? "w-56" : "w-16"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
          <span className="text-accent font-bold text-sm">D</span>
        </div>
        {isExpanded && (
          <span className="font-semibold text-foreground text-sm truncate">
            Dev
          </span>
        )}
      </div>

      {/* Space Selector */}
      <div className="px-0 py-2 border-b border-border">
        <SpaceSelector expanded={isExpanded} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                active
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
              )}
            >
              <Icon className="size-5 flex-shrink-0" />
              {isExpanded && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Settings, Logout, Collapse */}
      <div className="px-2 py-2 border-t border-border space-y-1">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors w-full",
            settingsActive
              ? "bg-accent/10 text-accent"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
          )}
        >
          <SettingsIcon className="size-5 flex-shrink-0" />
          {isExpanded && <span className="truncate">Settings</span>}
        </Link>

        {authClient && (
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors w-full cursor-pointer"
          >
            <LogOutIcon className="size-5 flex-shrink-0" />
            {isExpanded && <span className="truncate">Log Out</span>}
          </button>
        )}

        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors w-full cursor-pointer"
        >
          {collapsed ? (
            <PanelLeftOpenIcon className="size-5 flex-shrink-0" />
          ) : (
            <>
              <PanelLeftCloseIcon className="size-5 flex-shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
