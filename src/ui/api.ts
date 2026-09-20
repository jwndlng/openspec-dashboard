import type { AgentAvailability, Config, DiscoverResult, ScanTriggerResult, Session, SessionAction, SessionEvent, Snapshot } from "../shared/types.ts";

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly issues: string[] = []) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", "x-openspec-dashboard": "1", ...init?.headers } });
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

export const api = {
  state: () => call<Snapshot>("/api/state"),
  config: () => call<Config>("/api/config"),
  saveConfig: (config: Config) => call<Config>("/api/config", { method: "PUT", body: JSON.stringify(config) }),
  /** Read-only; pass the draft roots to discover against unsaved edits. */
  discover: (scanRoots?: string[]) =>
    call<DiscoverResult>("/api/discover", { method: "POST", body: scanRoots ? JSON.stringify({ scanRoots }) : undefined }),
  scan: () => call<ScanTriggerResult>("/api/scan", { method: "POST" }),

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

/**
 * Live transcript. EventSource reconnects by itself and sends Last-Event-ID, so nothing is lost or repeated;
 * `after` only positions the first connection.
 */
export function openEventStream(id: string, after: number, onEvent: (event: SessionEvent) => void): () => void {
  const source = new EventSource(`/api/sessions/${id}/events?after=${after}`);
  source.onmessage = (message) => onEvent(JSON.parse(message.data) as SessionEvent);
  return () => source.close();
}
