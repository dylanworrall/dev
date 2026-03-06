"use client";

import { cn } from "@/lib/utils";

const envColors: Record<string, string> = {
  production: "bg-red-500/10 text-red-400",
  staging: "bg-yellow-500/10 text-yellow-400",
  preview: "bg-blue-500/10 text-blue-400",
  dev: "bg-purple-500/10 text-purple-400",
};

const statusIndicators: Record<string, { color: string; label: string }> = {
  building: { color: "bg-yellow-400", label: "Building" },
  deploying: { color: "bg-blue-400", label: "Deploying" },
  live: { color: "bg-accent-green", label: "Live" },
  failed: { color: "bg-accent-red", label: "Failed" },
  "rolled-back": { color: "bg-muted", label: "Rolled back" },
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
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-surface-1 transition-colors">
      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", env)}>
        {environment}
      </span>

      <div className="flex items-center gap-1.5">
        <span className={cn("w-2 h-2 rounded-full", indicator.color, status === "building" || status === "deploying" ? "animate-pulse" : "")} />
        <span className="text-xs text-muted-foreground">{indicator.label}</span>
      </div>

      <code className="text-xs font-mono text-muted-foreground">{commitSha.slice(0, 7)}</code>

      <span className="text-xs text-muted-foreground">{branch}</span>

      <span className="flex-1" />

      {buildDuration && (
        <span className="text-xs text-muted-foreground">{buildDuration}s</span>
      )}

      <span className="text-xs text-muted-foreground">
        {new Date(createdAt).toLocaleString()}
      </span>
    </div>
  );
}
