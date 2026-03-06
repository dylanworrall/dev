import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/stores/settings";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function POST(req: Request) {
  const body = await req.json();
  const updated = await updateSettings(body);
  return NextResponse.json(updated);
}
