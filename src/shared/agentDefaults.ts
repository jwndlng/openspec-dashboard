import type { AgentProfile, AgentSessionsConfig } from "./types.ts";

/** Syncs the delta specs first instead of stopping at the archive workflow's "sync now?" question. One line: it may be typed into a terminal. */
const ARCHIVE_PROMPT = "/opsx:archive {change} — sync the delta specs into openspec/specs first without asking me whether to sync, then archive; if they are already in sync, archive right away.";

/** Earlier preconfigured Archive prompts; a saved config that still carries one verbatim is read as `ARCHIVE_PROMPT`. */
export const FORMER_ARCHIVE_PROMPTS: readonly string[] = ["/opsx:archive {change}"];

/** Preconfigured; every other agent CLI is added by the user in Settings. */
export const CLAUDE_PROFILE: AgentProfile = {
  id: "claude",
  name: "Claude Code",
  command: ["claude", "{prompt}"],
  prompts: { draft: "/opsx:ff {change}", implement: "/opsx:apply {change}", archive: ARCHIVE_PROMPT },
  resumeCommand: ["claude", "--continue"],
  // So the CLI's own login (a subscription) is used rather than an API key that happens to be exported.
  unsetEnv: ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"],
};

/** Agent sessions ship disabled; nothing starts an agent until the user turns them on. */
export function defaultAgentSessions(): AgentSessionsConfig {
  return { enabled: false, agents: [structuredClone(CLAUDE_PROFILE)], defaultAgent: CLAUDE_PROFILE.id };
}
