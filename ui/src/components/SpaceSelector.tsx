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
        className="flex items-center justify-center w-full px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <LayersIcon className="size-4" />
      </button>
    );
  }

  return (
    <div className="relative px-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <LayersIcon className="size-4 flex-shrink-0" />
        <span className="flex-1 text-left truncate">{active?.name || "All Spaces"}</span>
        <ChevronDownIcon className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-2 right-2 top-full mt-1 rounded-lg border border-border bg-surface-1 shadow-elevation-2 z-50 py-1">
          <button
            type="button"
            onClick={() => { setActiveSpaceId(null); setOpen(false); }}
            className={cn(
              "w-full text-left px-3 py-2 text-sm hover:bg-surface-2 transition-colors cursor-pointer",
              !activeSpaceId ? "text-accent" : "text-foreground"
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
                "w-full text-left px-3 py-2 text-sm hover:bg-surface-2 transition-colors cursor-pointer",
                activeSpaceId === space.id ? "text-accent" : "text-foreground"
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
