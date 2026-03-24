// Agent Protocol — multi-agent orchestration layer
export type {
  AgentTask,
  AgentEvent,
  AgentAdapter,
  AgentHealth,
  AgentCapability,
  AgentType,
  AgentResult,
} from "./types";
export { collectResult } from "./types";
export { ClaudeCodeAdapter } from "./claude-code";
export { CodexAdapter } from "./codex";
export { JulesAdapter } from "./jules";
export { registry } from "./registry";
export { selectAgent, executeWithRetry } from "./router";
