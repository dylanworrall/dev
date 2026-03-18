import { NextRequest, NextResponse } from "next/server";
import { listDeployments } from "@/lib/stores/deployments";
import type { DeployEnvironment, DeployStatus } from "@/lib/stores/deployments";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const environment = searchParams.get("environment") as DeployEnvironment | null;
  const status = searchParams.get("status") as DeployStatus | null;

  if (isConvexMode()) {
    const convex = getConvexClient()!;
    const deployments = await convex.query(api.deployments.list, {
      projectId: projectId ?? undefined,
      environment: environment ?? undefined,
      status: status ?? undefined,
    });
    return NextResponse.json(deployments);
  }

  const deployments = await listDeployments({
    ...(projectId ? { projectId } : {}),
    ...(environment ? { environment } : {}),
    ...(status ? { status } : {}),
  });
  return NextResponse.json(deployments);
}
