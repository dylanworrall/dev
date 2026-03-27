import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/github/callback — GitHub OAuth callback
 * Exchanges code for access token, stores it, redirects to settings.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = request.cookies.get("github_oauth_state")?.value;

  if (!code) {
    return NextResponse.redirect(new URL("/settings?error=no_code", request.url));
  }

  if (state !== storedState) {
    return NextResponse.redirect(new URL("/settings?error=state_mismatch", request.url));
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/settings?error=not_configured", request.url));
  }

  // Exchange code for token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3005"}/api/auth/github/callback`,
    }),
  });

  const tokenData = await tokenRes.json();

  if (tokenData.error) {
    return NextResponse.redirect(
      new URL(`/settings?error=${tokenData.error}`, request.url)
    );
  }

  // Fetch user info
  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const user = await userRes.json();

  // Store in settings
  await fetch(new URL("/api/settings", request.url).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      integrations: {
        github: {
          configured: true,
          accessToken: tokenData.access_token,
          scope: tokenData.scope,
          username: user.login,
          avatarUrl: user.avatar_url,
        },
      },
    }),
  });

  const response = NextResponse.redirect(new URL("/settings?connected=github", request.url));
  response.cookies.delete("github_oauth_state");
  return response;
}
