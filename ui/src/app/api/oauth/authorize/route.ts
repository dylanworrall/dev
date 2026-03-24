import { NextRequest, NextResponse } from 'next/server';
import { validateWhopEntitlement, createAuthCode } from '@/lib/mcp';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const whopToken = p.get('whop_token');
  const redirectUri = p.get('redirect_uri') || 'soshi://oauth-complete';
  const codeChallenge = p.get('code_challenge') || '';
  const codeChallengeMethod = p.get('code_challenge_method');
  const scope = p.get('scope') || 'tools';
  const state = p.get('state') || '';

  if (!whopToken) return NextResponse.json({ error: 'whop_token required' }, { status: 400 });
  if (codeChallengeMethod && codeChallengeMethod !== 'S256') return NextResponse.json({ error: 'Only S256 supported' }, { status: 400 });

  const v = await validateWhopEntitlement(whopToken);
  if (!v.valid) return NextResponse.json({ error: v.error }, { status: 403 });

  const code = createAuthCode(v.userId!, v.tier!, codeChallenge, redirectUri, scope.split(' '));
  const url = new URL(redirectUri);
  url.searchParams.set('code', code);
  if (state) url.searchParams.set('state', state);
  return NextResponse.redirect(url.toString());
}
