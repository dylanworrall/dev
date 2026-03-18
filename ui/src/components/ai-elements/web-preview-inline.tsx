"use client";

import { memo, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { ExternalLinkIcon, RefreshCwIcon, XIcon, MaximizeIcon } from "lucide-react";

export const WebPreviewInline = memo(({
  url,
  title,
}: {
  url: string;
  title?: string;
}) => {
  const [expanded, setExpanded] = useState(true);
  const [key, setKey] = useState(0);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="text-xs text-accent hover:underline cursor-pointer"
      >
        Show preview: {url}
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="mb-3 rounded-lg border border-border overflow-hidden"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b border-border">
        <div className="flex-1 text-xs text-muted-foreground truncate font-mono">
          {url}
        </div>
        <button
          onClick={() => setKey((k) => k + 1)}
          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCwIcon className="size-3" />
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
          title="Open in new tab"
        >
          <ExternalLinkIcon className="size-3" />
        </a>
        <button
          onClick={() => setExpanded(false)}
          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
          title="Close preview"
        >
          <XIcon className="size-3" />
        </button>
      </div>

      {/* iframe */}
      <div className="relative bg-white" style={{ height: "400px" }}>
        <iframe
          key={key}
          src={url}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title={title || "Web Preview"}
        />
      </div>
    </motion.div>
  );
});
WebPreviewInline.displayName = "WebPreviewInline";
