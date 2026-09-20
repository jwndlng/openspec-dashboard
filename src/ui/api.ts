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
};
