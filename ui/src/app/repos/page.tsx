"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranchIcon, SearchIcon, GithubIcon, LinkIcon } from "lucide-react";
import { RepoCard } from "@/components/RepoCard";
import { Button } from "@/components/ui/button";

interface Repo {
  id?: string;
  _id?: string;
  name: string;
  fullName: string;
  url: string;
  language: string;
  description: string;
  stars: number;
  lastPush: string;
  defaultBranch: string;
}

export default function ReposPage() {
  const router = useRouter();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState("");
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/repos")
      .then((r) => r.json())
      .then(setRepos)
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setGithubConnected(data?.integrations?.github?.configured || false);
      })
      .catch(() => setGithubConnected(false));
  }, []);

  const languages = [...new Set(repos.map((r) => r.language).filter(Boolean))];

  const filtered = repos.filter((r) => {
    const matchesSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.fullName.toLowerCase().includes(search.toLowerCase());
    const matchesLang = !langFilter || r.language.toLowerCase() === langFilter.toLowerCase();
    return matchesSearch && matchesLang;
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <GitBranchIcon className="size-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Repos</h1>
            <p className="text-sm text-muted-foreground">Tracked repositories</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push("/?project=connect-github")}
        >
          <LinkIcon className="size-4 mr-1" />
          Track Repo
        </Button>
      </div>

      {/* GitHub connection banner */}
      {githubConnected === false && (
        <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
            <GithubIcon className="size-5 text-yellow-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">GitHub not connected</p>
            <p className="text-xs text-muted-foreground">Connect your GitHub account to track repos, review PRs, and manage issues.</p>
          </div>
          <Button
            size="sm"
            onClick={() => router.push("/?project=connect-github")}
          >
            Connect
          </Button>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repos..."
            className="w-full pl-10 pr-3 py-2 rounded-lg bg-surface-1 border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
        {languages.length > 0 && (
          <select
            value={langFilter}
            onChange={(e) => setLangFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface-1 border border-border text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/50"
          >
            <option value="">All Languages</option>
            {languages.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-2">
            {repos.length === 0 ? "No repos tracked yet" : "No repos match your filter"}
          </p>
          <p className="text-sm text-muted-foreground">
            Use the chat to track a repo: &quot;Track the repo owner/name&quot;
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((repo, idx) => (
            <RepoCard key={repo.id || repo._id || idx} {...repo} />
          ))}
        </div>
      )}
    </div>
  );
}
