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
      className="p-1 hover:bg-surface-2 rounded text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="size-3.5 text-accent-green" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function CommandBlock({ command, label }: { command: string; label: string }) {
  return (
    <div className="bg-[#050507] rounded-lg p-3 font-mono text-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        <CopyButton text={command} />
      </div>
      <code className="text-accent">{command}</code>
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
    <div className="flex items-center justify-center min-h-screen bg-surface-0 p-6">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
            <Terminal className="size-6 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Set up your agents</h1>
          <p className="text-sm text-muted-foreground">
            The Builder uses AI coding agents to write code. You need at least one installed.
          </p>
        </div>

        {/* Agent status cards */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Claude Code */}
              <AgentCard
                name="Claude Code"
                description="Anthropic's coding agent. Best code quality, largest context."
                status={agents.find((a) => a.name === "claude-code")}
                installCommand="npm i -g @anthropic-ai/claude-code"
                loginCommand="claude login"
                docsUrl="https://docs.anthropic.com/en/docs/claude-code"
              />

              {/* Codex */}
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
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-surface-1 transition-colors disabled:opacity-50"
        >
          {checking ? <Loader2 className="size-4 animate-spin" /> : null}
          Re-check agents
        </button>

        {/* Continue button */}
        <button
          type="button"
          onClick={onComplete}
          disabled={!hasAnyAgent}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Continue to Builder
          <ArrowRight className="size-4" />
        </button>

        {!hasAnyAgent && !loading && (
          <p className="text-center text-xs text-muted-foreground">
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
    <div className={`rounded-xl border p-4 space-y-3 transition-colors ${
      available ? "border-accent-green/30 bg-accent-green/5" : "border-border bg-surface-1"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {available ? (
            <CheckCircle className="size-5 text-accent-green" />
          ) : (
            <XCircle className="size-5 text-muted-foreground" />
          )}
          <div>
            <div className="font-semibold text-sm text-foreground">{name}</div>
            <div className="text-xs text-muted-foreground">{description}</div>
          </div>
        </div>
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 hover:bg-surface-2 rounded text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="size-3.5" />
        </a>
      </div>

      {!available && (
        <div className="space-y-2">
          <CommandBlock command={installCommand} label="Install" />
          {loginCommand && <CommandBlock command={loginCommand} label="Login" />}
          {envNote && (
            <p className="text-xs text-muted-foreground px-1">{envNote}</p>
          )}
          {status?.error && (
            <p className="text-xs text-accent-red px-1">{status.error}</p>
          )}
        </div>
      )}

      {available && (
        <p className="text-xs text-accent-green px-1">Ready to use</p>
      )}
    </div>
  );
}
