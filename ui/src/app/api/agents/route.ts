import { loadDevEnv } from "@/lib/env";
import { registry } from "@/lib/agents/registry";

/**
 * GET /api/agents — Returns health status for all registered agents.
 * Used by the builder UI to show which agents are available.
 */
export async function GET() {
  loadDevEnv(true);

  const health = await registry.getAllHealth();
  const agents = registry.all().map((adapter) => ({
    name: adapter.name,
    type: adapter.type,
    capabilities: adapter.capabilities,
    health: health[adapter.name],
  }));

  return Response.json({ agents });
}
