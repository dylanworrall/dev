"use client";

import { Globe, RefreshCw, ExternalLink } from "lucide-react";

interface PreviewProps {
  url: string | null;
}

export function Preview({ url }: PreviewProps) {
  if (!url) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-surface-0 text-muted-foreground">
        <Globe className="size-10 opacity-30" />
        <p className="text-sm">No preview available yet</p>
        <p className="text-xs opacity-60">Run a dev server to see the preview here</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-surface-0">
      {/* URL bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-surface-1">
        <Globe className="size-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground truncate flex-1 font-mono">
          {url}
        </span>
        <button
          type="button"
          onClick={() => {
            const iframe = document.getElementById("wc-preview") as HTMLIFrameElement;
            if (iframe) iframe.src = url;
          }}
          className="p-1 hover:bg-surface-2 rounded text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="size-3" />
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 hover:bg-surface-2 rounded text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="size-3" />
        </a>
      </div>

      {/* iframe */}
      <iframe
        id="wc-preview"
        src={url}
        title="Preview"
        className="flex-1 w-full border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </div>
  );
}
