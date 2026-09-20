import { homedir } from "node:os";
import { join, normalize } from "node:path";

/** Base directory for config and cache; overridable for tests. */
export function dashboardHome(): string {
  return process.env.OPENSPEC_DASHBOARD_HOME ?? join(homedir(), ".openspec-dashboard");
}

export function configPath(): string {
  return join(dashboardHome(), "config.json");
}

/** Agent session records (metadata + transcript); never inside a repository. */
export function sessionsDir(): string {
  return join(dashboardHome(), "sessions");
}

export function sharedConfigPath(): string {
  return join(dashboardHome(), "shared-config.json");
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
