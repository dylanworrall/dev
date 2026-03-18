import { NextResponse } from "next/server";
import { listSpaces } from "@/lib/stores/spaces";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";

export async function GET() {
  if (isConvexMode()) {
    const convex = getConvexClient()!;
    const spaces = await convex.query(api.spaces.list, {});
    return NextResponse.json(spaces);
  }
  const spaces = await listSpaces();
  return NextResponse.json(spaces);
}
