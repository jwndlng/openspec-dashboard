// Board filters live in the URL query string so a reload keeps them.
/**
 * How the board lays its columns out: side by side as lanes, or stacked as full-width sections for a narrow window.
 * `auto` follows the window's width. Not a filter: it changes no card, and clearing the filters keeps it.
 */
export type BoardLayout = "auto" | "lanes" | "stack";

export interface Filters {
  repos: string[];
  q: string;
  staleDays: number;
  hideArchived: boolean;
  layout: BoardLayout;
}

export const EMPTY_FILTERS: Filters = { repos: [], q: "", staleDays: 0, hideArchived: false, layout: "auto" };

/** Below this window width, `auto` stacks the columns. */
export const STACK_BELOW_PX = 1280;

/** The layout on screen: an explicit choice, or for `auto` the one that fits the window. */
export function resolveLayout(layout: BoardLayout, narrow: boolean): "lanes" | "stack" {
  return layout === "auto" ? (narrow ? "stack" : "lanes") : layout;
}

export function parseFilters(search: string): Filters {
  const p = new URLSearchParams(search);
  const stale = Number(p.get("stale") ?? 0);
  return {
    repos: (p.get("repos") ?? "").split(",").filter(Boolean),
    q: p.get("q") ?? "",
    staleDays: Number.isFinite(stale) && stale > 0 ? Math.floor(stale) : 0,
    hideArchived: p.get("archived") === "0",
    layout: p.get("layout") === "lanes" || p.get("layout") === "stack" ? (p.get("layout") as BoardLayout) : "auto",
  };
}

export function serializeFilters(f: Filters): string {
  const p = new URLSearchParams();
  if (f.repos.length) p.set("repos", f.repos.join(","));
  if (f.q) p.set("q", f.q);
  if (f.staleDays > 0) p.set("stale", String(f.staleDays));
  if (f.hideArchived) p.set("archived", "0");
  if (f.layout !== "auto") p.set("layout", f.layout);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** The idle thresholds the Stale selector offers besides "Any activity". */
export const STALE_PRESETS = [7, 14, 30, 90];

export function staleLabel(days: number): string {
  return days > 0 ? `Idle ${days}+ days` : "Any activity";
}

/** The Stale selector's options: any activity, the presets, and the current threshold when the URL holds another one. */
export function staleOptions(current: number): { value: number; label: string }[] {
  const days = [...new Set([...STALE_PRESETS, ...(current > 0 ? [current] : [])])].sort((a, b) => a - b);
  return [0, ...days].map((value) => ({ value, label: staleLabel(value) }));
}

export interface FilterTag {
  key: string;
  label: string;
  /** Set for a repository tag, so it can wear that repository's colour. */
  repoId?: string;
  /** What removing the tag changes. */
  clear: Partial<Filters>;
}

/**
 * The removable tags of the filter bar: each selected repository, in the board's repository order, and the stale
 * threshold. The search stays in its own field and is not repeated as a tag.
 */
export function activeTags(filters: Filters, repos: { id: string; name: string }[]): FilterTag[] {
  const tags: FilterTag[] = repos
    .filter((r) => filters.repos.includes(r.id))
    .map((r) => ({ key: `repo:${r.id}`, label: r.name, repoId: r.id, clear: { repos: filters.repos.filter((id) => id !== r.id) } }));
  if (filters.staleDays > 0) tags.push({ key: "stale", label: staleLabel(filters.staleDays), clear: { staleDays: 0 } });
  return tags;
}

/** Whether any filter differs from the defaults. */
export function hasActiveFilters(f: Filters): boolean {
  return f.q !== "" || f.repos.length > 0 || f.staleDays > 0 || f.hideArchived;
}
