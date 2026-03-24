import type { JsonRpcRequest, JsonRpcResponse, McpToolSchema, McpToolCallResult } from './types';
import { CONNECTOR } from './config';
type ToolMap = Record<string, { description?: string; inputSchema?: any; execute: (args: any) => Promise<any> }>;
let registeredTools: ToolMap = {};
export function registerTools(tools: ToolMap) { registeredTools = tools; }
function getToolSchemas(): McpToolSchema[] {
  return Object.entries(registeredTools).map(([name, tool]) => {
    const inputSchema = { type: 'object' as const, properties: {} as Record<string, unknown>, required: [] as string[] };
    try {
      const shape = tool.inputSchema?._def?.shape ? (typeof tool.inputSchema._def.shape === 'function' ? tool.inputSchema._def.shape() : tool.inputSchema._def.shape) : tool.inputSchema?.shape?.() ?? null;
      if (shape) { inputSchema.properties = Object.fromEntries(Object.entries(shape).map(([k]) => [k, { type: 'string', description: k }])); }
      else if (tool.inputSchema?.properties) { return { name, description: tool.description || name, inputSchema: tool.inputSchema }; }
    } catch {}
    return { name, description: tool.description || name, inputSchema };
  });
}
export async function handleMcpRequest(req: JsonRpcRequest): Promise<JsonRpcResponse> {
  const { method, id, params } = req;
  switch (method) {
    case 'initialize': return { jsonrpc: '2.0', id, result: { protocolVersion: '2025-03-26', serverInfo: { name: CONNECTOR.name, version: '1.0.0' }, capabilities: { tools: { listChanged: false } } } };
    case 'notifications/initialized': return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list': return { jsonrpc: '2.0', id, result: { tools: getToolSchemas() } };
    case 'tools/call': {
      const toolName = (params as any)?.name as string; const args = (params as any)?.arguments ?? {};
      const tool = registeredTools[toolName];
      if (!tool) return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Tool "${toolName}" not found` }], isError: true } satisfies McpToolCallResult };
      try {
        const result = await tool.execute(args);
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result) }] } satisfies McpToolCallResult };
      } catch (err: any) { return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: err.message || String(err) }], isError: true } satisfies McpToolCallResult }; }
    }
    default: return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}
