"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranchIcon, SearchIcon, GithubIcon, LinkIcon } from "lucide-react";
import { RepoCard } from "@/components/RepoCard";

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
    <div className="flex-1 overflow-y-auto scrollbar-hide p-6 text-white">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#BF5AF2]/10 text-[#BF5AF2]">
              <GitBranchIcon size={18} />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">Repos</h1>
              <p className="text-white/50 text-sm">Tracked repositories</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/?project=connect-github")}
            className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium border border-white/5 bg-[#2A2A2C] hover:bg-[#3A3A3C] transition-colors shadow-sm"
          >
            <LinkIcon size={16} /> Track Repo
          </button>
        </div>

        {/* GitHub connection banner */}
        {githubConnected === false && (
          <div className="mb-6 rounded-2xl border border-[#FF9F0A]/30 bg-[#FF9F0A]/5 p-5 flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#FF9F0A]/10 flex items-center justify-center flex-shrink-0">
              <GithubIcon size={18} className="text-[#FF9F0A]" />
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-white/90">GitHub not connected</p>
              <p className="text-[12px] font-medium text-white/40">Connect your GitHub account to track repos, review PRs, and manage issues.</p>
            </div>
            <button
              onClick={() => router.push("/?project=connect-github")}
              className="px-4 py-2 bg-[#0A84FF] rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors shadow-sm"
            >
              Connect
            </button>
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={14} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repos..."
              className="w-full bg-[#1C1C1E] rounded-lg pl-10 pr-3 py-2.5 text-[14px] font-medium text-white border border-white/5 focus:outline-none focus:border-[#0A84FF]/50 transition-colors placeholder:text-white/20"
            />
          </div>
          {languages.length > 0 && (
            <select
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-[#1C1C1E] border border-white/5 text-[14px] font-medium text-white focus:outline-none focus:border-[#0A84FF]/50 transition-colors"
            >
              <option value="">All Languages</option>
              {languages.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-white/40 text-[13px] font-medium">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/50 mb-2 text-[15px] font-medium">
              {repos.length === 0 ? "No repos tracked yet" : "No repos match your filter"}
            </p>
            <p className="text-[13px] font-medium text-white/35">
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
    </div>
  );
}
