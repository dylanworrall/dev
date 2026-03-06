import { NextResponse } from "next/server";
import { getAudits } from "@/lib/stores/audits";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") ?? undefined;
  const audits = await getAudits(projectId);
  return NextResponse.json(audits);
}
