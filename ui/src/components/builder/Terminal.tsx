"use client";

import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  onReady?: (terminal: XTerm) => void;
}

export function Terminal({ onReady }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    const terminal = new XTerm({
      theme: {
        background: "#050507",
        foreground: "#F5F5F7",
        cursor: "#F97316",
        selectionBackground: "#F9731640",
        black: "#050507",
        red: "#EF4444",
        green: "#22C55E",
        yellow: "#F97316",
        blue: "#3B82F6",
        magenta: "#A855F7",
        cyan: "#06B6D4",
        white: "#F5F5F7",
      },
      fontSize: 13,
      fontFamily: "var(--font-geist-mono), 'Cascadia Code', 'Fira Code', monospace",
      cursorBlink: true,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.writeln("\x1b[38;2;249;115;22m[dev]\x1b[0m WebContainer terminal ready");
    terminal.writeln("");

    onReady?.(terminal);

    const obs = new ResizeObserver(() => {
      fitAddon.fit();
    });
    obs.observe(containerRef.current);

    return () => {
      obs.disconnect();
      terminal.dispose();
      terminalRef.current = null;
    };
  }, [onReady]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-[#050507] p-2"
    />
  );
}
