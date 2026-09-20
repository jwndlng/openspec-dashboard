import type { AgentAvailability, Config, DiscoverResult, ScanTriggerResult, Session, SessionAction, SessionEvent, SharedConfig, SharedConfigApplyResult, SharedConfigAssignment, SharedConfigPreview, Snapshot } from "../shared/types.ts";

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

  /** Agent sessions (optional feature). */
  sessions(): Promise<{ sessions: Session[]; agent: AgentAvailability }>;
  openSession(repoId: string, change: string, action: SessionAction): Promise<Session>;
  sendMessage(id: string, text: string): Promise<Session>;
  stopSession(id: string): Promise<Session>;
  cancelSession(id: string): Promise<Session>;
  closeSession(id: string, removeWorktree: boolean): Promise<{ session: Session; worktree?: { removable: boolean; reason?: string } }>;
  deleteSession(id: string): Promise<{ deleted: boolean }>;
  worktreeStatus(id: string): Promise<{ removable: boolean; reason?: string }>;
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
  sessions: () => call<{ sessions: Session[]; agent: AgentAvailability }>("/api/sessions"),
  openSession: (repoId: string, change: string, action: SessionAction) => call<Session>("/api/sessions", { method: "POST", body: JSON.stringify({ repoId, change, action }) }),
  sendMessage: (id: string, text: string) => call<Session>(`/api/sessions/${id}/messages`, { method: "POST", body: JSON.stringify({ text }) }),
  stopSession: (id: string) => call<Session>(`/api/sessions/${id}/stop`, { method: "POST" }),
  cancelSession: (id: string) => call<Session>(`/api/sessions/${id}/cancel`, { method: "POST" }),
  closeSession: (id: string, removeWorktree: boolean) =>
    call<{ session: Session; worktree?: { removable: boolean; reason?: string } }>(`/api/sessions/${id}/close`, { method: "POST", body: JSON.stringify({ removeWorktree }) }),
  deleteSession: (id: string) => call<{ deleted: boolean }>(`/api/sessions/${id}`, { method: "DELETE" }),
  worktreeStatus: (id: string) => call<{ removable: boolean; reason?: string }>(`/api/sessions/${id}/worktree`),
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
  sendMessage: (...args) => current.sendMessage(...args),
  stopSession: (...args) => current.stopSession(...args),
  cancelSession: (...args) => current.cancelSession(...args),
  closeSession: (...args) => current.closeSession(...args),
  deleteSession: (...args) => current.deleteSession(...args),
  worktreeStatus: (...args) => current.worktreeStatus(...args),
};

/**
 * Live transcript. EventSource reconnects by itself and sends Last-Event-ID, so nothing is lost or repeated;
 * `after` only positions the first connection.
 */
export function openEventStream(id: string, after: number, onEvent: (event: SessionEvent) => void): () => void {
  const source = new EventSource(`/api/sessions/${id}/events?after=${after}`);
  source.onmessage = (message) => onEvent(JSON.parse(message.data) as SessionEvent);
  return () => source.close();
}
