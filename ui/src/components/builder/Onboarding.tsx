"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Terminal,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";

interface AgentStatus {
  name: string;
  available: boolean;
  error?: string;
}

interface OnboardingProps {
  onComplete: () => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1 hover:bg-[#3A3A3C] rounded-md text-white/40 hover:text-white transition-colors"
    >
      {copied ? <Check size={12} className="text-[#30D158]" /> : <Copy size={12} />}
    </button>
  );
}

function CommandBlock({ command, label }: { command: string; label: string }) {
  return (
    <div className="bg-[#1C1C1E] rounded-lg p-3 font-mono text-[13px] border border-white/5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-white/40 uppercase tracking-wider font-sans">{label}</span>
        <CopyButton text={command} />
      </div>
      <code className="text-[#0A84FF]">{command}</code>
    </div>
  );
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const checkAgents = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(
          data.agents
            .filter((a: { name: string }) => a.name !== "jules" && a.name !== "webcontainer")
            .map((a: { name: string; health: { available: boolean; error?: string } }) => ({
              name: a.name,
              available: a.health.available,
              error: a.health.error,
            }))
        );
      }
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
      setChecking(false);
    }
  };

  useEffect(() => {
    checkAgents();
  }, []);

  const hasAnyAgent = agents.some((a) => a.available);

  return (
    <div className="flex items-center justify-center min-h-screen bg-black p-6">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#0A84FF]/10 flex items-center justify-center mx-auto">
            <Terminal size={24} className="text-[#0A84FF]" />
          </div>
          <h1 className="text-2xl font-bold text-white">Set up your agents</h1>
          <p className="text-[13px] font-medium text-white/50">
            The Builder uses AI coding agents to write code. You need at least one installed.
          </p>
        </div>

        {/* Agent status cards */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin text-white/40" />
            </div>
          ) : (
            <>
              <AgentCard
                name="Claude Code"
                description="Anthropic's coding agent. Best code quality, largest context."
                status={agents.find((a) => a.name === "claude-code")}
                installCommand="npm i -g @anthropic-ai/claude-code"
                loginCommand="claude login"
                docsUrl="https://docs.anthropic.com/en/docs/claude-code"
              />
              <AgentCard
                name="Codex CLI"
                description="OpenAI's coding agent. Sandboxed execution, streaming progress."
                status={agents.find((a) => a.name === "codex")}
                installCommand="npm i -g @openai/codex"
                envNote="Set OPENAI_API_KEY in your .env.local"
                docsUrl="https://github.com/openai/codex"
              />
            </>
          )}
        </div>

        {/* Re-check button */}
        <button
          type="button"
          onClick={checkAgents}
          disabled={checking}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-white/5 bg-[#2A2A2C] text-sm font-medium text-white hover:bg-[#3A3A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          {checking ? <Loader2 size={14} className="animate-spin" /> : null}
          Re-check agents
        </button>

        {/* Continue button */}
        <button
          type="button"
          onClick={onComplete}
          disabled={!hasAnyAgent}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#0A84FF] text-white text-sm font-semibold hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-[#0A84FF]/20"
        >
          Continue to Builder
          <ArrowRight size={16} />
        </button>

        {!hasAnyAgent && !loading && (
          <p className="text-center text-[12px] font-medium text-white/40">
            Install at least one agent to continue
          </p>
        )}
      </div>
    </div>
  );
}

function AgentCard({
  name,
  description,
  status,
  installCommand,
  loginCommand,
  envNote,
  docsUrl,
}: {
  name: string;
  description: string;
  status?: AgentStatus;
  installCommand: string;
  loginCommand?: string;
  envNote?: string;
  docsUrl: string;
}) {
  const available = status?.available ?? false;

  return (
    <div className={`rounded-2xl border p-5 space-y-3 transition-colors shadow-sm ${
      available ? "border-[#30D158]/30 bg-[#30D158]/5" : "border-white/5 bg-[#2A2A2C]"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {available ? (
            <CheckCircle size={18} className="text-[#30D158]" />
          ) : (
            <XCircle size={18} className="text-white/40" />
          )}
          <div>
            <div className="text-[14px] font-semibold text-white/90">{name}</div>
            <div className="text-[12px] font-medium text-white/40">{description}</div>
          </div>
        </div>
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 hover:bg-[#3A3A3C] rounded-lg text-white/40 hover:text-white transition-colors"
        >
          <ExternalLink size={12} />
        </a>
      </div>

      {!available && (
        <div className="space-y-2">
          <CommandBlock command={installCommand} label="Install" />
          {loginCommand && <CommandBlock command={loginCommand} label="Login" />}
          {envNote && (
            <p className="text-[12px] font-medium text-white/40 px-1">{envNote}</p>
          )}
          {status?.error && (
            <p className="text-[12px] font-medium text-[#FF453A] px-1">{status.error}</p>
          )}
        </div>
      )}

      {available && (
        <p className="text-[12px] font-medium text-[#30D158] px-1">Ready to use</p>
      )}
    </div>
  );
}
