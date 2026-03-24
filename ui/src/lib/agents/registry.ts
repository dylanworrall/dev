import type { AgentAdapter, AgentHealth } from "./types";
import { ClaudeCodeAdapter } from "./claude-code";
import { CodexAdapter } from "./codex";
import { JulesAdapter } from "./jules";

// Singleton registry of all available agent adapters
class AgentRegistry {
  private adapters = new Map<string, AgentAdapter>();
  private healthCache = new Map<string, { health: AgentHealth; ts: number }>();
  private readonly HEALTH_TTL = 60_000; // 1 minute

  constructor() {
    // Register built-in adapters
    this.register(new ClaudeCodeAdapter());
    this.register(new CodexAdapter());
    this.register(new JulesAdapter());
  }

  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  get(name: string): AgentAdapter | undefined {
    return this.adapters.get(name);
  }

  all(): AgentAdapter[] {
    return [...this.adapters.values()];
  }

  names(): string[] {
    return [...this.adapters.keys()];
  }

  async getHealth(name: string): Promise<AgentHealth> {
    const cached = this.healthCache.get(name);
    if (cached && Date.now() - cached.ts < this.HEALTH_TTL) {
      return cached.health;
    }

    const adapter = this.adapters.get(name);
    if (!adapter) {
      return { available: false, error: `Unknown agent: ${name}` };
    }

    const health = await adapter.healthCheck();
    this.healthCache.set(name, { health, ts: Date.now() });
    return health;
  }

  async getAllHealth(): Promise<Record<string, AgentHealth>> {
    const entries = await Promise.all(
      this.names().map(async (name) => [name, await this.getHealth(name)] as const)
    );
    return Object.fromEntries(entries);
  }

  // Invalidate health cache for an agent (e.g. after a failure)
  invalidateHealth(name: string): void {
    this.healthCache.delete(name);
  }
}

// Singleton
export const registry = new AgentRegistry();
