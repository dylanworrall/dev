"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BotIcon, PlusIcon, GithubIcon, ToggleLeftIcon, ToggleRightIcon,
  GitCommitIcon, GitPullRequestIcon, AlertCircleIcon, GitBranchIcon,
  TrashIcon, ExternalLinkIcon, EyeIcon, BellIcon, CircleDotIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
  new_issue: "text-red-400",
  issue_closed: "text-purple-400",
  new_commit: "text-blue-400",
  new_branch: "text-green-400",
  new_pr: "text-yellow-400",
  pr_merged: "text-purple-400",
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

  // Poll every 30s if any watchers active
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
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <BotIcon className="size-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Watcher Agents</h1>
            <p className="text-sm text-muted-foreground">
              Autonomous agents monitoring your GitHub repos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {watchers.some((w) => w.enabled) && (
            <Button size="sm" variant="outline" onClick={checkNow}>
              Check Now
            </Button>
          )}
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <PlusIcon className="size-4 mr-1" />
            New Agent
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-muted/30 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("agents")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === "agents" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Agents ({watchers.length})
        </button>
        <button
          onClick={() => setActiveTab("activity")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors relative ${
            activeTab === "activity" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Activity
          {unseenCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {unseenCount > 9 ? "9+" : unseenCount}
            </span>
          )}
        </button>
      </div>

      {/* Create dialog */}
      {showCreate && (
        <div className="mb-6 rounded-lg border border-accent/30 bg-accent/5 p-4 space-y-3">
          <h3 className="text-sm font-medium">Deploy New Watcher Agent</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={newRepo}
              onChange={(e) => setNewRepo(e.target.value)}
              placeholder="owner/repo (e.g., facebook/react)"
              className="flex-1 px-3 py-2 rounded-md bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-accent/50"
              onKeyDown={(e) => e.key === "Enter" && createWatcher()}
            />
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Agent name (optional)"
              className="w-40 px-3 py-2 rounded-md bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-accent/50"
              onKeyDown={(e) => e.key === "Enter" && createWatcher()}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={createWatcher} disabled={!newRepo.includes("/")}>
              Deploy Agent
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : activeTab === "agents" ? (
        watchers.length === 0 ? (
          <div className="text-center py-12">
            <BotIcon className="size-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground mb-1">No watcher agents deployed</p>
            <p className="text-sm text-muted-foreground">
              Deploy an agent to monitor a GitHub repo for issues, commits, and PRs.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {watchers.map((w) => (
              <div key={w.id} className="rounded-lg border border-border bg-surface-1 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${w.enabled ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"}`} />
                    <div>
                      <h3 className="text-sm font-semibold">{w.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <GithubIcon className="size-3" />
                        <span>{w.repoFullName}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleWatcher(w.id, !w.enabled)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {w.enabled ? (
                        <ToggleRightIcon className="size-6 text-green-500" />
                      ) : (
                        <ToggleLeftIcon className="size-6" />
                      )}
                    </button>
                    <button
                      onClick={() => removeWatcher(w.id)}
                      className="text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <TrashIcon className="size-4" />
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
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        w[key]
                          ? "border-accent/30 bg-accent/10 text-accent"
                          : "border-border text-muted-foreground hover:border-accent/20"
                      }`}
                    >
                      <Icon className="size-3" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Notify toggles */}
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <button
                    onClick={() => toggleField(w.id, "notifyUser", !w.notifyUser)}
                    className={`flex items-center gap-1 transition-colors ${w.notifyUser ? "text-accent" : ""}`}
                  >
                    <BellIcon className="size-3" />
                    {w.notifyUser ? "Notifications on" : "Notifications off"}
                  </button>
                  <button
                    onClick={() => toggleField(w.id, "reportToAgent", !w.reportToAgent)}
                    className={`flex items-center gap-1 transition-colors ${w.reportToAgent ? "text-accent" : ""}`}
                  >
                    <BotIcon className="size-3" />
                    {w.reportToAgent ? "Reports to agent" : "Agent reporting off"}
                  </button>
                  {w.lastCheckedAt && (
                    <span className="flex items-center gap-1">
                      <EyeIcon className="size-3" />
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
            <p className="text-muted-foreground">No activity yet</p>
            <p className="text-sm text-muted-foreground">
              Events appear here when watcher agents detect changes.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {events.map((event) => {
              const Icon = EVENT_ICONS[event.type] || AlertCircleIcon;
              const color = EVENT_COLORS[event.type] || "text-muted-foreground";
              return (
                <a
                  key={event.id}
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-start gap-3 p-3 rounded-md hover:bg-muted/30 transition-colors ${
                    !event.seen ? "bg-accent/5" : ""
                  }`}
                >
                  <Icon className={`size-4 mt-0.5 flex-shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!event.seen ? "font-medium" : ""}`}>{event.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{event.repo}</span>
                      <span>·</span>
                      <span>{new Date(event.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                  <ExternalLinkIcon className="size-3 text-muted-foreground flex-shrink-0 mt-1" />
                </a>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
