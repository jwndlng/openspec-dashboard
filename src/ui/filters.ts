// Board filters live in the URL query string so a reload keeps them.
export interface Filters {
  repos: string[];
  q: string;
  staleDays: number;
  hideArchived: boolean;
}

export const EMPTY_FILTERS: Filters = { repos: [], q: "", staleDays: 0, hideArchived: false };

export function parseFilters(search: string): Filters {
  const p = new URLSearchParams(search);
  const stale = Number(p.get("stale") ?? 0);
  return {
    repos: (p.get("repos") ?? "").split(",").filter(Boolean),
    q: p.get("q") ?? "",
    staleDays: Number.isFinite(stale) && stale > 0 ? Math.floor(stale) : 0,
    hideArchived: p.get("archived") === "0",
  };
}

export function serializeFilters(f: Filters): string {
  const p = new URLSearchParams();
  if (f.repos.length) p.set("repos", f.repos.join(","));
  if (f.q) p.set("q", f.q);
  if (f.staleDays > 0) p.set("stale", String(f.staleDays));
  if (f.hideArchived) p.set("archived", "0");
  const s = p.toString();
  return s ? `?${s}` : "";
}
