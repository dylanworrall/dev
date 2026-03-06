"use client";

import { StarIcon, GitBranchIcon } from "lucide-react";

const languageColors: Record<string, string> = {
  typescript: "#3178C6",
  javascript: "#F7DF1E",
  python: "#3776AB",
  rust: "#DEA584",
  go: "#00ADD8",
  java: "#ED8B00",
  ruby: "#CC342D",
  swift: "#FA7343",
  kotlin: "#7F52FF",
  css: "#563D7C",
  html: "#E34F26",
};

interface RepoCardProps {
  name: string;
  fullName: string;
  language: string;
  description: string;
  stars: number;
  lastPush: string;
  defaultBranch: string;
}

export function RepoCard({ name, fullName, language, description, stars, lastPush, defaultBranch }: RepoCardProps) {
  const langColor = languageColors[language.toLowerCase()] || "#8E8E93";

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4 hover:border-accent/30 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-accent hover:underline cursor-pointer">{fullName}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: langColor }} />
          {language}
        </span>
        {stars > 0 && (
          <span className="flex items-center gap-1">
            <StarIcon className="size-3" />
            {stars.toLocaleString()}
          </span>
        )}
        <span className="flex items-center gap-1">
          <GitBranchIcon className="size-3" />
          {defaultBranch}
        </span>
        <span className="ml-auto">
          Updated {new Date(lastPush).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
