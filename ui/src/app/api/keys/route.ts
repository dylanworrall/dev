import { NextResponse } from "next/server";
import { loadDevEnv, saveDevEnvVar } from "@/lib/env";

loadDevEnv();

function maskKey(key: string): string {
  if (key.length <= 12) return "****";
  return key.slice(0, 7) + "..." + key.slice(-4);
}

// GET: return status of all API keys (masked)
export async function GET() {
  loadDevEnv(true);

  const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
  const googleKey = process.env.GOOGLE_API_KEY || "";

  return NextResponse.json({
    anthropic: {
      set: !!anthropicKey,
      masked: anthropicKey ? maskKey(anthropicKey) : "",
    },
    google: {
      set: !!googleKey,
      masked: googleKey ? maskKey(googleKey) : "",
    },
  });
}

// POST: validate and save an API key
export async function POST(req: Request) {
  const { provider, key } = await req.json();

  if (!provider || !key) {
    return NextResponse.json({ error: "Missing provider or key" }, { status: 400 });
  }

  let valid = false;
  let error = "";

  if (provider === "anthropic") {
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
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
      if (resp.status === 401) {
        error = "Invalid API key";
      } else {
        valid = true;
      }
    } catch (e) {
      error = `Connection error: ${e instanceof Error ? e.message : "unknown"}`;
    }
  } else if (provider === "google") {
    try {
      const resp = await fetch(
        `https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://example.com&key=${key}&category=performance`
      );
      valid = resp.status === 200;
      if (!valid) error = `API error: ${resp.status}`;
    } catch (e) {
      error = `Connection error: ${e instanceof Error ? e.message : "unknown"}`;
    }
  } else {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  if (!valid) {
    return NextResponse.json({ valid: false, error });
  }

  const envKey = provider === "anthropic" ? "ANTHROPIC_API_KEY" : "GOOGLE_API_KEY";
  saveDevEnvVar(envKey, key);
  process.env[envKey] = key;

  return NextResponse.json({ valid: true, masked: maskKey(key) });
}
