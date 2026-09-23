import type { ActivityQuery } from "../shared/activity.ts";
import type { ActivityPage, CleanupPreview, CleanupResult, CleanupSelection, CreateChangeResponse, PromptResult, PullResult, ShipResult, WorkStatus } from "../shared/types.ts";
import type { AgentAvailability, ArtifactFileContent, ChangeArtifacts, Config, DiscoverResult, ScanTriggerResult, Session, SessionAction, SessionWorktree, SharedConfig, SharedConfigApplyResult, SharedConfigAssignment, SharedConfigPreview, Snapshot } from "../shared/types.ts";
import { socketOrigin } from "./url.ts";

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly issues: string[] = []) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  if (!res.ok) {
    let message = res.statusText;
    let issues: string[] = [];
    try {
      const body = await res.json();
      message = body.error ?? message;
      issues = body.issues ?? [];
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, message, issues);
  }
  return res.json() as Promise<T>;
}

/** Everything the UI asks of a backend. The demo build implements it in memory, so a new operation needs both. */
export interface Api {
  state(): Promise<Snapshot>;
  /** Read-only: a change's artifacts and their existing files. Rejects with `ApiError` 404 for an unknown repository or change. */
  changeArtifacts(repoId: string, change: string): Promise<ChangeArtifacts>;
  /** Read-only: one file of a change. `ApiError` 400 for a bad path, 404 when it is not a file of the change, 413 when too large. */
  artifactFile(repoId: string, change: string, path: string): Promise<ArtifactFileContent>;
  /** What the dashboard observed, newest first. Read-only history; nothing else depends on it. */
  activity(query?: ActivityQuery): Promise<ActivityPage>;
  config(): Promise<Config>;
  saveConfig(config: Config): Promise<Config>;
  /** Read-only; pass the draft roots and ignore paths to discover against unsaved edits. */
  discover(scanRoots?: string[], ignorePaths?: string[]): Promise<DiscoverResult>;
  scan(): Promise<ScanTriggerResult>;
  /**
   * Creates a new change directory in the repository: `openspec/changes/<name>/` with the schema marker and, when a
   * non-empty prompt is given, `prompt.md`. Atomic; a duplicate name is refused with `409`.
   */
  createChange(repoId: string, name: string, prompt?: string): Promise<CreateChangeResponse>;
  /**
   * Fetches the repository's remote and fast-forwards its main checkout when that is safe. The only operation that
   * makes the dashboard contact a remote; it never runs unless the user asks.
   */
  pullRepo(repoId: string): Promise<PullResult>;
  pullAll(): Promise<{ results: PullResult[] }>;
  /** Read-only: the repository's worktrees, stale worktree records and branches, each removable or kept with a reason. */
  cleanupPreview(repoId: string): Promise<CleanupPreview>;
  /** Removes what the user selected and confirmed, re-checking each item; the only call that deletes a branch. */
  cleanup(repoId: string, selection: CleanupSelection): Promise<CleanupResult>;
  sharedConfig(): Promise<SharedConfig>;
  /** Stores the profiles in the dashboard home; never writes to a repository. */
  saveSharedConfig(config: SharedConfig): Promise<SharedConfig>;
  previewSharedConfig(assignments: SharedConfigAssignment[]): Promise<{ previews: SharedConfigPreview[] }>;
  /** The one call that writes to tracked repositories: the managed sections of `openspec/config.yaml`. */
  applySharedConfig(assignments: SharedConfigAssignment[]): Promise<{ results: SharedConfigApplyResult[] }>;

  /** Agent sessions (optional feature): an agent CLI in a terminal, one per change. */
  sessions(): Promise<{ sessions: Session[]; agents: AgentAvailability[]; worktrees: SessionWorktree[] }>;
  openSession(repoId: string, change: string, action: SessionAction): Promise<Session>;
  /** Continues the agent's latest conversation in the session's worktree. */
  resumeSession(id: string): Promise<Session>;
  /** Asks the session's agent to commit, push and open a pull request. */
  shipSession(id: string): Promise<ShipResult>;
  /** For a worktree whose session record is gone; refused unless that is safe. */
  removeWorktree(repoId: string, name: string): Promise<{ removable: boolean; reason?: string }>;
  /** Ends the agent if it is running; removes the worktree only when asked and safe. */
  closeSession(id: string, removeWorktree: boolean): Promise<{ session: Session; worktree?: { removable: boolean; reason?: string } }>;
  deleteSession(id: string): Promise<{ deleted: boolean }>;
  /** Whether the worktree could be removed, and its work status read at this moment (not from the list's cache). */
  worktreeStatus(id: string): Promise<{ removable: boolean; reason?: string; work?: WorkStatus }>;
  /** Sends a starter's prompt to the running session's terminal, under the rules for text sent on the user's behalf. */
  promptSession(id: string, action: SessionAction): Promise<PromptResult>;
  /**
   * The byte stream of a session's terminal. Part of this interface — not a WebSocket opened by the view — so that a
   * backend without a server (the demo) can stand in for it.
   */
  openTerminal(id: string, handlers: TerminalHandlers): TerminalConnection;
}

export interface TerminalHandlers {
  onOpen(): void;
  /** Raw terminal output, to be written to the terminal view as it is. */
  onData(bytes: Uint8Array): void;
  /** The agent's process ended. */
  onExit(): void;
  /** The answer to a `submit` message: whether Enter was pressed. Answers arrive in the order of the submissions. */
  onSubmitted(ok: boolean): void;
  onClose(): void;
}

export type TerminalMessage =
  | { type: "input"; data: string }
  /** Typed, and sent with Enter only once the agent's terminal has shown the text; answered with `onSubmitted`. */
  | { type: "submit"; data: string }
  | { type: "resize"; cols: number; rows: number };

export interface TerminalConnection {
  /** Dropped while the connection is not open. */
  send(message: TerminalMessage): void;
  close(): void;
}

export function activityQueryString(query: ActivityQuery): string {
  const params = new URLSearchParams();
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.before) params.set("before", query.before);
  if (query.repos?.length) params.set("repos", query.repos.join(","));
  if (query.kinds?.length) params.set("kinds", query.kinds.join(","));
  if (query.since !== undefined) params.set("since", query.since);
  const text = params.toString();
  return text ? `?${text}` : "";
}

export const httpApi: Api = {
  state: () => call<Snapshot>("/api/state"),
  changeArtifacts: (repoId, change) => call<ChangeArtifacts>(`/api/repos/${encodeURIComponent(repoId)}/changes/${encodeURIComponent(change)}/artifacts`),
  artifactFile: (repoId, change, path) => call<ArtifactFileContent>(`/api/repos/${encodeURIComponent(repoId)}/changes/${encodeURIComponent(change)}/file?path=${encodeURIComponent(path)}`),
  activity: (query = {}) => call<ActivityPage>(`/api/activity${activityQueryString(query)}`),
  config: () => call<Config>("/api/config"),
  saveConfig: (config) => call<Config>("/api/config", { method: "PUT", body: JSON.stringify(config) }),
  discover: (scanRoots, ignorePaths) =>
    call<DiscoverResult>("/api/discover", { method: "POST", body: scanRoots || ignorePaths ? JSON.stringify({ scanRoots, ignorePaths }) : undefined }),
  scan: () => call<ScanTriggerResult>("/api/scan", { method: "POST" }),
  createChange: (repoId, name, prompt) =>
    call<CreateChangeResponse>(`/api/repos/${encodeURIComponent(repoId)}/changes`, { method: "POST", body: JSON.stringify(prompt !== undefined && prompt !== "" ? { name, prompt } : { name }) }),
  pullRepo: (repoId) => call<PullResult>(`/api/repos/${encodeURIComponent(repoId)}/pull`, { method: "POST" }),
  pullAll: () => call<{ results: PullResult[] }>("/api/pull", { method: "POST" }),
  cleanupPreview: (repoId) => call<CleanupPreview>(`/api/repos/${encodeURIComponent(repoId)}/cleanup`),
  cleanup: (repoId, selection) => call<CleanupResult>(`/api/repos/${encodeURIComponent(repoId)}/cleanup`, { method: "POST", body: JSON.stringify(selection) }),
  sharedConfig: () => call<SharedConfig>("/api/shared-config"),
  saveSharedConfig: (config) => call<SharedConfig>("/api/shared-config", { method: "PUT", body: JSON.stringify(config) }),
  previewSharedConfig: (assignments) => call<{ previews: SharedConfigPreview[] }>("/api/shared-config/preview", { method: "POST", body: JSON.stringify({ assignments }) }),
  applySharedConfig: (assignments) => call<{ results: SharedConfigApplyResult[] }>("/api/shared-config/apply", { method: "POST", body: JSON.stringify({ assignments }) }),
  sessions: () => call<{ sessions: Session[]; agents: AgentAvailability[]; worktrees: SessionWorktree[] }>("/api/sessions"),
  openSession: (repoId, change, action) => call<Session>("/api/sessions", { method: "POST", body: JSON.stringify({ repoId, change, action }) }),
  resumeSession: (id) => call<Session>(`/api/sessions/${id}/resume`, { method: "POST" }),
  shipSession: (id) => call<ShipResult>(`/api/sessions/${id}/ship`, { method: "POST" }),
  removeWorktree: (repoId, name) => call("/api/worktrees/remove", { method: "POST", body: JSON.stringify({ repoId, name }) }),
  closeSession: (id, removeWorktree) => call(`/api/sessions/${id}/close`, { method: "POST", body: JSON.stringify({ removeWorktree }) }),
  deleteSession: (id) => call<{ deleted: boolean }>(`/api/sessions/${id}`, { method: "DELETE" }),
  worktreeStatus: (id) => call<{ removable: boolean; reason?: string; work?: WorkStatus }>(`/api/sessions/${id}/worktree`),
  promptSession: (id, action) => call<PromptResult>(`/api/sessions/${id}/prompt`, { method: "POST", body: JSON.stringify({ action }) }),
  openTerminal: (id, handlers) => {
    const socket = new WebSocket(terminalSocketUrl(id));
    socket.binaryType = "arraybuffer";
    socket.onopen = () => handlers.onOpen();
    socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        const frame = JSON.parse(event.data) as { type?: string; ok?: boolean };
        if (frame.type === "exit") handlers.onExit();
        else if (frame.type === "submitted") handlers.onSubmitted(frame.ok === true);
      } else {
        handlers.onData(new Uint8Array(event.data as ArrayBuffer));
      }
    };
    socket.onclose = () => handlers.onClose();
    return {
      send: (message) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
      },
      close: () => socket.close(),
    };
  },
};

let current: Api = httpApi;

/** Chosen once by the entry point, before the first render. */
export function setApi(impl: Api): void {
  current = impl;
}

/** What components import; forwards to the implementation the entry point chose (HTTP unless told otherwise). */
export const api: Api = {
  state: () => current.state(),
  changeArtifacts: (...args) => current.changeArtifacts(...args),
  artifactFile: (...args) => current.artifactFile(...args),
  activity: (query) => current.activity(query),
  config: () => current.config(),
  saveConfig: (config) => current.saveConfig(config),
  discover: (scanRoots, ignorePaths) => current.discover(scanRoots, ignorePaths),
  scan: () => current.scan(),
  createChange: (...args) => current.createChange(...args),
  pullRepo: (repoId) => current.pullRepo(repoId),
  pullAll: () => current.pullAll(),
  cleanupPreview: (...args) => current.cleanupPreview(...args),
  cleanup: (...args) => current.cleanup(...args),
  sharedConfig: () => current.sharedConfig(),
  saveSharedConfig: (config) => current.saveSharedConfig(config),
  previewSharedConfig: (assignments) => current.previewSharedConfig(assignments),
  applySharedConfig: (assignments) => current.applySharedConfig(assignments),
  sessions: (...args) => current.sessions(...args),
  openSession: (...args) => current.openSession(...args),
  resumeSession: (...args) => current.resumeSession(...args),
  shipSession: (...args) => current.shipSession(...args),
  removeWorktree: (...args) => current.removeWorktree(...args),
  closeSession: (...args) => current.closeSession(...args),
  deleteSession: (...args) => current.deleteSession(...args),
  worktreeStatus: (...args) => current.worktreeStatus(...args),
  promptSession: (...args) => current.promptSession(...args),
  openTerminal: (...args) => current.openTerminal(...args),
};

/** Where the terminal of a session is served: a WebSocket on the dashboard's own host. */
export function terminalSocketUrl(id: string): string {
  return `${socketOrigin()}/api/sessions/${id}/terminal`;
}
