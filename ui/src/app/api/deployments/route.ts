import { NextRequest, NextResponse } from "next/server";
import { listDeployments } from "@/lib/stores/deployments";
import type { DeployEnvironment, DeployStatus } from "@/lib/stores/deployments";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const environment = searchParams.get("environment") as DeployEnvironment | null;
  const status = searchParams.get("status") as DeployStatus | null;

  const deployments = await listDeployments({
    ...(projectId ? { projectId } : {}),
    ...(environment ? { environment } : {}),
    ...(status ? { status } : {}),
  });
  return NextResponse.json(deployments);
}
