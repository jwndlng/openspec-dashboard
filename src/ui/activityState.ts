// The Activity view's pure parts: filters ↔ URL, grouping by day, wording, and what counts as unseen.
// Free of DOM access at import time; the storage helpers tolerate a browser that refuses localStorage.
import { ACTIVITY_GROUPS, type ActivityEvent, type ActivityKind } from "../shared/types.ts";

export type ActivityGroup = keyof typeof ACTIVITY_GROUPS;
export const GROUP_LABELS: Record<ActivityGroup, string> = { changes: "Changes", tasks: "Tasks", sessions: "Sessions", repositories: "Repositories" };
export const GROUP_ORDER = Object.keys(GROUP_LABELS) as ActivityGroup[];

export interface ActivityFilters {
  repos: string[];
  /** Empty means every kind. */
  groups: ActivityGroup[];
}

export const EMPTY_ACTIVITY_FILTERS: ActivityFilters = { repos: [], groups: [] };

export function parseActivityFilters(search: string): ActivityFilters {
  const params = new URLSearchParams(search);
  const list = (name: string) => (params.get(name) ?? "").split(",").filter(Boolean);
  return { repos: list("repos"), groups: list("show").filter((g): g is ActivityGroup => g in ACTIVITY_GROUPS) };
}

export function serializeActivityFilters(filters: ActivityFilters): string {
  const params = new URLSearchParams();
  if (filters.repos.length) params.set("repos", filters.repos.join(","));
  if (filters.groups.length) params.set("show", GROUP_ORDER.filter((g) => filters.groups.includes(g)).join(","));
  const text = params.toString().replaceAll("%2C", ",");
  return text ? `?${text}` : "";
}

export function kindsFor(groups: readonly ActivityGroup[]): ActivityKind[] {
  return groups.flatMap((g) => ACTIVITY_GROUPS[g]);
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface ActivityDay {
  key: string;
  label: string;
  events: ActivityEvent[];
}

/** Groups events (newest first) under local calendar days: Today, Yesterday, then the date. */
export function groupByDay(events: readonly ActivityEvent[], now: Date): ActivityDay[] {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const days: ActivityDay[] = [];
  for (const event of events) {
    const at = new Date(event.at);
    const key = dayKey(at);
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      const label = key === today ? "Today" : key === yesterday ? "Yesterday" : at.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
      day = { key, label, events: [] };
      days.push(day);
    }
    day.events.push(event);
  }
  return days;
}

export function timeOfDay(iso: string): string {
  const at = new Date(iso);
  return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
}

const tasks = (t: { done: number; total: number }) => `${t.done}/${t.total}`;

/** What happened, in a few words. The repository and the change are shown next to it, so they are not repeated here. */
export function describe(event: ActivityEvent): string {
  switch (event.kind) {
    case "change-created":
      return `created in ${event.to}`;
    case "change-moved":
      return `moved ${event.from} → ${event.to}${event.tasks ? ` · ${tasks(event.tasks)}` : ""}`;
    case "tasks-progress":
      return `tasks ${tasks(event.from)} → ${tasks(event.to)}`;
    case "change-archived":
      return event.from ? `archived from ${event.from}` : "archived";
    case "change-removed":
      return `removed (was in ${event.from})`;
    case "repo-tracked":
      return `now tracked · ${event.openChanges} open change${event.openChanges === 1 ? "" : "s"}`;
    case "repo-untracked":
      return "no longer tracked";
    case "repo-failing":
      return `scan failing: ${event.error}`;
    case "repo-recovered":
      return "scan recovered";
    case "session-started":
      return `session ${event.resumed ? "resumed" : "started"}: ${event.action} with ${event.agentName}`;
    case "session-ended":
      if (event.error) return `session failed: ${event.error}`;
      return event.exitCode === undefined || event.exitCode === 0 ? "session ended" : `session ended (exit ${event.exitCode})`;
    case "session-shipped":
      return event.submitted === false ? "ship requested — typed, not sent" : "ship requested";
  }
}

/** Visual weight of an entry: what needs a second look stands out, routine progress recedes. */
export function tone(event: ActivityEvent): "danger" | "ok" | "quiet" | "normal" {
  if (event.kind === "repo-failing" || (event.kind === "session-ended" && (event.error !== undefined || (event.exitCode ?? 0) !== 0))) return "danger";
  if (event.kind === "change-archived" || event.kind === "repo-recovered") return "ok";
  if (event.kind === "tasks-progress" || event.kind === "repo-tracked" || event.kind === "repo-untracked") return "quiet";
  return "normal";
}

// ---- unseen ----

export const ACTIVITY_SEEN_KEY = "openspec-dashboard.activity.seen";

export function loadSeen(): string | undefined {
  try {
    return localStorage.getItem(ACTIVITY_SEEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function saveSeen(id: string): void {
  try {
    localStorage.setItem(ACTIVITY_SEEN_KEY, id);
  } catch {
    // Storage unavailable: no unseen count, the feed itself works.
  }
}

/** The number next to the navigation entry: nothing for none, capped so it never grows wide. */
export function unseenLabel(count: number | undefined): string {
  if (!count || count < 1) return "";
  return count > 99 ? "99+" : String(count);
}
