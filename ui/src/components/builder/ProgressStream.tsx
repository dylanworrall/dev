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
  MessageSquare,
  ChevronRight,
} from "lucide-react";

interface ProgressStreamProps {
  events: AgentEvent[];
}

/** Check if the task has finished (completed, failed, or cancelled) */
function isTaskDone(events: AgentEvent[]): boolean {
  return events.some(
    (e) => e.type === "task.completed" || e.type === "task.failed" || e.type === "task.cancelled"
  );
}

function EventIcon({ type, done }: { type: AgentEvent["type"]; done: boolean }) {
  switch (type) {
    case "task.accepted": return <Bot className="size-3.5 text-accent" />;
    case "task.progress":
      // Show spinner only if task is still running
      return done
        ? <ChevronRight className="size-3.5 text-zinc-500" />
        : <Loader2 className="size-3.5 text-accent animate-spin" />;
    case "file.created":
    case "file.modified": return <FileCode className="size-3.5 text-emerald-400" />;
    case "file.deleted": return <FileCode className="size-3.5 text-red-400" />;
    case "command.started":
      return done
        ? <TerminalSquare className="size-3.5 text-zinc-500" />
        : <Loader2 className="size-3.5 text-blue-400 animate-spin" />;
    case "command.completed": return <CheckCircle className="size-3.5 text-emerald-400" />;
    case "preview.ready": return <Eye className="size-3.5 text-accent" />;
    case "task.completed": return <CheckCircle className="size-3.5 text-emerald-400" />;
    case "task.failed": return <XCircle className="size-3.5 text-red-400" />;
    default: return <ChevronRight className="size-3.5 text-zinc-600" />;
  }
}

function eventLabel(event: AgentEvent): string {
  switch (event.type) {
    case "task.accepted": return `${event.agent}`;
    case "task.progress": return event.message;
    case "file.created": return event.path;
    case "file.modified": return event.path;
    case "file.deleted": return event.path;
    case "command.started": return `$ ${event.command}`;
    case "command.output": return event.output.slice(0, 100);
    case "command.completed": return event.exitCode === 0 ? "Done" : `Exit ${event.exitCode}`;
    case "preview.ready": return "Preview ready";
    case "task.completed": return event.summary.slice(0, 200);
    case "task.failed": return event.error;
    case "task.cancelled": return "Cancelled";
    default: return "";
  }
}

function eventStyle(event: AgentEvent, done: boolean): string {
  // User messages
  if (event.type === "task.progress" && "message" in event && event.message.startsWith("> ")) {
    return "text-foreground font-medium";
  }
  // Terminal events
  if (event.type === "task.completed") return "text-emerald-400";
  if (event.type === "task.failed") return "text-red-400";
  if (event.type === "file.modified" || event.type === "file.created") return "text-emerald-400/70";
  if (event.type === "preview.ready") return "text-accent";
  if (event.type === "task.accepted") return "text-accent/80";
  // Dim completed progress events
  if (event.type === "task.progress" && done) return "text-zinc-500";
  return "text-zinc-400";
}

export function ProgressStream({ events }: ProgressStreamProps) {
  if (events.length === 0) return null;

  const done = isTaskDone(events);

  // Group file events for cleaner display
  const fileEvents = events.filter(
    (e) => e.type === "file.modified" || e.type === "file.created"
  );
  const showFilesSummary = fileEvents.length > 4;

  return (
    <div className="py-2 space-y-px">
      {events.map((event, i) => {
        // Collapse file events into a summary if there are many
        if (showFilesSummary && (event.type === "file.modified" || event.type === "file.created")) {
          // Only render the summary on the first file event
          if (i !== events.indexOf(fileEvents[0])) return null;
          return (
            <div key={i} className="flex items-start gap-2 px-3 py-1 text-xs">
              <div className="mt-0.5 flex-shrink-0">
                <FileCode className="size-3.5 text-emerald-400" />
              </div>
              <span className="text-emerald-400/70 font-mono">
                {fileEvents.length} files updated
              </span>
            </div>
          );
        }

        // Skip command.output (noisy)
        if (event.type === "command.output") return null;

        const label = eventLabel(event);
        if (!label) return null;

        // User message — render differently
        if (event.type === "task.progress" && "message" in event && event.message.startsWith("> ")) {
          return (
            <div key={i} className="flex items-start gap-2 px-3 py-2 text-xs mt-2 border-t border-zinc-800/50">
              <div className="mt-0.5 flex-shrink-0">
                <MessageSquare className="size-3.5 text-accent" />
              </div>
              <span className="text-foreground font-medium">{event.message.slice(2)}</span>
            </div>
          );
        }

        return (
          <div key={i} className="flex items-start gap-2 px-3 py-0.5 text-xs">
            <div className="mt-0.5 flex-shrink-0">
              <EventIcon type={event.type} done={done} />
            </div>
            <span className={`font-mono leading-relaxed break-all ${eventStyle(event, done)}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
