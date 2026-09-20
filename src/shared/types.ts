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
  /** Added to the built-in default allow-list for sessions in this repository. */
  allowedTools: string[];
}

export interface AgentSessionsConfig {
  enabled: boolean;
  /** Sessions whose agent is working at the same time; further turns queue. */
  maxRunning: number;
  /** A waiting session's process is stopped after this long and resumed on the next message. */
  idleMinutes: number;
  claudePath: string;
  /** Keep ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN in the agent's environment (bills the API instead of the CLI login). */
  passApiKeyEnv: boolean;
  /** Opening instructions; `{change}` is the only placeholder. */
  commands: Record<SessionAction, string>;
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
export type SessionState = "queued" | "running" | "waiting" | "closed" | "failed" | "cancelled" | "interrupted";
export type SessionFailure = "auth" | "usage-limit" | "cli-missing" | "crashed";

export const OPEN_SESSION_STATES: readonly SessionState[] = ["queued", "running", "waiting", "interrupted"];

export interface RateLimitWindow {
  utilization: number;
  resetsAt: number;
}

export interface Session {
  id: string;
  repoId: string;
  change: string;
  action: SessionAction;
  /** Conversation id chosen by the dashboard and passed to the CLI; used for resume. */
  cliSessionId: string;
  state: SessionState;
  failure?: SessionFailure;
  error?: string;
  worktreePath?: string;
  createdAt: string;
  updatedAt: string;
  turns: number;
  costUsd: number;
  /** Highest event sequence number written so far. */
  lastSeq: number;
  /** "none" means the CLI's own login is used. */
  apiKeySource?: string;
  rateLimit?: { status: string; windows: Record<string, RateLimitWindow> };
}

export type SessionEventKind = "user" | "assistant" | "tool_use" | "tool_result" | "denied" | "result" | "state" | "error";

export interface SessionEvent {
  seq: number;
  at: string;
  kind: SessionEventKind;
  text?: string;
  tool?: { name: string; input?: unknown };
  isError?: boolean;
  state?: SessionState;
  costUsd?: number;
}

export interface AgentAvailability {
  available: boolean;
  version?: string;
  reason?: string;
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
