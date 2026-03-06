"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  KeyIcon,
  ExternalLinkIcon,
  LoaderIcon,
  CheckCircleIcon,
  XCircleIcon,
  TerminalIcon,
  EyeIcon,
  EyeOffIcon,
  ArrowRightIcon,
  AlertTriangleIcon,
  CodeIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type AuthState = "choose" | "validating" | "success" | "error";

export default function LoginPage() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>("choose");
  const [error, setError] = useState("");
  const [maskedKey, setMaskedKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => {
        if (data.connected) {
          setMaskedKey(data.masked || "");
          setState("success");
        }
      })
      .catch(() => {});
  }, []);

  const handleApiKey = useCallback(async (key: string) => {
    setState("validating");
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "api-key", apiKey: key }),
      });
      const data = await res.json();
      if (data.success) {
        setMaskedKey(data.masked || "");
        setState("success");
      } else {
        setError(data.error || "Authentication failed");
        setState("error");
      }
    } catch {
      setError("Network error. Please try again.");
      setState("error");
    }
  }, []);

  const handleSetupToken = useCallback(async (token: string) => {
    setState("validating");
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "setup-token", token }),
      });
      const data = await res.json();
      if (data.success) {
        setMaskedKey(data.masked || "");
        setState("success");
      } else {
        setError(data.error || "Authentication failed");
        setState("error");
      }
    } catch {
      setError("Network error. Please try again.");
      setState("error");
    }
  }, []);

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <CodeIcon className="size-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Dev Client</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Connect your Anthropic account to get started.
          </p>
        </div>

        {/* Success State */}
        {state === "success" && (
          <div className="rounded-2xl border border-border bg-surface-1 p-6 text-center shadow-elevation-1">
            <CheckCircleIcon className="size-12 text-accent-green mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-1">Connected</h2>
            {maskedKey && (
              <p className="text-sm text-muted-foreground font-mono mb-4">{maskedKey}</p>
            )}
            <Button onClick={() => router.push("/")} className="w-full rounded-xl">
              Go to Chat <ArrowRightIcon className="size-4" />
            </Button>
          </div>
        )}

        {/* Validating State */}
        {state === "validating" && (
          <div className="rounded-2xl border border-border bg-surface-1 p-6 text-center shadow-elevation-1">
            <LoaderIcon className="size-12 text-accent animate-spin mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-foreground">Validating...</h2>
            <p className="text-sm text-muted-foreground mt-1">Checking credentials with Anthropic.</p>
          </div>
        )}

        {/* Error State */}
        {state === "error" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-accent-red/30 bg-accent-red/5 p-4 text-center">
              <XCircleIcon className="size-8 text-accent-red mx-auto mb-2" />
              <p className="text-sm text-accent-red">{error}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => { setState("choose"); setError(""); }}
              className="w-full rounded-xl"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Choose Auth Method */}
        {state === "choose" && (
          <div className="space-y-3">
            {/* Method 1: API Key */}
            <div className="rounded-2xl border border-border bg-surface-1 p-4 shadow-elevation-1">
              <button
                type="button"
                onClick={() => {
                  window.open("https://console.anthropic.com/settings/keys", "_blank");
                  setShowKeyInput(true);
                }}
                className="flex items-start gap-3 w-full text-left cursor-pointer"
              >
                <KeyIcon className="size-5 text-accent flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">Get API Key</span>
                    <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
                      RECOMMENDED
                    </span>
                    <ExternalLinkIcon className="size-3 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Opens console.anthropic.com to create or copy your API key
                  </p>
                </div>
              </button>

              {showKeyInput && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showKey ? "text" : "password"}
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder="sk-ant-..."
                        className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 pr-9 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showKey ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
                      </button>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleApiKey(apiKeyInput.trim())}
                      disabled={!apiKeyInput.trim().startsWith("sk-ant-")}
                      className="h-[38px] rounded-xl"
                    >
                      Connect
                    </Button>
                  </div>
                </div>
              )}

              {!showKeyInput && (
                <button
                  type="button"
                  onClick={() => setShowKeyInput(true)}
                  className="mt-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Already have a key? Paste it here
                </button>
              )}
            </div>

            {/* Method 2: Setup Token */}
            <div className="rounded-2xl border border-border bg-surface-1 p-4 shadow-elevation-1">
              <button
                type="button"
                onClick={() => setShowTokenInput(!showTokenInput)}
                className="flex items-start gap-3 w-full text-left cursor-pointer"
              >
                <TerminalIcon className="size-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm font-medium text-foreground">
                    Claude Subscription (setup-token)
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Use your Claude Pro/Max subscription via setup token
                  </p>
                </div>
              </button>

              {showTokenInput && (
                <div className="mt-3 space-y-3">
                  <div className="text-xs text-muted-foreground">Run this in your terminal:</div>
                  <div className="rounded-xl bg-surface-2 border border-border px-3 py-2">
                    <code className="text-sm text-accent font-mono">claude setup-token</code>
                  </div>
                  <div className="text-xs text-muted-foreground">Then paste the token below:</div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showToken ? "text" : "password"}
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="Paste token..."
                        className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 pr-9 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showToken ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
                      </button>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSetupToken(tokenInput.trim())}
                      disabled={!tokenInput.trim()}
                      className="h-[38px] rounded-xl"
                    >
                      Connect
                    </Button>
                  </div>
                  <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <AlertTriangleIcon className="size-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-400">
                      Uses your Claude Pro/Max subscription. May be restricted by Anthropic TOS.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
