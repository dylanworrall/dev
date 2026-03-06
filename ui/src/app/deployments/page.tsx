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
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <RocketIcon className="size-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Deployments</h1>
          <p className="text-sm text-muted-foreground">Build and deploy status</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : deployments.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-2">No deployments yet</p>
          <p className="text-sm text-muted-foreground">
            Use the chat to trigger a deployment: &quot;Deploy to staging&quot;
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border overflow-hidden">
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
              <h3 className="text-sm font-semibold text-foreground mb-2">Build Logs</h3>
              <BuildLogViewer logs={selected.logs} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
