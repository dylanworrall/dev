import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/flyio — Stores Fly.io API token directly
 * Fly.io doesn't have self-service OAuth. Users paste their token.
 */
export async function POST(request: NextRequest) {
  const { token } = await request.json();

  if (!token || !token.startsWith("fo1_")) {
    return NextResponse.json({ error: "Invalid Fly.io token. Must start with fo1_" }, { status: 400 });
  }

  // Verify token works
  const verifyRes = await fetch("https://api.machines.dev/v1/apps", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!verifyRes.ok) {
    return NextResponse.json({ error: "Token verification failed. Check your token." }, { status: 401 });
  }

  // Store via settings API
  const settingsUrl = new URL("/api/settings", request.url);
  await fetch(settingsUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      integrations: {
        flyio: {
          configured: true,
          apiToken: token,
        },
      },
    }),
  });

  return NextResponse.json({ success: true });
}
