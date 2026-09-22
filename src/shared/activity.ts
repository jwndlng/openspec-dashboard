// Activity helpers shared by the server (serving the feed) and the UI. Pure.
import type { ActivityEvent, ActivityKind, ActivityPage } from "./types.ts";

/** Task ticks of one change this close together are shown as one entry. */
export const COLLAPSE_WINDOW_MS = 60 * 60 * 1000;

/** Newest first: by when it happened, then by when it was noticed. */
export function byNewest(a: ActivityEvent, b: ActivityEvent): number {
  if (a.at !== b.at) return a.at < b.at ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/**
 * Collapses runs of task progress (design D6). `events` must be newest first. Consecutive `tasks-progress` events of
 * one change, each within the window of the next, become one entry from the oldest `from` to the newest `to`, keeping
 * the newest event's id and time. Any other event of that change ends the run. The input is not modified.
 */
export function collapseTaskProgress(events: readonly ActivityEvent[]): ActivityEvent[] {
  const out: ActivityEvent[] = [];
  // For every change with a run in progress: where its entry sits in `out`, and the time of the oldest event merged so far.
  const runs = new Map<string, { index: number; oldestAt: number }>();
  for (const event of events) {
    if (!("change" in event)) {
      out.push(event);
      continue;
    }
    const key = `${event.repoId}\n${event.change}`;
    if (event.kind !== "tasks-progress") {
      runs.delete(key);
      out.push(event);
      continue;
    }
    const at = Date.parse(event.at);
    const run = runs.get(key);
    const entry = run && out[run.index];
    if (run && entry?.kind === "tasks-progress" && run.oldestAt - at <= COLLAPSE_WINDOW_MS) {
      out[run.index] = { ...entry, from: event.from };
      run.oldestAt = at;
    } else {
      runs.set(key, { index: out.length, oldestAt: at });
      out.push(event);
    }
  }
  return out;
}

export const DEFAULT_PAGE = 100;
export const MAX_PAGE = 500;

export interface ActivityQuery {
  limit?: number;
  /** Only events after this one in the feed, i.e. older. */
  before?: string;
  repos?: string[];
  kinds?: ActivityKind[];
  /** When given, the page also says how many recorded events are newer than this id. */
  since?: string;
}

/** One page of the feed out of everything recorded (`entries` in detection order, oldest first). */
export function pageEvents(entries: readonly ActivityEvent[], query: ActivityQuery = {}): ActivityPage {
  const limit = Math.min(MAX_PAGE, Math.max(1, query.limit ?? DEFAULT_PAGE));
  const newestId = entries.at(-1)?.id;
  const repos = query.repos?.length ? new Set(query.repos) : undefined;
  const kinds = query.kinds?.length ? new Set<string>(query.kinds) : undefined;
  const matching = entries.filter((e) => (!repos || repos.has(e.repoId)) && (!kinds || kinds.has(e.kind)));
  const feed = collapseTaskProgress([...matching].sort(byNewest));
  let start = 0;
  if (query.before) {
    const before = query.before;
    const at = feed.findIndex((e) => e.id === before);
    // An unknown cursor (compacted away, or merged into a run since) starts after everything not older than it.
    start = at >= 0 ? at + 1 : feed.findIndex((e) => e.id < before);
    if (start < 0) start = feed.length;
  }
  const events = feed.slice(start, start + limit);
  const page: ActivityPage = { events };
  if (start + limit < feed.length && events.length > 0) page.nextBefore = events[events.length - 1].id;
  if (newestId) page.newestId = newestId;
  if (query.since !== undefined) {
    const since = query.since;
    page.newerThanSince = entries.filter((e) => e.id > since).length;
  }
  return page;
}
