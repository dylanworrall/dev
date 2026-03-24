import { verifyJwt } from './crypto';
import { checkRateLimit } from './rateLimit';
import { CONNECTOR } from './config';
export interface AuthContext { userId: string; tier: string; connectorId: string; scopes: string[]; exp: number; }
export async function validateBearerToken(authHeader: string | null): Promise<{ valid: boolean; context?: AuthContext; error?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { valid: false, error: 'Missing Authorization header' };
  const token = authHeader.slice(7);
  try {
    const payload = await verifyJwt(token);
    if (!payload || typeof payload !== 'object') return { valid: false, error: 'Invalid token' };
    const ctx = payload as unknown as AuthContext;
    if (ctx.exp && Date.now() / 1000 > ctx.exp) return { valid: false, error: 'Token expired' };
    if (ctx.connectorId !== CONNECTOR.id) return { valid: false, error: 'Token not valid for this connector' };
    const rl = checkRateLimit(ctx.userId, ctx.tier);
    if (!rl.allowed) return { valid: false, error: `Rate limit exceeded. Retry after ${rl.retryAfter}s` };
    return { valid: true, context: ctx };
  } catch { return { valid: false, error: 'Token verification failed' }; }
}
export function corsHeaders(): Record<string, string> {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id' };
}
