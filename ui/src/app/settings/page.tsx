"use client";

import { useEffect, useState, useCallback } from "react";
import {
  SettingsIcon,
  SaveIcon,
  KeyIcon,
  ExternalLinkIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  LoaderIcon,
  TerminalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Settings {
  anthropicModel: string;
  googleApiKey: string;
  defaultCategories: string[];
  crawlMaxPages: number;
  crawlRateLimit: number;
  respectRobotsTxt: boolean;
}

interface KeyStatus {
  set: boolean;
  masked: string;
}

interface KeyStates {
  anthropic: KeyStatus;
  google: KeyStatus;
}

type ValidationState = "idle" | "validating" | "valid" | "invalid";

const tabs = [
  { key: "general", label: "General" },
  { key: "git", label: "Git" },
  { key: "cicd", label: "CI/CD" },
  { key: "editor", label: "Editor" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

interface ApiKeyFieldProps {
  label: string;
  provider: string;
  status: KeyStatus;
  dashboardUrl: string;
  dashboardLabel: string;
  placeholder: string;
  description: string;
  onSaved: () => void;
}

function ApiKeyField({
  label,
  provider,
  status,
  dashboardUrl,
  dashboardLabel,
  placeholder,
  description,
  onSaved,
}: ApiKeyFieldProps) {
  const [inputKey, setInputKey] = useState("");
  const [validation, setValidation] = useState<ValidationState>("idle");
  const [error, setError] = useState("");

  const handleSaveKey = useCallback(async () => {
    if (!inputKey.trim()) return;
    setValidation("validating");
    setError("");

    try {
      const resp = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key: inputKey.trim() }),
      });
      const data = await resp.json();

      if (data.valid) {
        setValidation("valid");
        setInputKey("");
        onSaved();
      } else {
        setValidation("invalid");
        setError(data.error || "Invalid key");
      }
    } catch {
      setValidation("invalid");
      setError("Failed to validate key");
    }
  }, [inputKey, provider, onSaved]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </h3>
        <StatusIndicator set={status.set} validation={validation} />
      </div>

      {status.set && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 border border-border">
          <span className="text-sm font-mono text-muted-foreground">{status.masked}</span>
          <CheckCircleIcon className="size-4 text-green-400 ml-auto" />
          <span className="text-xs text-green-400">Connected</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{description}</p>

      <Button variant="outline" size="sm" onClick={() => window.open(dashboardUrl, "_blank")}>
        <KeyIcon className="size-3.5" />
        {dashboardLabel}
        <ExternalLinkIcon className="size-3" />
      </Button>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Or paste your key:</label>
        <div className="flex gap-2">
          <input
            type="password"
            value={inputKey}
            onChange={(e) => {
              setInputKey(e.target.value);
              if (validation !== "idle") setValidation("idle");
            }}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 font-mono"
          />
          <Button size="sm" onClick={handleSaveKey} disabled={!inputKey.trim() || validation === "validating"}>
            {validation === "validating" ? <LoaderIcon className="size-3.5 animate-spin" /> : <SaveIcon className="size-3.5" />}
            Save
          </Button>
        </div>
      </div>

      {validation === "valid" && (
        <div className="flex items-center gap-2 text-xs text-green-400">
          <CheckCircleIcon className="size-3.5" /> Key validated and saved
        </div>
      )}
      {validation === "invalid" && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <XCircleIcon className="size-3.5" /> {error}
        </div>
      )}
    </div>
  );
}

function StatusIndicator({ set, validation }: { set: boolean; validation: ValidationState }) {
  if (validation === "validating") {
    return <span className="flex items-center gap-1 text-xs text-muted-foreground"><LoaderIcon className="size-3 animate-spin" /> Validating...</span>;
  }
  if (validation === "valid" || set) {
    return <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircleIcon className="size-3" /> Connected</span>;
  }
  if (validation === "invalid") {
    return <span className="flex items-center gap-1 text-xs text-red-400"><XCircleIcon className="size-3" /> Invalid</span>;
  }
  return <span className="flex items-center gap-1 text-xs text-muted-foreground"><AlertCircleIcon className="size-3" /> Not set</span>;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [keyStates, setKeyStates] = useState<KeyStates | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("general");

  const loadKeyStates = useCallback(() => {
    fetch("/api/keys").then((r) => r.json()).then(setKeyStates);
  }, []);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
    loadKeyStates();
  }, [loadKeyStates]);

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    const resp = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const updated = await resp.json();
    setSettings(updated);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!settings || !keyStates) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <SettingsIcon className="size-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure the Dev Client</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg bg-surface-1 border border-border w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer",
              activeTab === tab.key
                ? "bg-accent/10 text-accent font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {activeTab === "general" && (
          <>
            <section className="rounded-xl border border-border bg-surface-1 p-4">
              <ApiKeyField
                label="Anthropic API Key"
                provider="anthropic"
                status={keyStates.anthropic}
                dashboardUrl="https://platform.claude.com/settings/keys"
                dashboardLabel="Get API Key"
                placeholder="sk-ant-..."
                description="Required for AI chat. Get your API key from the Anthropic Console."
                onSaved={loadKeyStates}
              />
              <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-surface-2/50 border border-border/50">
                <TerminalIcon className="size-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">Claude Pro/Max users:</span> run{" "}
                  <code className="px-1 py-0.5 rounded bg-surface-3 text-accent font-mono text-[11px]">claude setup-token</code>{" "}
                  in your terminal to generate a token instead.
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-surface-1 p-4">
              <ApiKeyField
                label="Google API Key"
                provider="google"
                status={keyStates.google}
                dashboardUrl="https://console.cloud.google.com/apis/credentials"
                dashboardLabel="Get API Key"
                placeholder="AIza..."
                description="Optional — for higher PageSpeed Insights rate limits."
                onSaved={loadKeyStates}
              />
            </section>

            <section className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">AI Model</h2>
              <input
                type="text"
                value={settings.anthropicModel}
                onChange={(e) => setSettings({ ...settings, anthropicModel: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/50 font-mono"
              />
            </section>
          </>
        )}

        {activeTab === "git" && (
          <section className="rounded-xl border border-border bg-surface-1 p-4 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Git Configuration</h2>
            <p className="text-xs text-muted-foreground">
              Git provider integration coming soon. Configure GitHub/GitLab tokens here.
            </p>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Provider</label>
              <select className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/50">
                <option>GitHub</option>
                <option>GitLab</option>
                <option>Bitbucket</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Access Token</label>
              <input
                type="password"
                placeholder="ghp_..."
                className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Organization</label>
              <input
                type="text"
                placeholder="my-org"
                className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
          </section>
        )}

        {activeTab === "cicd" && (
          <>
            <section className="rounded-xl border border-border bg-surface-1 p-4 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Crawl Settings</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Max Pages</label>
                  <input
                    type="number"
                    value={settings.crawlMaxPages}
                    onChange={(e) => setSettings({ ...settings, crawlMaxPages: parseInt(e.target.value) || 50 })}
                    className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Rate Limit (ms)</label>
                  <input
                    type="number"
                    value={settings.crawlRateLimit}
                    onChange={(e) => setSettings({ ...settings, crawlRateLimit: parseInt(e.target.value) || 1000 })}
                    className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.respectRobotsTxt}
                  onChange={(e) => setSettings({ ...settings, respectRobotsTxt: e.target.checked })}
                  className="rounded accent-accent"
                />
                <label className="text-sm text-foreground">Respect robots.txt</label>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-surface-1 p-4 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Deploy Configuration</h2>
              <p className="text-xs text-muted-foreground">
                Configure deployment providers and build settings per space.
              </p>
            </section>
          </>
        )}

        {activeTab === "editor" && (
          <section className="rounded-xl border border-border bg-surface-1 p-4 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Editor Preferences</h2>
            <p className="text-xs text-muted-foreground">
              Editor preferences and code formatting options coming soon.
            </p>
          </section>
        )}

        <Button onClick={handleSaveSettings} disabled={saving}>
          <SaveIcon className="size-4" />
          {saved ? "Saved!" : saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
