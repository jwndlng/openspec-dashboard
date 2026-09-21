import { homedir } from "node:os";
import { join, normalize } from "node:path";

/** Base directory for config and cache; overridable for tests. */
export function dashboardHome(): string {
  return process.env.OPENSPEC_DASHBOARD_HOME ?? join(homedir(), ".openspec-dashboard");
}

export function configPath(): string {
  return join(dashboardHome(), "config.json");
}

/** Agent session records (metadata and the stored tail of terminal output); never inside a repository. */
export function sessionsDir(): string {
  return join(dashboardHome(), "sessions");
}

/** Session worktrees live in the dashboard home, so tracked repositories never see an untracked directory. */
export function worktreesDir(): string {
  return join(dashboardHome(), "worktrees");
}

export function sharedConfigPath(): string {
  return join(dashboardHome(), "shared-config.json");
}

/** History of what the dashboard observed. A log, not a cache: it cannot be rebuilt, and nothing but the feed reads it. */
export function activityLogPath(): string {
  return join(dashboardHome(), "activity.jsonl");
}

export function cachePath(): string {
  return join(dashboardHome(), "cache", "snapshot.json");
}

/** Expands a leading `~` and normalises; relative paths stay relative so validation can reject them. */
export function expandPath(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return normalize(p);
}
