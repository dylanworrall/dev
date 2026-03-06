import { NextRequest, NextResponse } from "next/server";
import { listIssues } from "@/lib/stores/issues";
import type { IssueStatus } from "@/lib/stores/issues";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as IssueStatus | null;
  const repoId = searchParams.get("repoId");
  const projectId = searchParams.get("projectId");

  const issues = await listIssues({
    ...(status ? { status } : {}),
    ...(repoId ? { repoId } : {}),
    ...(projectId ? { projectId } : {}),
  });
  return NextResponse.json(issues);
}
