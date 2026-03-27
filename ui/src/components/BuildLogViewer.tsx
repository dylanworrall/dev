"use client";

import { useRef, useEffect } from "react";

interface BuildLogViewerProps {
  logs: string[];
}

export function BuildLogViewer({ logs }: BuildLogViewerProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="rounded-2xl border border-white/5 bg-[#1C1C1E] p-4 font-mono text-[12px] max-h-80 overflow-y-auto shadow-sm">
      {logs.length === 0 ? (
        <span className="text-white/40">No logs available</span>
      ) : (
        logs.map((line, i) => (
          <div key={i} className="text-white/40 py-0.5 leading-5">
            <span className="text-white/20 select-none mr-3 tabular-nums">{String(i + 1).padStart(3, " ")}</span>
            {line}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}
