import { NextResponse } from "next/server";
import { loadDevEnv, saveDevEnvVar } from "@/lib/env";

loadDevEnv();

function maskKey(key: string): string {
  if (key.length <= 12) return "****";
  return key.slice(0, 7) + "..." + key.slice(-4);
}

export async function GET() {
  loadDevEnv(true);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const oauthToken = process.env.CLAUDE_OAUTH_TOKEN;

  return NextResponse.json({
    connected: !!(apiKey || oauthToken),
    method: apiKey ? "api-key" : oauthToken ? "setup-token" : null,
    masked: apiKey ? maskKey(apiKey) : oauthToken ? maskKey(oauthToken) : null,
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { method, apiKey, token } = body as {
    method: "api-key" | "setup-token";
    apiKey?: string;
    token?: string;
  };

  if (method === "api-key") {
    return handleApiKey(apiKey);
  }

  if (method === "setup-token") {
    return handleSetupToken(token);
  }

  return NextResponse.json({ error: "Invalid method" }, { status: 400 });
}

async function handleApiKey(apiKey?: string) {
  if (!apiKey?.trim()) {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  const key = apiKey.trim();

  if (!key.startsWith("sk-ant-")) {
    return NextResponse.json({ error: "Key should start with sk-ant-" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    if (res.status === 401) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
  } catch {
    // Network error — save anyway
  }

  saveDevEnvVar("ANTHROPIC_API_KEY", key);
  process.env.ANTHROPIC_API_KEY = key;
  // Clear any existing OAuth token to avoid conflict
  delete process.env.CLAUDE_OAUTH_TOKEN;

  return NextResponse.json({
    success: true,
    method: "api-key",
    masked: maskKey(key),
  });
}

async function handleSetupToken(token?: string) {
  if (!token?.trim()) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const trimmed = token.trim();

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        authorization: `Bearer ${trimmed}`,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "oauth-2025-04-20",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json(
        { error: "Token rejected. Anthropic may restrict subscription tokens for non-Claude Code use. Try an API key instead." },
        { status: 401 }
      );
    }
  } catch {
    // Network error — save anyway
  }

  saveDevEnvVar("CLAUDE_OAUTH_TOKEN", trimmed);
  process.env.CLAUDE_OAUTH_TOKEN = trimmed;
  // Clear any existing API key to avoid conflict
  delete process.env.ANTHROPIC_API_KEY;

  return NextResponse.json({
    success: true,
    method: "setup-token",
    masked: maskKey(trimmed),
  });
}
