"use client";

import { useEffect, useState } from "react";
import { RocketIcon } from "lucide-react";
import { DeploymentRow } from "@/components/DeploymentRow";
import { BuildLogViewer } from "@/components/BuildLogViewer";

interface Deployment {
  id: string;
  environment: string;
  status: string;
  commitSha: string;
  branch: string;
  url: string;
  logs: string[];
  buildDuration?: number;
  createdAt: string;
}

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/deployments")
      .then((r) => r.json())
      .then(setDeployments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selected = deployments.find((d) => d.id === selectedId);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide p-6 text-white">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#FF9F0A]/10 text-[#FF9F0A]">
            <RocketIcon size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-1">Deployments</h1>
            <p className="text-white/50 text-sm">Build and deploy status</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-white/40 text-[13px] font-medium">Loading...</div>
        ) : deployments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/50 mb-2 text-[15px] font-medium">No deployments yet</p>
            <p className="text-[13px] font-medium text-white/35">
              Use the chat to trigger a deployment: &quot;Deploy to staging&quot;
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-[#2A2A2C] rounded-2xl border border-white/5 shadow-sm overflow-hidden">
              {deployments.map((d) => (
                <div
                  key={d.id}
                  onClick={() => setSelectedId(selectedId === d.id ? null : d.id)}
                  className="cursor-pointer"
                >
                  <DeploymentRow
                    environment={d.environment}
                    status={d.status}
                    commitSha={d.commitSha}
                    branch={d.branch}
                    url={d.url}
                    createdAt={d.createdAt}
                    buildDuration={d.buildDuration}
                  />
                </div>
              ))}
            </div>

            {selected && (
              <div>
                <h3 className="text-[14px] font-semibold text-white/90 mb-3">Build Logs</h3>
                <BuildLogViewer logs={selected.logs} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
