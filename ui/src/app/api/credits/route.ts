import { NextRequest, NextResponse } from "next/server";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";

export async function GET(req: NextRequest) {
  if (!isConvexMode()) return NextResponse.json({ credits: Infinity, mode: "local" });
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  const convex = getConvexClient();
  if (!convex) return NextResponse.json({ credits: Infinity, mode: "local" });
  const credits = await convex.query(api.users.getCredits, { email });
  return NextResponse.json({ credits, mode: "cloud" });
}

export async function POST(req: NextRequest) {
  if (!isConvexMode()) return NextResponse.json({ ok: true, mode: "local" });
  const { email, name } = await req.json();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  const convex = getConvexClient();
  if (!convex) return NextResponse.json({ ok: true, mode: "local" });
  const user = await convex.mutation(api.users.getOrCreate, { email, name: name || email.split("@")[0] });
  return NextResponse.json({ ok: true, user });
}
