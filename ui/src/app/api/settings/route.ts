import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/stores/settings";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";
import { loadDevEnv } from "@/lib/env";

export async function GET() {
  loadDevEnv();

  let settings: Record<string, unknown> = {};

  if (isConvexMode()) {
    const convex = getConvexClient()!;
    settings = await convex.query(api.settings.get, {}) as Record<string, unknown>;
  } else {
    settings = await getSettings() as unknown as Record<string, unknown>;
  }

  // Always include integration status
  return NextResponse.json({
    ...settings,
    integrations: {
      github: { configured: !!process.env.GITHUB_TOKEN },
      netlify: { configured: !!process.env.NETLIFY_TOKEN },
      vercel: { configured: !!process.env.VERCEL_TOKEN },
      flyio: { configured: !!process.env.FLY_API_TOKEN },
      google: { configured: !!process.env.GOOGLE_API_KEY },
    },
  });
}

export async function POST(req: Request) {
  const body = await req.json();

  if (isConvexMode()) {
    const convex = getConvexClient()!;
    const updated = await convex.mutation(api.settings.update, { updates: body });
    return NextResponse.json(updated);
  }

  const updated = await updateSettings(body);
  return NextResponse.json(updated);
}
