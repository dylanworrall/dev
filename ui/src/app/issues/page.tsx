"use client";

import { useEffect, useState } from "react";
import { CircleDotIcon } from "lucide-react";
import { IssueRow } from "@/components/IssueRow";
import { cn } from "@/lib/utils";

interface Issue {
  id: string;
  title: string;
  status: "open" | "in-progress" | "closed";
  priority: "low" | "medium" | "high" | "critical";
  labels: string[];
  assignee: string;
  createdAt: string;
}

const tabs = [
  { key: "", label: "All" },
  { key: "open", label: "Open" },
  { key: "in-progress", label: "In Progress" },
  { key: "closed", label: "Closed" },
] as const;

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("");

  useEffect(() => {
    const url = activeTab ? `/api/issues?status=${activeTab}` : "/api/issues";
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then(setIssues)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeTab]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <CircleDotIcon className="size-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Issues</h1>
          <p className="text-sm text-muted-foreground">Track bugs and tasks</p>
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

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : issues.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-2">No issues found</p>
          <p className="text-sm text-muted-foreground">
            Use the chat to create an issue: &quot;Create an issue for login bug&quot;
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {issues.map((issue) => (
            <IssueRow
              key={issue.id}
              title={issue.title}
              status={issue.status}
              priority={issue.priority}
              labels={issue.labels}
              assignee={issue.assignee}
              createdAt={issue.createdAt}
            />
          ))}
        </div>
      )}
    </div>
  );
}
