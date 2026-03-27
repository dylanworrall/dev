"use client";

import { useEffect, useState } from "react";
import { useSpace } from "@/contexts/SpaceContext";
import { ChevronDownIcon, LayersIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Space {
  id: string;
  name: string;
  icon: string;
}

export function SpaceSelector({ expanded }: { expanded: boolean }) {
  const { activeSpaceId, setActiveSpaceId } = useSpace();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/spaces")
      .then((r) => r.json())
      .then(setSpaces)
      .catch(() => {});
  }, []);

  const active = spaces.find((s) => s.id === activeSpaceId);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-full px-3 py-2 rounded-xl text-white/40 hover:text-white hover:bg-[#3A3A3C] transition-colors cursor-pointer"
      >
        <LayersIcon size={14} />
      </button>
    );
  }

  return (
    <div className="relative px-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[13px] font-medium text-white/40 hover:text-white hover:bg-[#3A3A3C] transition-colors cursor-pointer"
      >
        <LayersIcon size={14} className="flex-shrink-0" />
        <span className="flex-1 text-left truncate">{active?.name || "All Spaces"}</span>
        <ChevronDownIcon size={12} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-2 right-2 top-full mt-1 rounded-2xl border border-white/10 bg-[#1C1C1E]/95 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5 z-50 py-1 overflow-hidden">
          <button
            type="button"
            onClick={() => { setActiveSpaceId(null); setOpen(false); }}
            className={cn(
              "w-full text-left px-4 py-2.5 text-[13px] font-medium hover:bg-[#3A3A3C] transition-colors cursor-pointer",
              !activeSpaceId ? "text-[#0A84FF]" : "text-white/70"
            )}
          >
            All Spaces
          </button>
          {spaces.map((space) => (
            <button
              key={space.id}
              type="button"
              onClick={() => { setActiveSpaceId(space.id); setOpen(false); }}
              className={cn(
                "w-full text-left px-4 py-2.5 text-[13px] font-medium hover:bg-[#3A3A3C] transition-colors cursor-pointer",
                activeSpaceId === space.id ? "text-[#0A84FF]" : "text-white/70"
              )}
            >
              {space.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
