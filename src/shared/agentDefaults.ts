import type { AgentProfile, AgentSessionsConfig } from "./types.ts";

/** Preconfigured; every other agent CLI is added by the user in Settings. */
export const CLAUDE_PROFILE: AgentProfile = {
  id: "claude",
  name: "Claude Code",
  command: ["claude", "{prompt}"],
  prompts: { draft: "/opsx:ff {change}", implement: "/opsx:apply {change}", archive: "/opsx:archive {change}" },
  resumeCommand: ["claude", "--continue"],
  // So the CLI's own login (a subscription) is used rather than an API key that happens to be exported.
  unsetEnv: ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"],
};

/** Agent sessions ship disabled; nothing starts an agent until the user turns them on. */
export function defaultAgentSessions(): AgentSessionsConfig {
  return { enabled: false, agents: [structuredClone(CLAUDE_PROFILE)], defaultAgent: CLAUDE_PROFILE.id };
}
