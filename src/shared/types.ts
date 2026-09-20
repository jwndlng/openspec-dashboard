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
  /** Agent-session opt-in for this repository; absent means not opted in. */
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

export type SessionAction = "draft" | "implement";
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

/** The session starters a change currently qualifies for (before feature/opt-in checks). */
export function availableActions(change: Pick<ChangeSnapshot, "archived" | "artifacts" | "stage">): SessionAction[] {
  if (change.archived) return [];
  const actions: SessionAction[] = [];
  if (change.artifacts.length === 0 || change.artifacts.some((a) => a.status !== "done")) actions.push("draft");
  if (change.stage === "ready" || change.stage === "implementing") actions.push("implement");
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
