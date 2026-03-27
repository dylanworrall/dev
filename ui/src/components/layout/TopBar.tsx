"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  HammerIcon,
  GitBranchIcon,
  CircleDotIcon,
  RocketIcon,
  SettingsIcon,
} from "lucide-react";

const navItems = [
  { href: "/builder", label: "Builder", icon: HammerIcon },
  { href: "/repos", label: "Repos", icon: GitBranchIcon },
  { href: "/issues", label: "Issues", icon: CircleDotIcon },
  { href: "/deployments", label: "Deploys", icon: RocketIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function TopBar() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-50 flex items-center gap-1 px-3 h-11 bg-[#1C1C1E]/95 backdrop-blur-2xl border-b border-white/5 flex-shrink-0">
      {/* Logo */}
      <Link href="/builder" className="flex items-center gap-2 mr-4">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#0A84FF] to-[#BF5AF2] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-[10px]">D</span>
        </div>
        <span className="font-semibold text-white/90 text-[13px]">Dev</span>
      </Link>

      {/* Nav */}
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
              active
                ? "bg-[#0A84FF]/10 text-[#0A84FF]"
                : "text-white/40 hover:text-white hover:bg-[#3A3A3C]"
            )}
          >
            <Icon size={14} strokeWidth={active ? 2.5 : 2} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
