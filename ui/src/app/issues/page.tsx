"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BotIcon, PlusIcon, GithubIcon, ToggleLeftIcon, ToggleRightIcon,
  GitCommitIcon, GitPullRequestIcon, AlertCircleIcon, GitBranchIcon,
  TrashIcon, ExternalLinkIcon, EyeIcon, BellIcon, CircleDotIcon,
} from "lucide-react";

interface Watcher {
  id: string;
  name: string;
  repoFullName: string;
  enabled: boolean;
  watchIssues: boolean;
  watchCommits: boolean;
  watchBranches: boolean;
  watchPRs: boolean;
  notifyUser: boolean;
  reportToAgent: boolean;
  lastCheckedAt: string | null;
  createdAt: string;
}

interface WatcherEvent {
  id: string;
  watcherId: string;
  type: string;
  title: string;
  description: string;
  url: string;
  repo: string;
  timestamp: string;
  seen: boolean;
}

const EVENT_ICONS: Record<string, typeof AlertCircleIcon> = {
  new_issue: AlertCircleIcon,
  issue_closed: CircleDotIcon,
  new_commit: GitCommitIcon,
  new_branch: GitBranchIcon,
  new_pr: GitPullRequestIcon,
  pr_merged: GitPullRequestIcon,
};

const EVENT_COLORS: Record<string, string> = {
  new_issue: "text-[#FF453A]",
  issue_closed: "text-[#BF5AF2]",
  new_commit: "text-[#0A84FF]",
  new_branch: "text-[#30D158]",
  new_pr: "text-[#FF9F0A]",
  pr_merged: "text-[#BF5AF2]",
};

export default function IssuesPage() {
  const router = useRouter();
  const [watchers, setWatchers] = useState<Watcher[]>([]);
  const [events, setEvents] = useState<WatcherEvent[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newRepo, setNewRepo] = useState("");
  const [newName, setNewName] = useState("");
  const [activeTab, setActiveTab] = useState<"agents" | "activity">("agents");

  const fetchData = useCallback(async () => {
    try {
      const [watcherRes, eventRes] = await Promise.all([
        fetch("/api/watchers").then((r) => r.json()),
        fetch("/api/watchers?type=events").then((r) => r.json()),
      ]);
      setWatchers(watcherRes.watchers || []);
      setEvents(eventRes.events || []);
      setUnseenCount(eventRes.unseenCount || 0);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const hasActive = watchers.some((w) => w.enabled);
    if (!hasActive) return;
    const interval = setInterval(async () => {
      await fetch("/api/watchers/check", { method: "POST" });
      await fetchData();
    }, 30_000);
    return () => clearInterval(interval);
  }, [watchers, fetchData]);

  const createWatcher = async () => {
    if (!newRepo.includes("/")) return;
    await fetch("/api/watchers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        name: newName || newRepo.split("/")[1],
        repoFullName: newRepo,
      }),
    });
    setNewRepo("");
    setNewName("");
    setShowCreate(false);
    fetchData();
  };

  const toggleWatcher = async (id: string, enabled: boolean) => {
    await fetch("/api/watchers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, updates: { enabled } }),
    });
    fetchData();
  };

  const toggleField = async (id: string, field: string, value: boolean) => {
    await fetch("/api/watchers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, updates: { [field]: value } }),
    });
    fetchData();
  };

  const removeWatcher = async (id: string) => {
    await fetch("/api/watchers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    fetchData();
  };

  const checkNow = async () => {
    await fetch("/api/watchers/check", { method: "POST" });
    fetchData();
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide p-6 text-white">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#30D158]/10 text-[#30D158]">
              <BotIcon size={18} />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">Watcher Agents</h1>
              <p className="text-white/50 text-sm">Autonomous agents monitoring your GitHub repos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {watchers.some((w) => w.enabled) && (
              <button onClick={checkNow} className="px-4 py-2 rounded-lg text-sm font-medium border border-white/5 bg-[#2A2A2C] hover:bg-[#3A3A3C] transition-colors shadow-sm">
                Check Now
              </button>
            )}
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-[#0A84FF] rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-blue-500 transition-colors shadow-sm">
              <PlusIcon size={16} /> New Agent
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-[#2A2A2C] p-1 rounded-lg flex gap-1 w-fit mb-6 border border-white/5">
          <button
            onClick={() => setActiveTab("agents")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "agents" ? "bg-[#3A3A3C] text-white shadow-sm" : "text-white/50 hover:text-white"
            }`}
          >
            Agents ({watchers.length})
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors relative ${
              activeTab === "activity" ? "bg-[#3A3A3C] text-white shadow-sm" : "text-white/50 hover:text-white"
            }`}
          >
            Activity
            {unseenCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#FF453A] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-medium">
                {unseenCount > 9 ? "9+" : unseenCount}
              </span>
            )}
          </button>
        </div>

        {/* Create dialog */}
        {showCreate && (
          <div className="mb-6 rounded-2xl border border-[#0A84FF]/30 bg-[#0A84FF]/5 p-5 space-y-3 shadow-sm">
            <h3 className="text-[14px] font-semibold text-white/90">Deploy New Watcher Agent</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={newRepo}
                onChange={(e) => setNewRepo(e.target.value)}
                placeholder="owner/repo (e.g., facebook/react)"
                className="flex-1 bg-[#1C1C1E] rounded-lg px-3 py-2.5 text-[14px] font-medium text-white border border-white/5 focus:outline-none focus:border-[#0A84FF]/50 transition-colors placeholder:text-white/20"
                onKeyDown={(e) => e.key === "Enter" && createWatcher()}
              />
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Agent name (optional)"
                className="w-40 bg-[#1C1C1E] rounded-lg px-3 py-2.5 text-[14px] font-medium text-white border border-white/5 focus:outline-none focus:border-[#0A84FF]/50 transition-colors placeholder:text-white/20"
                onKeyDown={(e) => e.key === "Enter" && createWatcher()}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={createWatcher} disabled={!newRepo.includes("/")} className="px-4 py-2 bg-[#0A84FF] rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
                Deploy Agent
              </button>
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-white/5 bg-[#2A2A2C] hover:bg-[#3A3A3C] transition-colors shadow-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-white/40 text-[13px] font-medium">Loading...</div>
        ) : activeTab === "agents" ? (
          watchers.length === 0 ? (
            <div className="text-center py-12">
              <BotIcon size={48} className="text-white/20 mx-auto mb-3" />
              <p className="text-white/50 mb-1 text-[15px] font-medium">No watcher agents deployed</p>
              <p className="text-[13px] font-medium text-white/35">
                Deploy an agent to monitor a GitHub repo for issues, commits, and PRs.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {watchers.map((w) => (
                <div key={w.id} className="bg-[#2A2A2C] rounded-2xl p-5 border border-white/5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${w.enabled ? "bg-[#30D158] animate-pulse" : "bg-white/20"}`} />
                      <div>
                        <h3 className="text-[14px] font-semibold text-white/90">{w.name}</h3>
                        <div className="flex items-center gap-1 text-[11px] text-white/40">
                          <GithubIcon size={10} />
                          <span>{w.repoFullName}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleWatcher(w.id, !w.enabled)}
                        className="text-white/40 hover:text-white transition-colors"
                      >
                        {w.enabled ? (
                          <ToggleRightIcon size={22} className="text-[#30D158]" />
                        ) : (
                          <ToggleLeftIcon size={22} />
                        )}
                      </button>
                      <button
                        onClick={() => removeWatcher(w.id)}
                        className="text-white/40 hover:text-[#FF453A] transition-colors"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Watch toggles */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {([
                      { key: "watchIssues", label: "Issues", icon: AlertCircleIcon },
                      { key: "watchCommits", label: "Commits", icon: GitCommitIcon },
                      { key: "watchPRs", label: "PRs", icon: GitPullRequestIcon },
                      { key: "watchBranches", label: "Branches", icon: GitBranchIcon },
                    ] as const).map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        onClick={() => toggleField(w.id, key, !w[key])}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border transition-colors ${
                          w[key]
                            ? "border-[#0A84FF]/30 bg-[#0A84FF]/10 text-[#0A84FF]"
                            : "border-white/5 text-white/40 hover:border-[#0A84FF]/20"
                        }`}
                      >
                        <Icon size={10} />
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Notify toggles */}
                  <div className="flex gap-3 text-[11px] text-white/40">
                    <button
                      onClick={() => toggleField(w.id, "notifyUser", !w.notifyUser)}
                      className={`flex items-center gap-1 transition-colors ${w.notifyUser ? "text-[#0A84FF]" : ""}`}
                    >
                      <BellIcon size={10} />
                      {w.notifyUser ? "Notifications on" : "Notifications off"}
                    </button>
                    <button
                      onClick={() => toggleField(w.id, "reportToAgent", !w.reportToAgent)}
                      className={`flex items-center gap-1 transition-colors ${w.reportToAgent ? "text-[#0A84FF]" : ""}`}
                    >
                      <BotIcon size={10} />
                      {w.reportToAgent ? "Reports to agent" : "Agent reporting off"}
                    </button>
                    {w.lastCheckedAt && (
                      <span className="flex items-center gap-1">
                        <EyeIcon size={10} />
                        Checked: {new Date(w.lastCheckedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Activity feed */
          events.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/50 text-[15px] font-medium">No activity yet</p>
              <p className="text-[13px] font-medium text-white/35">
                Events appear here when watcher agents detect changes.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {events.map((event) => {
                const Icon = EVENT_ICONS[event.type] || AlertCircleIcon;
                const color = EVENT_COLORS[event.type] || "text-white/40";
                return (
                  <a
                    key={event.id}
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group flex items-start gap-3 p-4 rounded-xl hover:bg-[#2A2A2C] transition-colors border border-transparent hover:border-white/5 ${
                      !event.seen ? "bg-[#0A84FF]/5" : ""
                    }`}
                  >
                    <Icon size={14} className={`mt-0.5 flex-shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium ${!event.seen ? "text-white/90" : "text-white/70"}`}>{event.title}</p>
                      <div className="flex items-center gap-2 text-[11px] text-white/40 mt-0.5">
                        <span>{event.repo}</span>
                        <span>·</span>
                        <span>{new Date(event.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                    <ExternalLinkIcon size={12} className="text-white/20 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-colors" />
                  </a>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
