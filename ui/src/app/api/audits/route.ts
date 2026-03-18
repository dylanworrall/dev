import { NextResponse } from "next/server";
import { getAudits } from "@/lib/stores/audits";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") ?? undefined;

  if (isConvexMode()) {
    const convex = getConvexClient()!;
    const audits = await convex.query(api.audits.list, { projectId });
    return NextResponse.json(audits);
  }

  const audits = await getAudits(projectId);
  return NextResponse.json(audits);
}
