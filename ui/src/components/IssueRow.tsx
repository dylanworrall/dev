"use client";

import { cn } from "@/lib/utils";
import { CircleDotIcon, CircleCheckIcon, CircleIcon } from "lucide-react";

const statusIcons = {
  open: CircleDotIcon,
  "in-progress": CircleIcon,
  closed: CircleCheckIcon,
};

const statusColors = {
  open: "text-accent-green",
  "in-progress": "text-accent",
  closed: "text-muted-foreground",
};

const priorityColors = {
  low: "bg-blue-500/10 text-blue-400",
  medium: "bg-yellow-500/10 text-yellow-400",
  high: "bg-orange-500/10 text-orange-400",
  critical: "bg-red-500/10 text-red-400",
};

interface IssueRowProps {
  title: string;
  status: "open" | "in-progress" | "closed";
  priority: "low" | "medium" | "high" | "critical";
  labels: string[];
  assignee: string;
  createdAt: string;
}

export function IssueRow({ title, status, priority, labels, assignee, createdAt }: IssueRowProps) {
  const StatusIcon = statusIcons[status];

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-surface-1 transition-colors">
      <StatusIcon className={cn("size-4 flex-shrink-0", statusColors[status])} />

      <div className="flex-1 min-w-0">
        <span className="text-sm text-foreground">{title}</span>
        <div className="flex items-center gap-2 mt-0.5">
          {labels.map((label) => (
            <span key={label} className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-2 text-muted-foreground">
              {label}
            </span>
          ))}
        </div>
      </div>

      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", priorityColors[priority])}>
        {priority}
      </span>

      {assignee && (
        <span className="text-xs text-muted-foreground w-20 truncate text-right">{assignee}</span>
      )}

      <span className="text-xs text-muted-foreground w-24 text-right">
        {new Date(createdAt).toLocaleDateString()}
      </span>
    </div>
  );
}
