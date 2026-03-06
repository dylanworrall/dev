import { NextResponse } from "next/server";
import { listSpaces } from "@/lib/stores/spaces";

export async function GET() {
  const spaces = await listSpaces();
  return NextResponse.json(spaces);
}
