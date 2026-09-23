import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, normalize, parse } from "node:path";

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

/** The main console's default working directory: dashboard-owned, so the console never starts inside a repository. */
export function consoleDir(): string {
  return join(dashboardHome(), "console");
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

/**
 * The one spelling of a directory: `~` expanded, symlinks resolved and on-disk casing (the native realpath reports the
 * stored casing on case-insensitive volumes; the JS implementation only resolves symlinks). A path that does not exist
 * is returned normalised, so a deleted repository keeps the identity it was stored under. Relative paths stay relative
 * (never resolved against the working directory) so validation can reject them.
 */
export function canonicalPath(p: string): string {
  const expanded = expandPath(p);
  if (!isAbsolute(expanded)) return expanded;
  let resolved: string;
  try {
    resolved = realpathSync.native(expanded);
  } catch {
    resolved = expanded;
  }
  return resolved.length > parse(resolved).root.length ? resolved.replace(/[\\/]+$/, "") : resolved;
}
