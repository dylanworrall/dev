#!/usr/bin/env node
/**
 * Dev MCP Server
 *
 * Thin wrapper that re-exports Vercel AI SDK tools as MCP tools.
 * Runs as a child process over stdio transport.
 *
 * Usage:
 *   npx tsx src/mcp/server.ts
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { allTools } from "../../ui/src/lib/ai/tools/index.js";

const server = new McpServer({
  name: "dev",
  version: "1.0.0",
});

// Register all Vercel AI SDK tools as MCP tools
for (const [name, t] of Object.entries(allTools)) {
  const aiTool = t as any;
  server.tool(
    name,
    aiTool.description || name,
    aiTool.parameters?.shape ?? {},
    async (args: Record<string, unknown>) => {
      const result = await aiTool.execute(args);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    }
  );
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Dev MCP server failed to start:", err);
  process.exit(1);
});
