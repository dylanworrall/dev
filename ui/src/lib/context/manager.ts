/**
 * Chef-style Context Manager
 *
 * Instead of blindly truncating to 6 messages and stripping all tool outputs,
 * this manager tracks file relevance (LRU), collapses old messages intelligently,
 * and budgets characters to stay within model context limits.
 */

interface FileEntry {
  path: string;
  lastTouched: number; // timestamp
  size: number; // approximate char count
  source: "agent" | "user" | "system";
}

interface ContextBudget {
  systemPrompt: number;
  fileContext: number;
  chatHistory: number;
  toolOutputs: number;
  reserve: number;
  total: number;
}

// Default budget for Gemini Flash (~1M tokens, but we target effective context)
const DEFAULT_BUDGET: ContextBudget = {
  systemPrompt: 5_000,
  fileContext: 30_000,
  chatHistory: 50_000,
  toolOutputs: 10_000,
  reserve: 5_000,
  total: 100_000,
};

export class ChatContextManager {
  private fileTracking = new Map<string, FileEntry>();
  private budget: ContextBudget;
  private maxTrackedFiles = 16;

  constructor(budget?: Partial<ContextBudget>) {
    this.budget = { ...DEFAULT_BUDGET, ...budget };
  }

  /**
   * Record that a file was touched (read, written, or referenced).
   */
  touchFile(path: string, size: number, source: FileEntry["source"] = "agent"): void {
    this.fileTracking.set(path, {
      path,
      lastTouched: Date.now(),
      size,
      source,
    });

    // Evict oldest files if over limit
    if (this.fileTracking.size > this.maxTrackedFiles * 2) {
      this.evictOldFiles();
    }
  }

  /**
   * Get the most relevant files, sorted by recency, within budget.
   */
  getRelevantFiles(): FileEntry[] {
    const sorted = [...this.fileTracking.values()]
      .sort((a, b) => b.lastTouched - a.lastTouched);

    const result: FileEntry[] = [];
    let totalSize = 0;

    for (const entry of sorted) {
      if (result.length >= this.maxTrackedFiles) break;
      if (totalSize + entry.size > this.budget.fileContext) break;
      result.push(entry);
      totalSize += entry.size;
    }

    return result;
  }

  /**
   * Optimize messages for the model context window.
   * - Keeps recent messages intact
   * - Collapses older messages (strips tool outputs, truncates text)
   * - Preserves the first user message (initial intent)
   */
  optimizeMessages(messages: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    if (messages.length <= 4) return messages;

    const recentCount = Math.min(6, messages.length);
    const recentMessages = messages.slice(-recentCount);
    const olderMessages = messages.slice(0, -recentCount);

    // Collapse older messages
    const collapsed = olderMessages.map((msg) => this.collapseMessage(msg));

    // Trim recent assistant messages (keep tool outputs but truncate)
    const trimmedRecent = recentMessages.map((msg) => this.trimRecentMessage(msg));

    // Budget check: if still too large, drop oldest collapsed messages
    let result = [...collapsed, ...trimmedRecent];
    let totalChars = this.estimateChars(result);

    while (totalChars > this.budget.chatHistory && result.length > recentCount + 1) {
      result.splice(1, 1); // Remove second message (keep first = initial intent)
      totalChars = this.estimateChars(result);
    }

    return result;
  }

  /**
   * Collapse an old message: strip tool outputs, summarize long text.
   */
  private collapseMessage(msg: Record<string, unknown>): Record<string, unknown> {
    if (msg.role === "assistant" && Array.isArray(msg.parts)) {
      return {
        ...msg,
        parts: (msg.parts as Array<Record<string, unknown>>)
          .filter((p) => {
            // Remove tool invocations from old messages
            const type = String(p.type || "");
            if (type.startsWith("tool-")) return false;
            return true;
          })
          .map((p) => {
            // Truncate old assistant text
            if (p.type === "text" && typeof p.text === "string" && (p.text as string).length > 500) {
              return { ...p, text: (p.text as string).slice(0, 500) + "..." };
            }
            return p;
          }),
      };
    }

    if (msg.role === "user" && Array.isArray(msg.parts)) {
      return {
        ...msg,
        parts: (msg.parts as Array<Record<string, unknown>>).map((p) => {
          if (p.type === "text" && typeof p.text === "string" && (p.text as string).length > 300) {
            return { ...p, text: (p.text as string).slice(0, 300) + "..." };
          }
          return p;
        }),
      };
    }

    return msg;
  }

  /**
   * Trim a recent message: keep tool outputs but cap their size.
   */
  private trimRecentMessage(msg: Record<string, unknown>): Record<string, unknown> {
    if (msg.role === "assistant" && Array.isArray(msg.parts)) {
      return {
        ...msg,
        parts: (msg.parts as Array<Record<string, unknown>>).map((p) => {
          const type = String(p.type || "");
          // Cap tool output to useful size
          if (type.startsWith("tool-") && p.output) {
            const outputStr = typeof p.output === "string" ? p.output : JSON.stringify(p.output);
            if (outputStr.length > 2000) {
              return { ...p, output: JSON.parse(outputStr.slice(0, 2000) + '"}') };
            }
          }
          // Cap text
          if (p.type === "text" && typeof p.text === "string" && (p.text as string).length > 2000) {
            return { ...p, text: (p.text as string).slice(-2000) };
          }
          return p;
        }),
      };
    }

    if (msg.role === "user" && Array.isArray(msg.parts)) {
      return {
        ...msg,
        parts: (msg.parts as Array<Record<string, unknown>>).map((p) => {
          if (p.type === "text" && typeof p.text === "string" && (p.text as string).length > 1000) {
            return { ...p, text: (p.text as string).slice(-1000) };
          }
          return p;
        }),
      };
    }

    return msg;
  }

  private estimateChars(messages: Array<Record<string, unknown>>): number {
    return JSON.stringify(messages).length;
  }

  private evictOldFiles(): void {
    const sorted = [...this.fileTracking.entries()]
      .sort(([, a], [, b]) => a.lastTouched - b.lastTouched);

    while (this.fileTracking.size > this.maxTrackedFiles) {
      const [key] = sorted.shift()!;
      this.fileTracking.delete(key);
    }
  }

  /**
   * Pre-warm with key project files.
   */
  prewarm(files: Array<{ path: string; size: number }>): void {
    for (const f of files) {
      this.touchFile(f.path, f.size, "system");
    }
  }

  /**
   * Get stats for debugging.
   */
  stats(): { trackedFiles: number; totalFileSize: number; budget: ContextBudget } {
    let totalFileSize = 0;
    for (const entry of this.fileTracking.values()) {
      totalFileSize += entry.size;
    }
    return { trackedFiles: this.fileTracking.size, totalFileSize, budget: this.budget };
  }
}

// Singleton for the chat route
let instance: ChatContextManager | null = null;
export function getContextManager(): ChatContextManager {
  if (!instance) {
    instance = new ChatContextManager();
  }
  return instance;
}
