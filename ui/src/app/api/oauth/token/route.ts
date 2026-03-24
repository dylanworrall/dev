import { NextRequest, NextResponse } from 'next/server';
import { consumeAuthCode, createRefreshToken, consumeRefreshToken, signJwt, verifyPkceS256, corsHeaders } from '@/lib/mcp';
import { CONNECTOR } from '@/lib/mcp/config';
import type { OAuthTokenResponse } from '@/lib/mcp';

export async function POST(req: NextRequest) {
  let grantType: string, code: string, codeVerifier: string, refreshToken: string;
  try {
    const fd = await req.formData();
    grantType = fd.get('grant_type') as string; code = fd.get('code') as string;
    codeVerifier = fd.get('code_verifier') as string; refreshToken = fd.get('refresh_token') as string;
  } catch {
    const j = await req.json().catch(() => ({})) as any;
    grantType = j.grant_type; code = j.code; codeVerifier = j.code_verifier; refreshToken = j.refresh_token;
  }

  if (grantType === 'authorization_code') {
    if (!code) return NextResponse.json({ error: 'invalid_request' }, { status: 400, headers: corsHeaders() });
    const ac = consumeAuthCode(code);
    if (!ac) return NextResponse.json({ error: 'invalid_grant' }, { status: 400, headers: corsHeaders() });
    if (ac.codeChallenge && codeVerifier) {
      if (!(await verifyPkceS256(codeVerifier, ac.codeChallenge))) return NextResponse.json({ error: 'PKCE failed' }, { status: 400, headers: corsHeaders() });
    }
    const at = await signJwt({ userId: ac.userId, tier: ac.tier, connectorId: CONNECTOR.id, scopes: ac.scopes }, 3600);
    const rt = createRefreshToken(ac.userId, ac.tier, ac.scopes);
    return NextResponse.json({ access_token: at, token_type: 'bearer', expires_in: 3600, refresh_token: rt, scope: ac.scopes.join(' ') } satisfies OAuthTokenResponse, { headers: corsHeaders() });
  }

  if (grantType === 'refresh_token') {
    if (!refreshToken) return NextResponse.json({ error: 'invalid_request' }, { status: 400, headers: corsHeaders() });
    const e = consumeRefreshToken(refreshToken);
    if (!e) return NextResponse.json({ error: 'invalid_grant' }, { status: 400, headers: corsHeaders() });
    const at = await signJwt({ userId: e.userId, tier: e.tier, connectorId: CONNECTOR.id, scopes: e.scopes }, 3600);
    const rt = createRefreshToken(e.userId, e.tier, e.scopes);
    return NextResponse.json({ access_token: at, token_type: 'bearer', expires_in: 3600, refresh_token: rt, scope: e.scopes.join(' ') } satisfies OAuthTokenResponse, { headers: corsHeaders() });
  }

  return NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400, headers: corsHeaders() });
}
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: corsHeaders() }); }
