import type { Config, DiscoverResult, ScanTriggerResult, SharedConfig, SharedConfigApplyResult, SharedConfigAssignment, SharedConfigPreview, Snapshot } from "../shared/types.ts";

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

export const api = {
  state: () => call<Snapshot>("/api/state"),
  config: () => call<Config>("/api/config"),
  saveConfig: (config: Config) => call<Config>("/api/config", { method: "PUT", body: JSON.stringify(config) }),
  /** Read-only; pass the draft roots to discover against unsaved edits. */
  discover: (scanRoots?: string[]) =>
    call<DiscoverResult>("/api/discover", { method: "POST", body: scanRoots ? JSON.stringify({ scanRoots }) : undefined }),
  scan: () => call<ScanTriggerResult>("/api/scan", { method: "POST" }),
  sharedConfig: () => call<SharedConfig>("/api/shared-config"),
  /** Stores the profiles in the dashboard home; never writes to a repository. */
  saveSharedConfig: (config: SharedConfig) => call<SharedConfig>("/api/shared-config", { method: "PUT", body: JSON.stringify(config) }),
  previewSharedConfig: (assignments: SharedConfigAssignment[]) =>
    call<{ previews: SharedConfigPreview[] }>("/api/shared-config/preview", { method: "POST", body: JSON.stringify({ assignments }) }),
  /** The one call that writes to tracked repositories: the managed sections of `openspec/config.yaml`. */
  applySharedConfig: (assignments: SharedConfigAssignment[]) =>
    call<{ results: SharedConfigApplyResult[] }>("/api/shared-config/apply", { method: "POST", body: JSON.stringify({ assignments }) }),
};
