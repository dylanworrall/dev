/**
 * Message type for compaction (compatible with AI SDK model messages)
 */
interface CompactableMessage {
  role: string;
  content: string | Array<{ text?: string; [key: string]: unknown }>;
}

/**
 * Estimate token count for a message array.
 * Uses a rough heuristic: ~4 chars per token.
 */
export function estimateTokens(messages: CompactableMessage[]): number {
  let totalChars = 0;
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      totalChars += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.text && typeof part.text === "string") {
          totalChars += part.text.length;
        }
      }
    }
  }
  return Math.ceil(totalChars / 4);
}

/**
 * Check if messages should be compacted.
 * Returns true if estimated tokens exceed the threshold.
 */
export function shouldCompact(messages: CompactableMessage[], maxTokens = 50_000): boolean {
  return estimateTokens(messages) > maxTokens;
}

/**
 * Compact messages by summarizing older ones.
 * Keeps the most recent `keepRecent` messages intact.
 * Summarizes older messages into a single context message.
 */
export async function compactMessages<T extends CompactableMessage>(
  messages: T[],
  options: {
    keepRecent?: number;
    apiKey?: string;
    oauthToken?: string;
  } = {}
): Promise<T[]> {
  const keepRecent = options.keepRecent || 10;

  if (messages.length <= keepRecent) return messages;

  const oldMessages = messages.slice(0, messages.length - keepRecent);
  const recentMessages = messages.slice(messages.length - keepRecent);

  // Build a summary of old messages
  const oldContent = oldMessages
    .map((m) => {
      const role = m.role;
      const content = typeof m.content === "string"
        ? m.content
        : Array.isArray(m.content)
          ? m.content.map((p) => p.text || "[non-text]").join(" ")
          : "[complex content]";
      return `[${role}]: ${content.slice(0, 500)}`;
    })
    .join("\n");

  // Use Gemini to summarize if API is available
  const googleKey = process.env.GOOGLE_API_KEY;

  if (googleKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{
                text: `Summarize the following conversation history concisely. Preserve all key decisions, file changes, tool results, and important context. Skip pleasantries and redundant information.\n\n${oldContent.slice(0, 30000)}`,
              }],
            }],
            generationConfig: { maxOutputTokens: 2048 },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
        const summary = data.candidates[0].content.parts[0].text;

        const summaryMessage = {
          role: "assistant",
          content: `[Previous conversation summary]\n${summary}\n[End of summary — recent messages follow]`,
        } as T;

        return [summaryMessage, ...recentMessages];
      }
    } catch {
      // Fall through to basic compaction
    }
  }

  // Basic compaction without AI: just keep a truncated version
  const basicSummary = {
    role: "assistant",
    content: `[Conversation compacted — ${oldMessages.length} older messages summarized]\nKey points from earlier conversation:\n${oldContent.slice(0, 3000)}\n[End of summary]`,
  } as T;

  return [basicSummary, ...recentMessages];
}
