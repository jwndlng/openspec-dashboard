import type { AgentProfile, AgentSessionsConfig, PromptKey, Shortcut } from "./types.ts";

// Each prompt is one line: it may be typed into a terminal (`submit.ts`). Together they carry the meaning of the
// `- [~]` task marker, which OpenSpec itself does not define — see the agent-sessions spec. The meaning is written once
// here; each preset only says how its agent invokes the OpenSpec workflow (`<invocation> — <tail>`).

/** Leaves a task only the user can judge as `- [~]` rather than claiming a verification nobody did. */
const IMPLEMENT_TAIL = "when a task can only be verified by me, do the work and then leave it as `- [~]` instead of `- [x]`, so I can confirm it.";

/** Walks the user through the `- [~]` tasks; what the user does not confirm stays as it is. */
const VALIDATE_TAIL = "take its `- [~]` tasks one at a time, tell me exactly what to check, and tick off only the ones I confirm, leaving the rest as `- [~]`.";

/** Syncs the delta specs first instead of stopping at the archive workflow's "sync now?" question. */
const ARCHIVE_TAIL = "sync the delta specs into openspec/specs first without asking me whether to sync, then archive; if they are already in sync, archive right away; tick off the tasks left for me to validate once I have confirmed them.";

/** How one agent invokes each OpenSpec workflow for `{change}`; the `- [~]` tails are appended to apply and archive. */
function starterPrompts(invoke: { draft: string; apply: string; archive: string }): AgentProfile["prompts"] {
  return { draft: invoke.draft, implement: `${invoke.apply} — ${IMPLEMENT_TAIL}`, validate: `${invoke.apply} — ${VALIDATE_TAIL}`, archive: `${invoke.archive} — ${ARCHIVE_TAIL}` };
}

/**
 * A ready-made profile Settings offers to add, plus its earlier preconfigured prompts per starter: a saved profile with
 * the preset's id that still carries one verbatim is read as carrying the current one for that starter. Per key, so
 * upgrading one prompt never rewrites another, and per preset, so one preset's former prompts never touch another's.
 */
export interface AgentPreset {
  profile: AgentProfile;
  formerPrompts: Readonly<Partial<Record<PromptKey, readonly string[]>>>;
}

/** Preconfigured. Ship, Resolve conflicts and Integrate use the agent-neutral defaults, as they do for every preset. */
export const CLAUDE_PROFILE: AgentProfile = {
  id: "claude",
  name: "Claude Code",
  command: ["claude", "{prompt}"],
  // `openspec init --tools claude` installs `/opsx:<workflow>` commands.
  prompts: starterPrompts({ draft: "/opsx:ff {change}", apply: "/opsx:apply {change}", archive: "/opsx:archive {change}" }),
  resumeCommand: ["claude", "--continue"],
  // So the CLI's own login (a subscription) is used rather than an API key that happens to be exported.
  unsetEnv: ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"],
};

/** `openspec init --tools codex` installs skills only, no commands: the prompts name the skill in plain language. */
export const CODEX_PROFILE: AgentProfile = {
  id: "codex",
  name: "Codex",
  command: ["codex", "{prompt}"],
  prompts: starterPrompts({
    draft: "Use the openspec-ff-change skill to create all artifacts of the OpenSpec change {change}.",
    apply: "Use the openspec-apply-change skill on the OpenSpec change {change}",
    archive: "Use the openspec-archive-change skill to archive the OpenSpec change {change}",
  }),
  resumeCommand: ["codex", "resume", "--last"],
};

/** `openspec init --tools antigravity` installs workflows invoked as `/opsx-<workflow>`. `-i` keeps the session interactive. */
export const ANTIGRAVITY_PROFILE: AgentProfile = {
  id: "agy",
  name: "Antigravity",
  command: ["agy", "-i", "{prompt}"],
  prompts: starterPrompts({ draft: "/opsx-ff {change}", apply: "/opsx-apply {change}", archive: "/opsx-archive {change}" }),
  resumeCommand: ["agy", "--continue"],
};

/** Every preset, in the order Settings offers them. Only the first is configured by default. */
export const AGENT_PRESETS: readonly AgentPreset[] = [
  {
    profile: CLAUDE_PROFILE,
    formerPrompts: {
      implement: ["/opsx:apply {change}"],
      archive: [
        "/opsx:archive {change}",
        "/opsx:archive {change} — sync the delta specs into openspec/specs first without asking me whether to sync, then archive; if they are already in sync, archive right away.",
      ],
    },
  },
  { profile: CODEX_PROFILE, formerPrompts: {} },
  { profile: ANTIGRAVITY_PROFILE, formerPrompts: {} },
];

/** The Claude Code preset's former prompts. */
export const FORMER_PROMPTS = AGENT_PRESETS[0].formerPrompts;

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
