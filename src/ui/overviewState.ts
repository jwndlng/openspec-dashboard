// Projects overview: URL state, row derivation and sorting. Pure, shared by the view and its tests.
import { isComplete } from "../shared/columns.ts";
import type { Config, RepoSharedConfig, RepoSnapshot, Snapshot, WorkInProgress, Worktree } from "../shared/types.ts";

/**
 * The snapshot restricted to repositories enabled in the config. Saving Settings triggers a rescan without waiting
 * for it, so a just-disabled repository would otherwise linger until the next poll.
 */
export function enabledOnly(snapshot: Snapshot | null, config: Config | null): Snapshot | null {
  if (!snapshot || !config) return snapshot;
  const enabled = new Set(config.repos.filter((r) => r.enabled).map((r) => r.id));
  return { ...snapshot, repos: snapshot.repos.filter((r) => enabled.has(r.id)) };
}

export type SortKey = "updated" | "name" | "open" | "archive" | "wip";
export type SortDir = "asc" | "desc";
export type OverviewLayout = "table" | "tiles";

export interface OverviewState {
  sort: SortKey;
  dir: SortDir;
  q: string;
  /** Only repositories with checkouts needing attention. */
  wip: boolean;
  view: OverviewLayout;
}

export const SORT_KEYS: SortKey[] = ["updated", "name", "open", "archive", "wip"];

/** Newest / biggest first, except names. */
export function naturalDir(sort: SortKey): SortDir {
  return sort === "name" ? "asc" : "desc";
}

export const DEFAULT_OVERVIEW_STATE: OverviewState = { sort: "updated", dir: "desc", q: "", wip: false, view: "table" };

export function parseOverviewState(search: string): OverviewState {
  const p = new URLSearchParams(search);
  const rawSort = p.get("sort") as SortKey | null;
  const sort = rawSort && SORT_KEYS.includes(rawSort) ? rawSort : "updated";
  const rawDir = p.get("dir");
  const dir = rawDir === "asc" || rawDir === "desc" ? rawDir : naturalDir(sort);
  // Anything but `tiles` is the table, so an unknown layout falls back to the default.
  return { sort, dir, q: p.get("q") ?? "", wip: p.get("wip") === "1", view: p.get("view") === "tiles" ? "tiles" : "table" };
}

/** Defaults are omitted so a plain `/` stays a plain `/`. */
export function serializeOverviewState(s: OverviewState): string {
  const p = new URLSearchParams();
  if (s.sort !== "updated") p.set("sort", s.sort);
  if (s.dir !== naturalDir(s.sort)) p.set("dir", s.dir);
  if (s.q) p.set("q", s.q);
  if (s.wip) p.set("wip", "1");
  if (s.view !== "table") p.set("view", s.view);
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
  /** Absent for non-git repositories and until the first scan after an upgrade. */
  workInProgress?: WorkInProgress;
  /** Every checkout of the repository, the main one included. */
  worktrees: Worktree[];
}

/** Checkouts needing attention: uncommitted plus unpushed plus stale. 0 without a summary. */
export function attentionCount(row: Pick<OverviewRow, "workInProgress">): number {
  const s = row.workInProgress;
  return s ? s.uncommitted + s.unpushed + s.stale : 0;
}

export interface WipIndicator {
  /** Non-zero parts in the order worktrees, uncommitted, unpushed, stale. */
  parts: string[];
  text: string;
  /** Something is uncommitted, unpushed or stale; otherwise there are only clean worktrees. */
  warn: boolean;
}

/** The overview's work-in-progress indicator, or undefined when there is nothing to say (clean repository, or no summary). */
export function wipIndicator(summary: WorkInProgress | undefined): WipIndicator | undefined {
  if (!summary) return undefined;
  const parts: string[] = [];
  if (summary.worktrees > 0) parts.push(`${summary.worktrees} ${summary.worktrees === 1 ? "worktree" : "worktrees"}`);
  if (summary.uncommitted > 0) parts.push(`${summary.uncommitted} uncommitted`);
  if (summary.unpushed > 0) parts.push(`${summary.unpushed} unpushed`);
  if (summary.stale > 0) parts.push(`${summary.stale} stale`);
  if (parts.length === 0) return undefined;
  return { parts, text: parts.join(" · "), warn: summary.uncommitted + summary.unpushed + summary.stale > 0 };
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
      workInProgress: repo.workInProgress,
      worktrees: repo.worktrees,
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
    const value = (r: OverviewRow) => (sort === "open" ? r.open : sort === "archive" ? r.toArchive : attentionCount(r));
    return sign * (value(a) - value(b)) || byName(a, b);
  });
}

/** Search and the work-in-progress filter combine. */
export function filterRows(rows: OverviewRow[], q: string, wip = false): OverviewRow[] {
  const needle = q.trim().toLowerCase();
  return rows.filter((r) => (!wip || attentionCount(r) > 0) && (!needle || r.name.toLowerCase().includes(needle) || r.hint?.toLowerCase().includes(needle)));
}

/** A tile's monogram: the initials of up to two words of the repository name (`atlas-api` → `AA`, `docs` → `D`). */
export function monogram(name: string): string {
  const words = name.split(/[-_.\s/]+/).filter(Boolean);
  return (words.length ? words.slice(0, 2).map((w) => w[0]) : ["?"]).join("").toUpperCase();
}

export interface CheckoutSummary {
  /** Linked worktrees; the main checkout is not a worktree. */
  worktrees: number;
  /** Distinct branches checked out anywhere, main checkout included; detached and bare entries have none. */
  branches: number;
  text: string;
  /** One line per checkout, for the tooltip: where the details went when the tile stopped listing them. */
  detail: string;
}

/** A tile's checkout line: `3 worktrees · 4 branches active` instead of one chip per checkout. */
export function checkoutSummary(worktrees: Worktree[]): CheckoutSummary {
  const linked = worktrees.filter((w) => !w.isMain && !w.bare);
  const branches = new Set(worktrees.filter((w) => !w.bare && !w.detached && w.branch).map((w) => w.branch as string));
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const text = `${plural(linked.length, "worktree", "worktrees")} · ${plural(branches.size, "branch", "branches")} active`;
  const detail = worktrees
    .filter((w) => !w.bare)
    .map((w) => `${w.branch ?? `detached @ ${w.head ?? "?"}`} — ${w.isMain ? "main checkout" : w.prunable ? "stale worktree" : "worktree"}`)
    .join("\n");
  return { worktrees: linked.length, branches: branches.size, text, detail };
}
