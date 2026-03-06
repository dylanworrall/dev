import { NextResponse } from "next/server";
import { listRepos } from "@/lib/stores/repos";

export async function GET() {
  const repos = await listRepos();
  return NextResponse.json(repos);
}
