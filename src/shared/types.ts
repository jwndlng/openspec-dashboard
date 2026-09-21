// Shared data model between server and UI (design.md D3).

export type ArtifactState = "done" | "ready" | "blocked";

export type Stage = "new" | "artifact" | "ready" | "implementing" | "done" | "synced" | "archived";

export interface ArtifactStatus {
  id: string;
  status: ArtifactState;
}

export interface TaskProgress {
  done: number;
  total: number;
}

export interface ChangeSnapshot {
  repoId: string;
  name: string;
  schema: string;
  /** Artifacts in schema order. Empty when the change could not be loaded. */
  artifacts: ArtifactStatus[];
  /** null when the tasks artifact does not exist. */
  tasks: TaskProgress | null;
  /** From .openspec.yaml, ISO date. */
  created?: string;
  /** ISO date parsed from the archive directory name; present ⇒ archived. */
  archived?: string;
  /** Committer date of the last commit touching the change dir, or newest mtime. */
  lastActivityAt?: string;
  /** Branch or worktree branch whose name contains the change name. */
  branchMatch?: string;
  /**
   * Whether the delta specs are already reflected in `openspec/specs/`. Only set for non-archived changes whose tasks
   * are all complete — the one place where it decides the column (`Done` vs `Synced`).
   */
  specsSynced?: boolean;
  stage: Stage;
  /** Display column, e.g. "Proposal", "Implementing". */
  column: string;
  /** Non-fatal problems while reading this change. */
  warnings?: string[];
}

export interface Worktree {
  path: string;
  branch: string;
}

export interface RepoSnapshot {
  id: string;
  name: string;
  path: string;
  ok: boolean;
  error?: string;
  warnings?: string[];
  scannedAt: string;
  isGit: boolean;
  currentBranch?: string;
  worktrees: Worktree[];
  /**
   * Latest change to anything under `openspec/`: the last commit touching it, or the mtime of a file
   * git reports as modified/untracked there, whichever is newer. Absent in snapshots cached by older versions.
   */
  lastUpdatedAt?: string;
  /** Shared profiles found in this repository's `openspec/config.yaml`. Absent until the dashboard has at least one profile. */
  sharedConfig?: RepoSharedConfig;
  changes: ChangeSnapshot[];
}

export interface Snapshot {
  generatedAt: string;
  repos: RepoSnapshot[];
}

export interface RepoConfig {
  /** Stable hash of the absolute path. */
  id: string;
  path: string;
  name: string;
  enabled: boolean;
  /** Per-repository agent-session settings. Absent means "included": once sessions are enabled globally they apply to
   *  every tracked repository unless it is switched off here. */
  agent?: RepoAgentConfig;
}

export interface RepoAgentConfig {
  enabled: boolean;
  /** Agent profile used for this repository; absent means the default agent. */
  agentId?: string;
}

/**
 * One agent CLI the dashboard can start in a terminal. Nothing here is specific to a vendor: a profile is a command
 * line plus the opening prompts, so any CLI that runs interactively in a terminal can be described.
 */
export interface AgentProfile {
  id: string;
  name: string;
  /** Argument list, never a shell string. `{prompt}` is replaced by the opening prompt as one argument; without it
   *  the prompt is typed into the terminal once the agent has started. */
  command: string[];
  /** Opening prompt per session starter; `{change}` is the only placeholder. A starter without a prompt is not offered. */
  prompts: Partial<Record<PromptKey, string>>;
  /** Continues this agent's latest conversation in the same directory, e.g. ["claude", "--continue"]. */
  resumeCommand?: string[];
  /** Environment variables removed for the agent, e.g. API keys so a CLI's own login is used. */
  unsetEnv?: string[];
}

export interface AgentSessionsConfig {
  enabled: boolean;
  agents: AgentProfile[];
  defaultAgent: string;
}

export interface Config {
  version: 1;
  scanRoots: string[];
  repos: RepoConfig[];
  pollIntervalSeconds: number;
  port: number;
  agentSessions: AgentSessionsConfig;
}

export type SessionAction = "draft" | "implement" | "archive";
export const SESSION_ACTIONS: readonly SessionAction[] = ["draft", "implement", "archive"];
/** `ship` is a prompt, not a starter: it asks the agent of an existing session to commit, push and open a pull request. */
export type PromptKey = SessionAction | "ship";
/** Agent-neutral on purpose, so every profile can ship without being configured for it. */
export const DEFAULT_SHIP_PROMPT =
  "Ship the work in this worktree: commit everything that belongs to it with a Conventional Commit message, push the branch, and open a pull request against the default branch if there is none yet. Do not merge it. Tell me the pull request URL.";

/**
 * What became of the work in a session's worktree, from local git only (nothing is fetched, so `merged` is as of the
 * user's last fetch). `clean`: no commit the base lacks; `missing`: the directory is not a worktree (any more).
 */
export type WorkState = "missing" | "clean" | "uncommitted" | "unpushed" | "pushed" | "merged";
export const SHIPPABLE_WORK: readonly WorkState[] = ["uncommitted", "unpushed", "pushed"];

export interface WorkStatus {
  state: WorkState;
  /** Files for `uncommitted`, commits for `unpushed`. */
  count?: number;
  /** What the branch was compared with, e.g. `origin/main`. */
  base?: string;
}

/** A directory under the dashboard's worktrees folder; it outlives session records, so it is listed on its own. */
export interface SessionWorktree {
  repoId: string;
  name: string;
  path: string;
  change: string;
  action: SessionAction;
  branch?: string;
  work: WorkStatus;
  /** Latest of the branch's last commit and its session's last update. */
  lastActivityAt?: string;
  /** Most recent session in this worktree, if its record still exists. */
  sessionId?: string;
}

/** A session is a process in a terminal: it runs, or it has ended. `failed` means it could not be started. */
export type SessionState = "running" | "exited" | "failed";

export const OPEN_SESSION_STATES: readonly SessionState[] = ["running"];

export interface Session {
  id: string;
  repoId: string;
  change: string;
  action: SessionAction;
  agentId: string;
  agentName: string;
  state: SessionState;
  exitCode?: number | null;
  error?: string;
  /** The session's own git worktree, under the dashboard home. */
  worktreePath: string;
  branch: string;
  createdAt: string;
  updatedAt: string;
  /** When the terminal last printed something; a long quiet spell usually means the agent waits for the user. */
  lastOutputAt?: string;
  /** True once the agent has a conversation that `resumeCommand` can continue. */
  resumable: boolean;
}

export interface AgentAvailability {
  id: string;
  name: string;
  available: boolean;
  /** Resolved executable, when found. */
  path?: string;
}

/** Included unless explicitly switched off for this repository (the global switch is checked separately). */
export function repoAgentEnabled(repo: Pick<RepoConfig, "enabled" | "agent">): boolean {
  return repo.enabled && repo.agent?.enabled !== false;
}

/** The session starters a change currently qualifies for (before feature/opt-in checks). */
export function availableActions(change: Pick<ChangeSnapshot, "archived" | "artifacts" | "stage">): SessionAction[] {
  if (change.archived) return [];
  const actions: SessionAction[] = [];
  if (change.artifacts.length === 0 || change.artifacts.some((a) => a.status !== "done")) actions.push("draft");
  if (change.stage === "ready" || change.stage === "implementing") actions.push("implement");
  if (change.stage === "done") actions.push("archive"); // every task ticked, not archived yet
  return actions;
}

export interface DiscoverResult {
  /** Repositories found under the roots that are not in the config yet. Never persisted by discovery. */
  candidates: RepoConfig[];
  errors: { root: string; message: string }[];
}

export interface ScanTriggerResult {
  started: boolean;
}

export const IMPLEMENTATION_COLUMNS = ["Ready", "Implementing", "Done", "Synced", "Archived"] as const;

/**
 * A named set of guidance for agents that the dashboard keeps once and applies to many repositories'
 * `openspec/config.yaml`. A repository can carry several profiles at once (e.g. `base` plus `security`).
 */
export interface SharedProfile {
  /** Stable slug; written into the markers in repositories, so it identifies the profile there. */
  id: string;
  name: string;
  /** Injected by OpenSpec into every artifact instruction. */
  context: string;
  /** Artifact id → ordered rule texts. */
  rules: Record<string, string[]>;
}

/** The dashboard's shared OpenSpec config: profiles in the order they are written into a repository. */
export interface SharedConfig {
  profiles: SharedProfile[];
}

/**
 * `orphaned`: the repository carries managed content for a profile id the dashboard no longer has.
 */
export type AppliedProfileState = "in-sync" | "outdated" | "orphaned";

export interface AppliedProfile {
  id: string;
  state: AppliedProfileState;
}

/** Which shared profiles a repository's `openspec/config.yaml` carries, read from its markers. */
export interface RepoSharedConfig {
  /** The file is missing, not valid YAML, or its markers are malformed; nothing can be said or applied. */
  unreadable: boolean;
  applied: AppliedProfile[];
}

/** Desired profiles for one repository: exactly these, in dashboard order; an empty list removes all managed content. */
export interface SharedConfigAssignment {
  repoId: string;
  profileIds: string[];
}

export interface SharedConfigPreview {
  repoId: string;
  current: RepoSharedConfig;
  /** Current file text; empty when the file cannot be read. */
  before: string;
  /** What apply would write; equals `before` when nothing would change or apply would refuse. */
  after: string;
  /** Why apply would not write to this repository. */
  refusal?: string;
}

export interface SharedConfigApplyResult {
  repoId: string;
  result: "written" | "unchanged" | "refused";
  reason?: string;
}
