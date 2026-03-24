import { TIER_LIMITS } from './types';
interface Window { count: number; resetAt: number; }
const minuteWindows = new Map<string, Window>();
const dayWindows = new Map<string, Window>();
export function checkRateLimit(userId: string, tier: string): { allowed: boolean; retryAfter?: number } {
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.starter; const now = Date.now();
  const minKey = `${userId}:min`; let minW = minuteWindows.get(minKey);
  if (!minW || minW.resetAt < now) { minW = { count: 0, resetAt: now + 60_000 }; minuteWindows.set(minKey, minW); }
  if (minW.count >= limits.perMinute) return { allowed: false, retryAfter: Math.ceil((minW.resetAt - now) / 1000) };
  const dayKey = `${userId}:day`; let dayW = dayWindows.get(dayKey);
  if (!dayW || dayW.resetAt < now) { dayW = { count: 0, resetAt: now + 86_400_000 }; dayWindows.set(dayKey, dayW); }
  if (dayW.count >= limits.perDay) return { allowed: false, retryAfter: Math.ceil((dayW.resetAt - now) / 1000) };
  minW.count++; dayW.count++; return { allowed: true };
}
