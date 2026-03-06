"use client";

import { cn } from "@/lib/utils";
import { FolderKanbanIcon, GlobeIcon, FileSearchIcon, BugIcon } from "lucide-react";

interface ProjectCardProps {
  name: string;
  client: string;
  url: string;
  auditCount: number;
  crawlCount: number;
  status?: "active" | "archived";
}

export function ProjectCard({ name, client, url, auditCount, crawlCount, status = "active" }: ProjectCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4 hover:border-accent/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <FolderKanbanIcon className="size-5 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{name}</h3>
            <p className="text-xs text-muted-foreground">{client}</p>
          </div>
        </div>
        <span
          className={cn(
            "text-[10px] font-medium px-2 py-0.5 rounded-full",
            status === "active"
              ? "bg-accent-green/10 text-accent-green"
              : "bg-muted/10 text-muted-foreground"
          )}
        >
          {status === "active" ? "Active" : "Archived"}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
        <GlobeIcon className="size-3" />
        <span className="truncate">{url}</span>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <FileSearchIcon className="size-3" />
          {auditCount} audits
        </span>
        <span className="flex items-center gap-1">
          <BugIcon className="size-3" />
          {crawlCount} crawls
        </span>
      </div>
    </div>
  );
}
