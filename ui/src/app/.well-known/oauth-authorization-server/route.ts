import { NextResponse } from 'next/server';
import { CONNECTOR } from '@/lib/mcp/config';

export async function GET() {
  return NextResponse.json({
    issuer: CONNECTOR.baseUrl,
    authorization_endpoint: `${CONNECTOR.baseUrl}/api/oauth/authorize`,
    token_endpoint: `${CONNECTOR.baseUrl}/api/oauth/token`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['tools'],
  });
}
