// JSON-RPC 2.0
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}
export interface McpToolSchema { name: string; description: string; inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] }; }
export interface McpToolCallResult { content: Array<{ type: 'text'; text: string }>; isError?: boolean; }
export interface OAuthTokenResponse { access_token: string; token_type: 'bearer'; expires_in: number; refresh_token?: string; scope?: string; }
export interface RateLimitConfig { perMinute: number; perDay: number; }
export const TIER_LIMITS: Record<string, RateLimitConfig> = { starter: { perMinute: 10, perDay: 500 }, pro: { perMinute: 30, perDay: 2000 }, unlimited: { perMinute: 100, perDay: 50000 } };
