// Shared data model between server and UI (design.md D3).

/** Character set of a change directory name: letters, digits, dots, dashes, underscores — same rule the scanner enforces. */
export const CHANGE_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

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
  /**
   * The branch of the linked worktree the change's data comes from; for a change that lives in the main checkout, the
   * first branch or worktree branch whose name contains the change name.
   */
  branchMatch?: string;
  /**
   * The checkout this change's data comes from: the leading copy among all checkouts holding the change. Absent in
   * snapshots cached by older versions and for non-git repositories.
   */
  checkout?: ChangeCheckout;
  /** Other checkouts that hold a copy of this change, with the column that copy alone would be in. */
  otherCheckouts?: (ChangeCheckout & { column: string })[];
  /**
   * Whether the delta specs are already reflected in `openspec/specs/`. Only set for non-archived changes whose tasks
   * are all complete — the one place where it decides the column (`Done` vs `Synced`).
   */
  specsSynced?: boolean;
  stage: Stage;
  /** Display column, e.g. "Proposal", "Implementing". */
  column: string;
  /**
   * Contents of the change's `prompt.md`, when present. A free-text hint the user jotted down when starting the change;
   * not a schema artifact and does not affect artifact status. Bounded, so pathological files do not bloat the snapshot.
   */
  prompt?: string;
  /** Non-fatal problems while reading this change. */
  warnings?: string[];
}

/** A checkout of a repository as `git worktree list` reports it: the main working tree or a linked worktree. */
export interface Worktree {
  path: string;
  /** Absent when HEAD is detached. */
  branch?: string;
  detached?: boolean;
  /** The repository's main working tree (git lists it first); everything else is a linked worktree. */
  isMain?: boolean;
  /** git considers it removable, typically because its directory is gone. */
  prunable?: boolean;
  /** A bare repository entry: there is no working tree to read. */
  bare?: boolean;
}

/** Where a change's data was read from. */
export interface ChangeCheckout {
  path: string;
  branch?: string;
  isMain: boolean;
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
  /**
   * The repository's default branch: what `origin/HEAD` points to, else `main`, else `master`. Omitted when it cannot be
   * determined (and in snapshots cached by older versions).
   */
  defaultBranch?: string;
  /**
   * Whether the main checkout is on `defaultBranch` (false when HEAD is detached). Archives, specs and progress are read
   * from the main checkout, so off the default branch they may be outdated. Omitted with `defaultBranch`.
   */
  onDefaultBranch?: boolean;
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
  /** Absolute path prefixes discovery never descends into or reports. Tracked repositories below them stay tracked. */
  ignorePaths: string[];
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
/** What Ship answers: the session, and whether the prompt was submitted. `false` means the agent of a running session
 *  did not show the typed prompt (it may be showing a menu), so Enter was not pressed and nothing was confirmed. */
export type ShipResult = Session & { submitted: boolean };

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
  /** The worktree the agent runs in: the session's own, under the dashboard home — or an adopted one. */
  worktreePath: string;
  /**
   * The worktree already existed with the session's branch checked out (git allows a branch in one worktree only), so
   * the session runs there. The dashboard did not create it and never removes it.
   */
  adopted?: boolean;
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
  if (change.stage === "done" || change.stage === "synced") actions.push("archive"); // every task ticked, not archived yet
  return actions;
}

/** Another known repository with the same `origin` remote: probably a second clone, but never merged or hidden. */
export interface SameRemoteRepo {
  name: string;
  path: string;
  /** In the saved config (enabled or not), as opposed to another candidate. */
  tracked: boolean;
}

/** A discovery candidate. `sameRemoteAs` is information for the user and is dropped when the candidate is enabled. */
export type DiscoveredRepo = RepoConfig & { sameRemoteAs?: SameRemoteRepo[] };

export interface DiscoverResult {
  /** Repositories found under the roots that are not in the config yet. Never persisted by discovery. */
  candidates: DiscoveredRepo[];
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

/** One existing file of an artifact, relative to the change directory. */
export interface ChangeArtifactFile {
  path: string;
  bytes: number;
}

export interface ChangeArtifactEntry extends ArtifactStatus {
  /** Sorted; empty when the artifact has no file yet. */
  files: ChangeArtifactFile[];
}

/** Answer of `GET /api/repos/<repoId>/changes/<changeName>/artifacts`. */
export interface ChangeArtifacts {
  change: {
    repoId: string;
    name: string;
    schema: string;
    /** Absolute change directory; for archived changes the dated directory under `archive/`. */
    dir: string;
    archived: boolean;
  };
  /** In schema order. */
  artifacts: ChangeArtifactEntry[];
}

/** Answer of `GET /api/repos/<repoId>/changes/<changeName>/file?path=…`. */
export interface ArtifactFileContent {
  path: string;
  bytes: number;
  text: string;
}

// ---- Activity feed (openspec/specs/activity-feed) ----

interface ActivityBase {
  /** Format version of a log entry. */
  v: 1;
  /** Unique and sortable: later events have greater ids. */
  id: string;
  /** When it happened as far as the dashboard can tell (see `diffSnapshots`), ISO. */
  at: string;
  /** When the dashboard noticed, ISO. */
  detectedAt: string;
  repoId: string;
  /** The repository's name at that time, so entries of repositories that are no longer tracked stay readable. */
  repoName: string;
  /** Noticed on the first scan after the dashboard had not been running for a while. */
  catchUp?: boolean;
}

export type ActivityEvent = ActivityBase &
  (
    | { kind: "change-created"; change: string; to: string; tasks?: TaskProgress }
    | { kind: "change-moved"; change: string; from: string; to: string; tasks?: TaskProgress }
    | { kind: "tasks-progress"; change: string; column: string; from: TaskProgress; to: TaskProgress }
    | { kind: "change-archived"; change: string; from?: string }
    | { kind: "change-removed"; change: string; from: string }
    | { kind: "repo-tracked"; openChanges: number }
    | { kind: "repo-untracked" }
    | { kind: "repo-failing"; error: string }
    | { kind: "repo-recovered" }
    | { kind: "session-started"; change: string; action: string; agentName: string; resumed?: boolean }
    | { kind: "session-ended"; change: string; exitCode?: number; error?: string }
    | { kind: "session-shipped"; change: string; submitted?: boolean }
  );

export type ActivityKind = ActivityEvent["kind"];

export const ACTIVITY_KINDS: readonly ActivityKind[] = [
  "change-created",
  "change-moved",
  "tasks-progress",
  "change-archived",
  "change-removed",
  "repo-tracked",
  "repo-untracked",
  "repo-failing",
  "repo-recovered",
  "session-started",
  "session-ended",
  "session-shipped",
];

/** The filter groups of the Activity view. */
export const ACTIVITY_GROUPS: Readonly<Record<"changes" | "tasks" | "sessions" | "repositories", readonly ActivityKind[]>> = {
  changes: ["change-created", "change-moved", "change-archived", "change-removed"],
  tasks: ["tasks-progress"],
  sessions: ["session-started", "session-ended", "session-shipped"],
  repositories: ["repo-tracked", "repo-untracked", "repo-failing", "repo-recovered"],
};

export interface ActivityPage {
  /** Newest first; consecutive task progress of one change is already collapsed. */
  events: ActivityEvent[];
  /** Pass as `before` to get older events; absent when there are none. */
  nextBefore?: string;
  /** The newest recorded event, whatever the filters; absent when nothing is recorded. */
  newestId?: string;
  /** Only when the request named `since`: how many recorded events are newer than that one, whatever the filters. */
  newerThanSince?: number;
}

/**
 * What the pull action did for one repository. The fetch and the update of the main checkout are reported separately:
 * the fetch is always safe, the update only happens when it is an unambiguous fast-forward on the default branch.
 */
export interface PullResult {
  repoId: string;
  /** The remote was fetched (remote-tracking refs are current). */
  fetched: boolean;
  update: "fast-forwarded" | "up-to-date" | "skipped" | "refused" | "failed";
  /** Commits the main checkout moved forward. */
  commits?: number;
  /** Why the update was skipped, refused or failed — git's words where git decided. */
  reason?: string;
  branch?: string;
  upstream?: string;
  defaultBranch?: string;
  /** The repository has a post-merge hook; the dashboard does not run hooks. */
  hooksSkipped?: boolean;
}
