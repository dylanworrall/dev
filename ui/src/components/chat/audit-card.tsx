"use client";

import { cn } from "@/lib/utils";

interface AuditScores {
  performance: number;
  seo: number;
  accessibility: number;
  bestPractices: number;
}

interface AuditCardProps {
  url: string;
  scores: AuditScores;
  timestamp?: string;
  className?: string;
}

function ScoreBadge({ label, score }: { label: string; score: number }) {
  const color =
    score >= 90
      ? "text-green-400 border-green-400/30 bg-green-400/10"
      : score >= 50
        ? "text-orange-400 border-orange-400/30 bg-orange-400/10"
        : "text-red-400 border-red-400/30 bg-red-400/10";

  return (
    <div className={cn("flex flex-col items-center gap-1 p-3 rounded-xl border", color)}>
      <span className="text-2xl font-bold">{score}</span>
      <span className="text-xs opacity-70">{label}</span>
    </div>
  );
}

export function AuditCard({ url, scores, timestamp, className }: AuditCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface-1 p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground truncate">{url}</h3>
        {timestamp && (
          <span className="text-xs text-muted-foreground">
            {new Date(timestamp).toLocaleDateString()}
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        <ScoreBadge label="Performance" score={scores.performance} />
        <ScoreBadge label="SEO" score={scores.seo} />
        <ScoreBadge label="Accessibility" score={scores.accessibility} />
        <ScoreBadge label="Best Practices" score={scores.bestPractices} />
      </div>
    </div>
  );
}
