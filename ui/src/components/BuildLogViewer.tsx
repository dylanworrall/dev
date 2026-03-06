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
    <div className="rounded-xl border border-border bg-surface-0 p-4 font-mono text-xs max-h-80 overflow-y-auto">
      {logs.length === 0 ? (
        <span className="text-muted-foreground">No logs available</span>
      ) : (
        logs.map((line, i) => (
          <div key={i} className="text-muted-foreground py-0.5 leading-5">
            <span className="text-muted select-none mr-3">{String(i + 1).padStart(3, " ")}</span>
            {line}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}
