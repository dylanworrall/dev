const encoder = new TextEncoder();
async function getKey(): Promise<CryptoKey> {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function signJwt(payload: Record<string, unknown>, expiresInSeconds = 3600): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '');
  const now = Math.floor(Date.now() / 1000);
  const body = btoa(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds })).replace(/=/g, '');
  const key = await getKey();
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`));
  const sigStr = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${header}.${body}.${sigStr}`;
}
export async function verifyJwt(token: string): Promise<Record<string, unknown> | null> {
  try {
    const [header, body, sig] = token.split('.');
    if (!header || !body || !sig) return null;
    const key = await getKey();
    const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(`${header}.${body}`));
    if (!valid) return null;
    return JSON.parse(atob(body));
  } catch { return null; }
}
export async function verifyPkceS256(verifier: string, challenge: string): Promise<boolean> {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(verifier));
  const computed = btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return computed === challenge;
}
export function generateId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
