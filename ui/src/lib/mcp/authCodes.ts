import { generateId } from './crypto';
interface AuthCode { code: string; userId: string; tier: string; codeChallenge: string; redirectUri: string; scopes: string[]; expiresAt: number; }
const codes = new Map<string, AuthCode>();
const refreshTokens = new Map<string, { userId: string; tier: string; scopes: string[] }>();
setInterval(() => { const now = Date.now(); for (const [k, v] of codes) { if (v.expiresAt < now) codes.delete(k); } }, 300_000);
export function createAuthCode(userId: string, tier: string, codeChallenge: string, redirectUri: string, scopes: string[]): string {
  const code = generateId(); codes.set(code, { code, userId, tier, codeChallenge, redirectUri, scopes, expiresAt: Date.now() + 300_000 }); return code;
}
export function consumeAuthCode(code: string): AuthCode | null { const e = codes.get(code); if (!e || e.expiresAt < Date.now()) { codes.delete(code); return null; } codes.delete(code); return e; }
export function createRefreshToken(userId: string, tier: string, scopes: string[]): string { const t = generateId(); refreshTokens.set(t, { userId, tier, scopes }); return t; }
export function consumeRefreshToken(token: string): { userId: string; tier: string; scopes: string[] } | null { const e = refreshTokens.get(token); if (!e) return null; refreshTokens.delete(token); return e; }
