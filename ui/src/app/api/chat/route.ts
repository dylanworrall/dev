import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { allTools } from "@/lib/ai/tools";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { loadDevEnv } from "@/lib/env";

export async function POST(req: Request) {
  loadDevEnv(true);

  const { messages } = await req.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const oauthToken = process.env.CLAUDE_OAUTH_TOKEN;

  if (!apiKey && !oauthToken) {
    return Response.json(
      { error: "No API key configured. Go to /login to set up." },
      { status: 400 }
    );
  }

  const anthropic = apiKey
    ? createAnthropic({ apiKey })
    : createAnthropic({
        authToken: oauthToken!,
        headers: { "anthropic-beta": "oauth-2025-04-20" },
      });

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    tools: allTools,
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse();
}
