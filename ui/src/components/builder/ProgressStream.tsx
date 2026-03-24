"use client";

import type { AgentEvent } from "@/lib/agents/types";
import {
  CheckCircle,
  XCircle,
  FileCode,
  TerminalSquare,
  Loader2,
  Eye,
  Bot,
} from "lucide-react";

interface ProgressStreamProps {
  events: AgentEvent[];
}

function EventIcon({ type }: { type: AgentEvent["type"] }) {
  switch (type) {
    case "task.accepted": return <Bot className="size-3.5 text-accent" />;
    case "task.progress": return <Loader2 className="size-3.5 text-muted-foreground animate-spin" />;
    case "file.created":
    case "file.modified": return <FileCode className="size-3.5 text-accent-green" />;
    case "file.deleted": return <FileCode className="size-3.5 text-accent-red" />;
    case "command.started": return <TerminalSquare className="size-3.5 text-blue-400" />;
    case "command.completed": return <CheckCircle className="size-3.5 text-accent-green" />;
    case "preview.ready": return <Eye className="size-3.5 text-accent" />;
    case "task.completed": return <CheckCircle className="size-3.5 text-accent-green" />;
    case "task.failed": return <XCircle className="size-3.5 text-accent-red" />;
    default: return <Loader2 className="size-3.5 text-muted-foreground" />;
  }
}

function eventLabel(event: AgentEvent): string {
  switch (event.type) {
    case "task.accepted": return `${event.agent} accepted task`;
    case "task.progress": return event.message;
    case "file.created": return `Created ${event.path}`;
    case "file.modified": return `Modified ${event.path}`;
    case "file.deleted": return `Deleted ${event.path}`;
    case "command.started": return `$ ${event.command}`;
    case "command.output": return event.output.slice(0, 100);
    case "command.completed": return `Command exited (${event.exitCode})`;
    case "preview.ready": return `Preview ready: ${event.url}`;
    case "task.completed": return event.summary.slice(0, 120);
    case "task.failed": return event.error;
    case "task.cancelled": return "Task cancelled";
    default: return "";
  }
}

export function ProgressStream({ events }: ProgressStreamProps) {
  if (events.length === 0) return null;

  return (
    <div className="space-y-0.5 py-2">
      {events.map((event, i) => (
        <div
          key={i}
          className="flex items-start gap-2 px-3 py-1 text-xs"
        >
          <div className="mt-0.5 flex-shrink-0">
            <EventIcon type={event.type} />
          </div>
          <span className="text-foreground/70 break-all font-mono leading-relaxed">
            {eventLabel(event)}
          </span>
        </div>
      ))}
    </div>
  );
}
