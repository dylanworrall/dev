"use client";

import { useRouter } from "next/navigation";
import { FolderKanbanIcon, GlobeIcon, FileSearchIcon, BugIcon } from "lucide-react";

interface ProjectCardProps {
  id: string;
  name: string;
  client: string;
  url: string;
  auditCount: number;
  crawlCount: number;
  status?: "active" | "archived";
}

export function ProjectCard({ id, name, client, url, auditCount, crawlCount, status = "active" }: ProjectCardProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/?project=${encodeURIComponent(name)}`);
  };

  return (
    <div
      onClick={handleClick}
      className="group bg-[#2A2A2C] rounded-2xl p-5 border border-white/5 shadow-sm hover:bg-[#3A3A3C] transition-colors cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#0A84FF]/10 text-[#0A84FF]">
            <FolderKanbanIcon size={18} />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-white/90">{name}</h3>
            <p className="text-[12px] font-medium text-white/40">{client}</p>
          </div>
        </div>
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            status === "active"
              ? "bg-[#30D158]/10 text-[#30D158]"
              : "bg-white/5 text-white/40"
          }`}
        >
          {status === "active" ? "Active" : "Archived"}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-[12px] font-medium text-white/40 mb-3">
        <GlobeIcon size={10} />
        <span className="truncate">{url}</span>
      </div>

      <div className="flex items-center gap-4 text-[12px] font-medium text-white/40">
        <span className="flex items-center gap-1">
          <FileSearchIcon size={10} />
          {auditCount} audits
        </span>
        <span className="flex items-center gap-1">
          <BugIcon size={10} />
          {crawlCount} crawls
        </span>
      </div>
    </div>
  );
}
