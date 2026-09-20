import type { AgentSessionsConfig } from "./types.ts";

/** Always allowed in an agent session; repositories can add to it, nothing can bypass it (design.md D6). */
export const DEFAULT_ALLOWED_TOOLS: readonly string[] = [
  "Read",
  "Glob",
  "Grep",
  "Edit",
  "Write",
  "Bash(openspec *)",
  "Bash(git status*)",
  "Bash(git diff*)",
  "Bash(git log*)",
  "Bash(git add *)",
  "Bash(git commit *)",
  "Bash(git branch -m *)",
];

/** Agent sessions ship disabled; nothing starts an agent until the user turns them on and opts a repository in. */
export function defaultAgentSessions(): AgentSessionsConfig {
  return {
    enabled: false,
    maxRunning: 2,
    idleMinutes: 30,
    claudePath: "claude",
    passApiKeyEnv: false,
    commands: { draft: "/opsx:ff {change}", implement: "/opsx:apply {change}" },
  };
}
