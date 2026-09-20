// Minimized repository groups: pure resolution logic plus thin localStorage effects (same shape as theme.ts).
// Only deviations from the default are stored, so new repositories and columns pick up the defaults.
export const GROUP_STATE_STORAGE_KEY = "openspec-dashboard.groups.v1";

/** `"<repoId>|<column>"` → minimized?, present only where the user chose something other than the default. */
export type GroupOverrides = Record<string, boolean>;

export function defaultMinimized(column: string): boolean {
  return column === "Archived";
}

export function groupKey(repoId: string, column: string): string {
  return `${repoId}|${column}`;
}

export function isMinimized(overrides: GroupOverrides, repoId: string, column: string): boolean {
  return overrides[groupKey(repoId, column)] ?? defaultMinimized(column);
}

/** Flips one group. Returning to the default removes the entry instead of storing it. */
export function toggleGroup(overrides: GroupOverrides, repoId: string, column: string): GroupOverrides {
  const key = groupKey(repoId, column);
  const next = !isMinimized(overrides, repoId, column);
  const { [key]: _previous, ...rest } = overrides;
  return next === defaultMinimized(column) ? rest : { ...rest, [key]: next };
}

/** Drops entries of repositories that are no longer tracked. */
export function pruneGroupState(overrides: GroupOverrides, knownRepoIds: Iterable<string>): GroupOverrides {
  const known = new Set(knownRepoIds);
  return Object.fromEntries(Object.entries(overrides).filter(([key]) => known.has(key.slice(0, key.indexOf("|")))));
}

/** Tolerant: anything that is not an object of booleans keyed `repo|column` is ignored. */
export function parseGroupState(raw: string | null | undefined): GroupOverrides {
  if (!raw) return {};
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, v]) => typeof v === "boolean" && key.indexOf("|") > 0)) as GroupOverrides;
}

export function serializeGroupState(overrides: GroupOverrides): string {
  return JSON.stringify(overrides);
}

export function loadGroupState(): GroupOverrides {
  try {
    return parseGroupState(localStorage.getItem(GROUP_STATE_STORAGE_KEY));
  } catch {
    return {};
  }
}

export function saveGroupState(overrides: GroupOverrides, knownRepoIds: Iterable<string>): void {
  try {
    const pruned = pruneGroupState(overrides, knownRepoIds);
    if (Object.keys(pruned).length === 0) localStorage.removeItem(GROUP_STATE_STORAGE_KEY);
    else localStorage.setItem(GROUP_STATE_STORAGE_KEY, serializeGroupState(pruned));
  } catch {
    // Storage unavailable: the choice still applies for this page session.
  }
}
