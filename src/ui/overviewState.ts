// Projects overview: URL state, row derivation and sorting. Pure, shared by the view and its tests.
import { isComplete } from "../shared/columns.ts";
import type { Config, RepoSharedConfig, RepoSnapshot, Snapshot } from "../shared/types.ts";

/**
 * The snapshot restricted to repositories enabled in the config. Saving Settings triggers a rescan without waiting
 * for it, so a just-disabled repository would otherwise linger until the next poll.
 */
export function enabledOnly(snapshot: Snapshot | null, config: Config | null): Snapshot | null {
  if (!snapshot || !config) return snapshot;
  const enabled = new Set(config.repos.filter((r) => r.enabled).map((r) => r.id));
  return { ...snapshot, repos: snapshot.repos.filter((r) => enabled.has(r.id)) };
}

export type SortKey = "updated" | "name" | "open" | "archive";
export type SortDir = "asc" | "desc";

export interface OverviewState {
  sort: SortKey;
  dir: SortDir;
  q: string;
}

const SORT_KEYS: SortKey[] = ["updated", "name", "open", "archive"];

/** Newest / biggest first, except names. */
export function naturalDir(sort: SortKey): SortDir {
  return sort === "name" ? "asc" : "desc";
}

export const DEFAULT_OVERVIEW_STATE: OverviewState = { sort: "updated", dir: "desc", q: "" };

export function parseOverviewState(search: string): OverviewState {
  const p = new URLSearchParams(search);
  const rawSort = p.get("sort") as SortKey | null;
  const sort = rawSort && SORT_KEYS.includes(rawSort) ? rawSort : "updated";
  const rawDir = p.get("dir");
  const dir = rawDir === "asc" || rawDir === "desc" ? rawDir : naturalDir(sort);
  return { sort, dir, q: p.get("q") ?? "" };
}

/** Defaults are omitted so a plain `/` stays a plain `/`. */
export function serializeOverviewState(s: OverviewState): string {
  const p = new URLSearchParams();
  if (s.sort !== "updated") p.set("sort", s.sort);
  if (s.dir !== naturalDir(s.sort)) p.set("dir", s.dir);
  if (s.q) p.set("q", s.q);
  const out = p.toString();
  return out ? `?${out}` : "";
}

/** Activating the active header flips direction; a new header starts in its natural direction. */
export function toggleSort(state: OverviewState, key: SortKey): OverviewState {
  if (state.sort === key) return { ...state, dir: state.dir === "asc" ? "desc" : "asc" };
  return { ...state, sort: key, dir: naturalDir(key) };
}

export interface OverviewRow {
  id: string;
  name: string;
  path: string;
  /** Set only when another row has the same name: the shortest part of the parent directory that tells them apart. */
  hint?: string;
  ok: boolean;
  error?: string;
  /** Non-archived changes per board column. */
  stageCounts: Record<string, number>;
  open: number;
  toArchive: number;
  archived: number;
  lastUpdatedAt?: string;
  sharedConfig?: RepoSharedConfig;
  isGit: boolean;
  currentBranch?: string;
  defaultBranch?: string;
  onDefaultBranch?: boolean;
}

function newestActivity(repo: RepoSnapshot): string | undefined {
  let best: string | undefined;
  for (const c of repo.changes) {
    if (c.lastActivityAt && (!best || Date.parse(c.lastActivityAt) > Date.parse(best))) best = c.lastActivityAt;
  }
  return best;
}

/** Parent-directory segments of a path, nearest first. */
function parentSegments(path: string): string[] {
  return path.split(/[\\/]+/).filter(Boolean).slice(0, -1).reverse();
}

/** For rows sharing a name: the shortest trailing run of parent segments that is unique within the group. */
function addHints(rows: OverviewRow[]): void {
  const groups = new Map<string, OverviewRow[]>();
  for (const row of rows) {
    const key = row.name.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const parents = group.map((r) => parentSegments(r.path));
    const deepest = Math.max(1, ...parents.map((p) => p.length));
    const suffix = (segments: string[], depth: number) => segments.slice(0, depth).reverse().join("/");
    for (const [i, row] of group.entries()) {
      let depth = 1;
      while (depth < deepest && parents.some((other, j) => j !== i && suffix(other, depth) === suffix(parents[i], depth))) depth++;
      row.hint = suffix(parents[i], depth) || row.path;
    }
  }
}

export function overviewRows(snapshot: Snapshot): OverviewRow[] {
  const rows = snapshot.repos.map((repo): OverviewRow => {
    const stageCounts: Record<string, number> = {};
    let open = 0;
    let toArchive = 0;
    let archived = 0;
    for (const c of repo.changes) {
      if (c.archived) {
        archived++;
        continue;
      }
      open++;
      if (isComplete(c.stage)) toArchive++;
      stageCounts[c.column] = (stageCounts[c.column] ?? 0) + 1;
    }
    return {
      id: repo.id,
      name: repo.name,
      path: repo.path,
      ok: repo.ok,
      error: repo.error,
      stageCounts,
      open,
      toArchive,
      archived,
      // Snapshots cached by older versions, and repos that never scanned cleanly, have no repo-level date.
      lastUpdatedAt: repo.lastUpdatedAt ?? newestActivity(repo),
      sharedConfig: repo.sharedConfig,
      isGit: repo.isGit,
      currentBranch: repo.currentBranch,
      defaultBranch: repo.defaultBranch,
      onDefaultBranch: repo.onDefaultBranch,
    };
  });
  addHints(rows);
  return rows;
}

const byName = (a: OverviewRow, b: OverviewRow) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

export function sortRows(rows: OverviewRow[], sort: SortKey, dir: SortDir): OverviewRow[] {
  const sign = dir === "asc" ? 1 : -1;
  const time = (r: OverviewRow) => (r.lastUpdatedAt ? Date.parse(r.lastUpdatedAt) : Number.NaN);
  return [...rows].sort((a, b) => {
    if (sort === "name") return sign * byName(a, b);
    if (sort === "updated") {
      const [ta, tb] = [time(a), time(b)];
      // Undated repos go last whichever way the column is sorted.
      if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.isNaN(ta) === Number.isNaN(tb) ? byName(a, b) : Number.isNaN(ta) ? 1 : -1;
      return sign * (ta - tb) || byName(a, b);
    }
    const value = (r: OverviewRow) => (sort === "open" ? r.open : r.toArchive);
    return sign * (value(a) - value(b)) || byName(a, b);
  });
}

export function filterRows(rows: OverviewRow[], q: string): OverviewRow[] {
  const needle = q.trim().toLowerCase();
  return needle ? rows.filter((r) => r.name.toLowerCase().includes(needle) || r.hint?.toLowerCase().includes(needle)) : rows;
}
