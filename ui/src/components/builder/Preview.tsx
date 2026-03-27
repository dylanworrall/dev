"use client";

import { Globe, RefreshCw, ExternalLink } from "lucide-react";

interface PreviewProps {
  url: string | null;
}

export function Preview({ url }: PreviewProps) {
  if (!url) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#1C1C1E] text-white/40">
        <Globe size={40} className="text-white/20" />
        <p className="text-[13px] font-medium text-white/50">No preview available yet</p>
        <p className="text-[12px] font-medium text-white/30">Run a dev server to see the preview here</p>
      </div>
    );
  }

  const refresh = () => {
    const iframe = document.getElementById("wc-preview") as HTMLIFrameElement;
    if (iframe) iframe.src = url;
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#1C1C1E]">
      {/* URL bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5 bg-[#2A2A2C]">
        <Globe size={12} className="text-white/40 flex-shrink-0" />
        <span className="text-[11px] text-white/40 truncate flex-1 font-mono">
          {url}
        </span>
        <button
          type="button"
          onClick={refresh}
          className="p-1 hover:bg-[#3A3A3C] rounded-md text-white/40 hover:text-white transition-colors"
        >
          <RefreshCw size={12} />
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 hover:bg-[#3A3A3C] rounded-md text-white/40 hover:text-white transition-colors"
        >
          <ExternalLink size={12} />
        </a>
      </div>

      {/* iframe */}
      <iframe
        id="wc-preview"
        src={url}
        title="Preview"
        className="flex-1 w-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </div>
  );
}
