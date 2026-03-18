import { NextResponse } from "next/server";
import { loadDevEnv } from "@/lib/env";

export async function GET() {
  loadDevEnv();
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return NextResponse.json({ models: [] });

  const models = [
    { id: "gemini-3.1-pro-preview", label: "3.1 Pro", dailyLimit: 250 },
    { id: "gemini-2.5-flash", label: "Flash", dailyLimit: 14400 },
    { id: "gemini-2.5-flash-lite", label: "Flash Lite", dailyLimit: 14400 },
  ];

  // Check each model's status
  const results = await Promise.all(models.map(async (m) => {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m.id}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "." }] }], generationConfig: { maxOutputTokens: 1 } }),
          signal: AbortSignal.timeout(5000),
        }
      );
      if (res.status === 429) {
        const data = await res.json() as { error?: { message?: string } };
        const retryMatch = data.error?.message?.match(/retry in ([\dh\dm\ds]+)/i);
        return { ...m, status: "limited" as const, retryIn: retryMatch?.[1] || "unknown" };
      }
      if (res.status === 503) return { ...m, status: "unavailable" as const };
      return { ...m, status: "available" as const };
    } catch {
      return { ...m, status: "unavailable" as const };
    }
  }));

  return NextResponse.json({ models: results });
}
