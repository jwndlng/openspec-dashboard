import type { AgentProfile, AgentSessionsConfig, PromptKey, Shortcut } from "./types.ts";

// Each prompt is one line: it may be typed into a terminal (`submit.ts`). Together they carry the meaning of the
// `- [~]` task marker, which OpenSpec itself does not define — see the agent-sessions spec.

/** Leaves a task only the user can judge as `- [~]` rather than claiming a verification nobody did. */
const IMPLEMENT_PROMPT = "/opsx:apply {change} — when a task can only be verified by me, do the work and then leave it as `- [~]` instead of `- [x]`, so I can confirm it.";

/** Walks the user through the `- [~]` tasks; what the user does not confirm stays as it is. */
const VALIDATE_PROMPT = "/opsx:apply {change} — take its `- [~]` tasks one at a time, tell me exactly what to check, and tick off only the ones I confirm, leaving the rest as `- [~]`.";

/** Syncs the delta specs first instead of stopping at the archive workflow's "sync now?" question. */
const ARCHIVE_PROMPT = "/opsx:archive {change} — sync the delta specs into openspec/specs first without asking me whether to sync, then archive; if they are already in sync, archive right away; tick off the tasks left for me to validate once I have confirmed them.";

/**
 * Integrate runs in the repository folder itself, so it names no change and carries no placeholder at all. Which tools
 * OpenSpec is installed for is the agent's question to the user, not ours.
 */
const INTEGRATE_PROMPT =
  "Set this project up for OpenSpec: run `openspec init` in this folder, ask me which tools to install it for, and tell me what it created when you are done.";

/**
 * Earlier preconfigured prompts per starter; a saved config that still carries one verbatim is read as carrying the
 * current one for that starter. Per key, so upgrading one prompt never rewrites another.
 */
export const FORMER_PROMPTS: Readonly<Partial<Record<PromptKey, readonly string[]>>> = {
  implement: ["/opsx:apply {change}"],
  archive: [
    "/opsx:archive {change}",
    "/opsx:archive {change} — sync the delta specs into openspec/specs first without asking me whether to sync, then archive; if they are already in sync, archive right away.",
  ],
};

/** Preconfigured; every other agent CLI is added by the user in Settings. */
export const CLAUDE_PROFILE: AgentProfile = {
  id: "claude",
  name: "Claude Code",
  command: ["claude", "{prompt}"],
  prompts: { draft: "/opsx:ff {change}", implement: IMPLEMENT_PROMPT, validate: VALIDATE_PROMPT, archive: ARCHIVE_PROMPT, integrate: INTEGRATE_PROMPT },
  resumeCommand: ["claude", "--continue"],
  // So the CLI's own login (a subscription) is used rather than an API key that happens to be exported.
  unsetEnv: ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"],
};

/**
 * The shortcuts the console offers until the user edits them: the four answers an agent's questions usually need, each
 * sending exactly what its control reads. They are a starting point, not a floor — the user may reword, reorder, remove
 * or empty them, and the dashboard never adds one back (see the agent-sessions spec).
 */
export const DEFAULT_SHORTCUTS: readonly Shortcut[] = [
  { id: "go-ahead", title: "Yes, go ahead", prompt: "Yes, go ahead" },
  { id: "create-pr", title: "Yes, create a PR", prompt: "Yes, create a PR" },
  { id: "resolve-conflicts", title: "Resolve PR conflicts", prompt: "Resolve PR conflicts" },
  { id: "stop", title: "No, stop here", prompt: "No, stop here" },
];

/** Agent sessions ship disabled; nothing starts an agent until the user turns them on. */
export function defaultAgentSessions(): AgentSessionsConfig {
  return { enabled: false, agents: [structuredClone(CLAUDE_PROFILE)], defaultAgent: CLAUDE_PROFILE.id, shortcuts: structuredClone(DEFAULT_SHORTCUTS) as Shortcut[] };
}
