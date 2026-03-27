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
        "fixed top-3 left-3 bottom-3 rounded-2xl bg-[#1C1C1E]/95 backdrop-blur-2xl border border-white/5 flex flex-col transition-[width] duration-300 z-50 shadow-2xl",
        isExpanded ? "w-56" : "w-16"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0A84FF] to-[#BF5AF2] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">D</span>
        </div>
        {isExpanded && (
          <span className="font-semibold text-white/90 text-[14px] truncate">
            Dev
          </span>
        )}
      </div>

      {/* Space Selector */}
      <div className="px-0 py-2 border-b border-white/5">
        <SpaceSelector expanded={isExpanded} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto scrollbar-hide">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors",
                active
                  ? "bg-[#0A84FF]/10 text-[#0A84FF]"
                  : "text-white/40 hover:text-white hover:bg-[#3A3A3C]"
              )}
            >
              <Icon size={18} className="flex-shrink-0" strokeWidth={active ? 2.5 : 2} />
              {isExpanded && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Settings, Logout, Collapse */}
      <div className="px-2 py-2 border-t border-white/5 space-y-1">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors w-full",
            settingsActive
              ? "bg-[#0A84FF]/10 text-[#0A84FF]"
              : "text-white/40 hover:text-white hover:bg-[#3A3A3C]"
          )}
        >
          <SettingsIcon size={18} className="flex-shrink-0" />
          {isExpanded && <span className="truncate">Settings</span>}
        </Link>

        {authClient && (
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-white/40 hover:text-[#FF453A] hover:bg-[#FF453A]/10 transition-colors w-full cursor-pointer"
          >
            <LogOutIcon size={18} className="flex-shrink-0" />
            {isExpanded && <span className="truncate">Log Out</span>}
          </button>
        )}

        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-white/40 hover:text-white hover:bg-[#3A3A3C] transition-colors w-full cursor-pointer"
        >
          {collapsed ? (
            <PanelLeftOpenIcon size={18} className="flex-shrink-0" />
          ) : (
            <>
              <PanelLeftCloseIcon size={18} className="flex-shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
