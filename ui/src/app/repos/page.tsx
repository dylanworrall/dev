"use client";

import { useEffect, useState } from "react";
import { GitBranchIcon, SearchIcon } from "lucide-react";
import { RepoCard } from "@/components/RepoCard";

interface Repo {
  id: string;
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
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState("");

  useEffect(() => {
    fetch("/api/repos")
      .then((r) => r.json())
      .then(setRepos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const languages = [...new Set(repos.map((r) => r.language).filter(Boolean))];

  const filtered = repos.filter((r) => {
    const matchesSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.fullName.toLowerCase().includes(search.toLowerCase());
    const matchesLang = !langFilter || r.language.toLowerCase() === langFilter.toLowerCase();
    return matchesSearch && matchesLang;
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <GitBranchIcon className="size-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Repos</h1>
          <p className="text-sm text-muted-foreground">Tracked repositories</p>
        </div>
      </div>

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
          {filtered.map((repo) => (
            <RepoCard key={repo.id} {...repo} />
          ))}
        </div>
      )}
    </div>
  );
}
