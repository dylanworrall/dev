"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  SettingsIcon,
  CheckCircleIcon,
  LogOutIcon,
  ExternalLinkIcon,
  GithubIcon,
  CloudIcon,
  KeyIcon,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut, authClient, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

const isCloudMode = !!authClient;

interface ProviderState {
  connected: boolean;
  username?: string;
}

const tabs = [
  { key: "integrations", label: "Integrations" },
  { key: "deploy", label: "Deploy" },
  { key: "general", label: "General" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

function TokenInput({
  value,
  onChange,
  onSubmit,
  loading,
  error,
  placeholder,
  helpText,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string;
  placeholder: string;
  helpText: string;
}) {
  return (
    <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
      <p className="text-[12px] font-medium text-white/35">{helpText}</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <KeyIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={14} />
          <input
            type="password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-[#1C1C1E] rounded-lg pl-10 pr-3 py-2.5 text-[14px] font-medium text-white border border-white/5 focus:outline-none focus:border-[#0A84FF]/50 transition-colors placeholder:text-white/30 font-mono"
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          />
        </div>
        <button
          onClick={onSubmit}
          disabled={!value.trim() || loading}
          className="px-4 py-2 bg-[#0A84FF] rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : "Connect"}
        </button>
      </div>
      {error && <p className="text-[12px] font-medium text-[#FF453A]">{error}</p>}
    </div>
  );
}

export default function SettingsPage() {
  return <Suspense><SettingsInner /></Suspense>;
}

function SettingsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<TabKey>("integrations");
  const [toast, setToast] = useState("");

  const [providers, setProviders] = useState<Record<string, ProviderState>>({
    github: { connected: false },
    flyio: { connected: false },
  });

  // Token inputs
  const [flyToken, setFlyToken] = useState("");
  const [flyLoading, setFlyLoading] = useState(false);
  const [flyError, setFlyError] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data?.integrations) {
          setProviders({
            github: { connected: !!data.integrations.github?.configured, username: data.integrations.github?.username },
            flyio: { connected: !!data.integrations.flyio?.configured },
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected) {
      setToast(`${connected} connected successfully`);
      setProviders((p) => ({ ...p, [connected]: { connected: true } }));
      setTimeout(() => setToast(""), 3000);
    }
    const error = searchParams.get("error");
    if (error) {
      setToast(`Error: ${error}`);
      setTimeout(() => setToast(""), 5000);
    }
  }, [searchParams]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const handleDisconnect = async (id: string) => {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ integrations: { [id]: { configured: false, accessToken: null, apiToken: null } } }),
    });
    setProviders((p) => ({ ...p, [id]: { connected: false } }));
  };

  const connectToken = async (provider: string, endpoint: string, token: string, setLoading: (v: boolean) => void, setError: (v: string) => void, clearToken: () => void) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setProviders((p) => ({ ...p, [provider]: { connected: true, username: data.username } }));
      clearToken();
      showToast(`${provider} connected`);
    } catch { setError("Connection failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide px-8 py-10 text-white">
      <div className="max-w-2xl mx-auto">
        {toast && (
          <div className="fixed top-14 right-4 z-50 px-4 py-2.5 rounded-2xl bg-[#1C1C1E]/95 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5 shadow-2xl text-[13px] font-medium text-white/90">
            {toast}
          </div>
        )}

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#0A84FF]/10 text-[#0A84FF]">
            <SettingsIcon size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-1">Settings</h1>
            <p className="text-white/50 text-[13px] font-medium">Manage integrations and deploy config</p>
          </div>
        </div>

        <div className="bg-[#2A2A2C] p-1 rounded-lg flex gap-1 w-fit mb-8 border border-white/[0.08]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                activeTab === tab.key ? "bg-[#3A3A3C] text-white shadow-sm" : "text-white/50 hover:text-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {activeTab === "integrations" && (
            <>
              {isCloudMode && session && (
                <div className="bg-[#2A2A2C] rounded-2xl p-5 border border-white/[0.08] shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-semibold text-white/90">{session.user?.name || "User"}</p>
                      <p className="text-[12px] font-medium text-white/40">{session.user?.email}</p>
                    </div>
                    <button onClick={() => { signOut(); router.replace("/login"); }} className="px-4 py-2 rounded-lg text-sm font-medium border border-[#FF453A]/30 text-[#FF453A] hover:bg-[#FF453A]/10 transition-colors">
                      <LogOutIcon size={14} className="inline mr-1.5" />Log Out
                    </button>
                  </div>
                </div>
              )}

              <h2 className="text-xs font-semibold text-white/40 tracking-wider uppercase mb-4">Integrations</h2>

              {/* GitHub — OAuth flow */}
              <div className="bg-[#2A2A2C] rounded-2xl p-5 border border-white/[0.08] shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 text-white"><GithubIcon size={18} /></div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-white/90">GitHub</h3>
                      <p className="text-[12px] font-medium text-white/40">Repos, issues, PRs, watcher agents</p>
                    </div>
                  </div>
                  {providers.github.connected ? (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px] font-medium text-[#30D158]"><CheckCircleIcon size={10} /> {providers.github.username || "Connected"}</span>
                      <button onClick={() => handleDisconnect("github")} className="px-3 py-1.5 rounded-lg text-[12px] font-medium border border-white/5 text-white/40 hover:text-[#FF453A] hover:border-[#FF453A]/30 transition-colors">Disconnect</button>
                    </div>
                  ) : (
                    <a href="/api/auth/github" className="px-4 py-2 bg-[#0A84FF] rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors shadow-sm inline-block">Connect</a>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-white/5">
                  <div className="flex flex-wrap gap-1.5">
                    {["repo", "workflow", "read:org", "read:user", "user:email"].map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/5 text-white/40">{s}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fly.io — Token paste */}
              <div className="bg-[#2A2A2C] rounded-2xl p-5 border border-white/[0.08] shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#BF5AF2]/10 text-[#BF5AF2]"><CloudIcon size={18} /></div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-white/90">Fly.io</h3>
                      <p className="text-[12px] font-medium text-white/40">Deploy Docker apps to Fly Machines</p>
                    </div>
                  </div>
                  {providers.flyio.connected && (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px] font-medium text-[#30D158]"><CheckCircleIcon size={10} /> Connected</span>
                      <button onClick={() => handleDisconnect("flyio")} className="px-3 py-1.5 rounded-lg text-[12px] font-medium border border-white/5 text-white/40 hover:text-[#FF453A] hover:border-[#FF453A]/30 transition-colors">Disconnect</button>
                    </div>
                  )}
                </div>
                {!providers.flyio.connected && (
                  <TokenInput
                    value={flyToken}
                    onChange={(v) => { setFlyToken(v); setFlyError(""); }}
                    onSubmit={() => connectToken("flyio", "/api/auth/flyio", flyToken, setFlyLoading, setFlyError, () => setFlyToken(""))}
                    loading={flyLoading}
                    error={flyError}
                    placeholder="fo1_..."
                    helpText="Run fly tokens create deploy to generate a token."
                  />
                )}
              </div>
            </>
          )}

          {activeTab === "deploy" && (
            <>
              <div className="bg-[#2A2A2C] rounded-2xl p-5 border border-white/[0.08] shadow-sm space-y-4">
                <h2 className="text-[14px] font-semibold text-white/90">Default Deploy Target</h2>
                <div className="flex gap-3">
                  {[
                    { name: "Fly.io", desc: "Docker & machines", connected: providers.flyio.connected },
                  ].map((t) => (
                    <button key={t.name} className="flex-1 p-4 rounded-xl border border-white/5 bg-[#1C1C1E] hover:border-[#0A84FF]/30 transition-colors text-center">
                      <p className="text-[14px] font-medium text-white/90">{t.name}</p>
                      <p className="text-[11px] text-white/35 mt-1">{t.desc}</p>
                      {!t.connected && <p className="text-[10px] text-[#FF9F0A] mt-2">Not connected</p>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-[#2A2A2C] rounded-2xl p-5 border border-white/[0.08] shadow-sm space-y-3">
                <h2 className="text-[14px] font-semibold text-white/90">Environment Variables</h2>
                <p className="text-[12px] font-medium text-white/35">Variables injected into deployments.</p>
                <div className="bg-[#1C1C1E] rounded-lg p-3 border border-white/5">
                  <p className="text-[12px] font-medium text-white/30 font-mono">No variables configured</p>
                </div>
              </div>
            </>
          )}

          {activeTab === "general" && (
            <>
              <div className="bg-[#2A2A2C] rounded-2xl p-5 border border-white/[0.08] shadow-sm space-y-3">
                <h2 className="text-[14px] font-semibold text-white/90">AI Agent</h2>
                <select className="w-full bg-[#1C1C1E] rounded-lg px-3 py-2.5 text-[14px] font-medium text-white border border-white/5 focus:outline-none focus:border-[#0A84FF]/50 transition-colors">
                  <option>Auto (best available)</option>
                  <option>Claude Code</option>
                  <option>Codex CLI</option>
                </select>
              </div>
              <div className="bg-[#2A2A2C] rounded-2xl p-5 border border-white/[0.08] shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[14px] font-medium text-white/90">Dev Client</p>
                    <p className="text-[12px] font-medium text-white/35">v2.3.0</p>
                  </div>
                  <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white transition-colors"><ExternalLinkIcon size={14} /></a>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
