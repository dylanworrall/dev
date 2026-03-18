import { NextResponse } from "next/server";
import { listRepos } from "@/lib/stores/repos";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";

export async function GET() {
  if (isConvexMode()) {
    const convex = getConvexClient()!;
    const repos = await convex.query(api.repos.list, {});
    return NextResponse.json(repos);
  }
  const repos = await listRepos();
  return NextResponse.json(repos);
}
