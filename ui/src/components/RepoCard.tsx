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
    <div className="group bg-[#2A2A2C] rounded-2xl p-5 border border-white/5 shadow-sm hover:bg-[#3A3A3C] transition-colors cursor-pointer">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-[14px] font-semibold text-[#0A84FF] hover:underline">{fullName}</h3>
          {description && (
            <p className="text-[12px] font-medium text-white/40 mt-1 line-clamp-2">{description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 text-[12px] font-medium text-white/40">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: langColor }} />
          {language}
        </span>
        {stars > 0 && (
          <span className="flex items-center gap-1">
            <StarIcon size={10} />
            {stars.toLocaleString()}
          </span>
        )}
        <span className="flex items-center gap-1">
          <GitBranchIcon size={10} />
          {defaultBranch}
        </span>
        <span className="ml-auto text-white/30">
          Updated {new Date(lastPush).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
