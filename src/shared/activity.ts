// Activity helpers shared by the server (serving the feed) and the UI. Pure.
import type { ActivityDayCount, ActivityEvent, ActivityKind, ActivityMetrics, ActivityPage, ActivityRepoCount, ActivitySummary } from "./types.ts";

/** Task ticks of one change this close together are shown as one entry. */
export const COLLAPSE_WINDOW_MS = 60 * 60 * 1000;

/** The log keeps only events that happened within this long; older ones are not shown, counted or kept on disk. */
export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const RETENTION_DAYS = RETENTION_MS / (24 * 60 * 60 * 1000);

/**
 * The events still within the retention window at `nowMs`, in their order. Measured by `at` (when it happened, which
 * is what the feed groups by); an `at` that does not parse counts as expired, one in the future is kept.
 */
export function retained(entries: readonly ActivityEvent[], nowMs: number): ActivityEvent[] {
  const cutoff = nowMs - RETENTION_MS;
  return entries.filter((e) => Date.parse(e.at) >= cutoff);
}

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

/** What needs a second look: a scan starting to fail, or a session that failed or exited non-zero. The feed's danger tone. */
export function needsAttention(event: ActivityEvent): boolean {
  return event.kind === "repo-failing" || (event.kind === "session-ended" && (event.error !== undefined || (event.exitCode ?? 0) !== 0));
}

/** The summary strip's figures (design D2): counted on recorded events, before task progress is collapsed. */
export function summarize(events: readonly ActivityEvent[]): ActivitySummary {
  const summary: ActivitySummary = { created: 0, moved: 0, archived: 0, tasksCompleted: 0, sessions: 0, attention: 0 };
  for (const event of events) {
    if (event.kind === "change-created") summary.created += 1;
    else if (event.kind === "change-moved") summary.moved += 1;
    else if (event.kind === "change-archived") summary.archived += 1;
    else if (event.kind === "tasks-progress") summary.tasksCompleted += Math.max(0, event.to.done - event.from.done);
    else if (event.kind === "session-started") summary.sessions += 1;
    if (needsAttention(event)) summary.attention += 1;
  }
  return summary;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dayFormats = new Map<string, Intl.DateTimeFormat>();

/** The formatter that names a calendar day in `timeZone`; throws a `RangeError` for a zone this runtime does not know. */
function dayFormat(timeZone: string): Intl.DateTimeFormat {
  let format = dayFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFormats.set(timeZone, format);
  }
  return format;
}

/** Whether `timeZone` names a zone the metrics can bucket days in. */
export function isTimeZone(timeZone: string): boolean {
  try {
    dayFormat(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** `YYYY-MM-DD` of the calendar day `ms` falls on in `timeZone`. */
export function dayIn(ms: number, timeZone: string): string {
  const parts = Object.fromEntries(dayFormat(timeZone).formatToParts(ms).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** The calendar day after `key`, stepped at noon UTC so no day is skipped or repeated (design D2). */
function nextDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12) + DAY_MS).toISOString().slice(0, 10);
}

/**
 * The per-day and per-project metrics (design D1–D3): counted on recorded events, before task progress is collapsed.
 * Days run from the one holding the start of the retention window to the one holding `nowMs`, in `timeZone`.
 */
export function measure(events: readonly ActivityEvent[], nowMs: number, timeZone = "UTC"): ActivityMetrics {
  const changeKey = (e: ActivityEvent) => ("change" in e ? `${e.repoId}\n${e.change}` : undefined);
  const days = new Map<string, { events: number; changes: Set<string> }>();
  const last = dayIn(nowMs, timeZone);
  for (let day = dayIn(nowMs - RETENTION_MS, timeZone); ; day = nextDay(day)) {
    days.set(day, { events: 0, changes: new Set() });
    if (day >= last) break;
  }
  const repos = new Map<string, { repoName: string; newestAt: string; events: number; changes: Set<string> }>();
  const changes = new Set<string>();
  for (const event of events) {
    const key = changeKey(event);
    if (key) changes.add(key);
    const at = Date.parse(event.at);
    const day = Number.isNaN(at) ? undefined : days.get(dayIn(at, timeZone));
    if (day) {
      day.events += 1;
      if (key) day.changes.add(key);
    }
    let repo = repos.get(event.repoId);
    if (!repo) {
      repo = { repoName: event.repoName, newestAt: event.at, events: 0, changes: new Set() };
      repos.set(event.repoId, repo);
    } else if (event.at >= repo.newestAt) {
      repo.repoName = event.repoName;
      repo.newestAt = event.at;
    }
    repo.events += 1;
    if (key) repo.changes.add(key);
  }
  const dayCounts: ActivityDayCount[] = [...days].map(([day, c]) => ({ day, events: c.events, changes: c.changes.size }));
  const repoCounts: ActivityRepoCount[] = [...repos]
    .map(([repoId, r]) => ({ repoId, repoName: r.repoName, events: r.events, changes: r.changes.size }))
    .sort((a, b) => b.events - a.events || a.repoName.localeCompare(b.repoName) || (a.repoId < b.repoId ? -1 : a.repoId > b.repoId ? 1 : 0));
  return { events: events.length, changes: changes.size, days: dayCounts, repos: repoCounts };
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
  /** IANA time zone the metrics' days are counted in; UTC when absent. */
  tz?: string;
}

/** One page of the feed out of everything recorded (`entries` in detection order, oldest first). */
export function pageEvents(entries: readonly ActivityEvent[], query: ActivityQuery = {}, nowMs = Date.now()): ActivityPage {
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
  // The figures do not depend on the page: only the first one carries them, older pages keep that answer.
  if (query.before === undefined) {
    page.summary = summarize(matching);
    page.metrics = measure(matching, nowMs, query.tz);
  }
  if (start + limit < feed.length && events.length > 0) page.nextBefore = events[events.length - 1].id;
  if (newestId) page.newestId = newestId;
  if (query.since !== undefined) {
    const since = query.since;
    page.newerThanSince = entries.filter((e) => e.id > since).length;
  }
  return page;
}
