import { log } from "./logger.js";

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function retry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 2000,
    maxDelayMs = 30000,
    onRetry,
  } = opts;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === maxAttempts) break;

      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      log.debug(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      onRetry?.(attempt, lastError);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
