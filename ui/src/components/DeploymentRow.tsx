"use client";

import { cn } from "@/lib/utils";

const envColors: Record<string, string> = {
  production: "bg-[#FF453A]/10 text-[#FF453A]",
  staging: "bg-[#FF9F0A]/10 text-[#FF9F0A]",
  preview: "bg-[#0A84FF]/10 text-[#0A84FF]",
  dev: "bg-[#BF5AF2]/10 text-[#BF5AF2]",
};

const statusIndicators: Record<string, { color: string; label: string }> = {
  building: { color: "bg-[#FF9F0A]", label: "Building" },
  deploying: { color: "bg-[#0A84FF]", label: "Deploying" },
  live: { color: "bg-[#30D158]", label: "Live" },
  failed: { color: "bg-[#FF453A]", label: "Failed" },
  "rolled-back": { color: "bg-white/40", label: "Rolled back" },
};

interface DeploymentRowProps {
  environment: string;
  status: string;
  commitSha: string;
  branch: string;
  url: string;
  createdAt: string;
  buildDuration?: number;
}

export function DeploymentRow({ environment, status, commitSha, branch, url, createdAt, buildDuration }: DeploymentRowProps) {
  const env = envColors[environment] || envColors.dev;
  const indicator = statusIndicators[status] || statusIndicators.building;

  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 hover:bg-[#3A3A3C] transition-colors">
      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", env)}>
        {environment}
      </span>

      <div className="flex items-center gap-1.5">
        <span className={cn("w-2 h-2 rounded-full", indicator.color, status === "building" || status === "deploying" ? "animate-pulse" : "")} />
        <span className="text-[12px] font-medium text-white/40">{indicator.label}</span>
      </div>

      <code className="text-[12px] font-mono text-white/40">{commitSha.slice(0, 7)}</code>

      <span className="text-[12px] font-medium text-white/40">{branch}</span>

      <span className="flex-1" />

      {buildDuration && (
        <span className="text-[11px] text-white/30 tabular-nums">{buildDuration}s</span>
      )}

      <span className="text-[11px] text-white/30">
        {new Date(createdAt).toLocaleString()}
      </span>
    </div>
  );
}
