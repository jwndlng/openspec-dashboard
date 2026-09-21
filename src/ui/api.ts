import type { ShipResult, WorkStatus } from "../shared/types.ts";
import type { AgentAvailability, Config, DiscoverResult, ScanTriggerResult, Session, SessionAction, SessionWorktree, SharedConfig, SharedConfigApplyResult, SharedConfigAssignment, SharedConfigPreview, Snapshot } from "../shared/types.ts";
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
  config(): Promise<Config>;
  saveConfig(config: Config): Promise<Config>;
  /** Read-only; pass the draft roots to discover against unsaved edits. */
  discover(scanRoots?: string[]): Promise<DiscoverResult>;
  scan(): Promise<ScanTriggerResult>;
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
  /** Types a starter's prompt into the running session's terminal; Enter stays with the user. */
  promptSession(id: string, action: SessionAction): Promise<Session>;
}

export const httpApi: Api = {
  state: () => call<Snapshot>("/api/state"),
  config: () => call<Config>("/api/config"),
  saveConfig: (config) => call<Config>("/api/config", { method: "PUT", body: JSON.stringify(config) }),
  discover: (scanRoots) =>
    call<DiscoverResult>("/api/discover", { method: "POST", body: scanRoots ? JSON.stringify({ scanRoots }) : undefined }),
  scan: () => call<ScanTriggerResult>("/api/scan", { method: "POST" }),
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
  promptSession: (id, action) => call<Session>(`/api/sessions/${id}/prompt`, { method: "POST", body: JSON.stringify({ action }) }),
};

let current: Api = httpApi;

/** Chosen once by the entry point, before the first render. */
export function setApi(impl: Api): void {
  current = impl;
}

/** What components import; forwards to the implementation the entry point chose (HTTP unless told otherwise). */
export const api: Api = {
  state: () => current.state(),
  config: () => current.config(),
  saveConfig: (config) => current.saveConfig(config),
  discover: (scanRoots) => current.discover(scanRoots),
  scan: () => current.scan(),
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
};

/** Where the terminal of a session is served: a WebSocket on the dashboard's own host. */
export function terminalSocketUrl(id: string): string {
  return `${socketOrigin()}/api/sessions/${id}/terminal`;
}
