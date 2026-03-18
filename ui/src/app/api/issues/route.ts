import { NextRequest, NextResponse } from "next/server";
import { listIssues } from "@/lib/stores/issues";
import type { IssueStatus } from "@/lib/stores/issues";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as IssueStatus | null;
  const repoId = searchParams.get("repoId");
  const projectId = searchParams.get("projectId");

  if (isConvexMode()) {
    const convex = getConvexClient()!;
    const issues = await convex.query(api.issues.list, {
      status: status ?? undefined,
      repoId: repoId ?? undefined,
      projectId: projectId ?? undefined,
    });
    return NextResponse.json(issues);
  }

  const issues = await listIssues({
    ...(status ? { status } : {}),
    ...(repoId ? { repoId } : {}),
    ...(projectId ? { projectId } : {}),
  });
  return NextResponse.json(issues);
}
