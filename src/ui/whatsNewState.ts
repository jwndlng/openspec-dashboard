// What's new: which changelog entries this browser has seen, and the dialog's month grouping. Free of DOM access at
// import time; the storage helpers tolerate a browser that refuses localStorage (no count, the dialog still works).
import type { ChangelogEntry } from "./changelog.ts";
import { storageKey } from "./storage.ts";

export const WHATS_NEW_SEEN_KEY = storageKey("whats-new.seen");

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

/** The ids this browser has seen, or undefined when nothing is remembered: first visit, malformed value or no storage. */
export function loadSeenIds(storage?: KeyValueStore): Set<string> | undefined {
  try {
    const raw = (storage ?? localStorage).getItem(WHATS_NEW_SEEN_KEY);
    if (raw === null) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string")) return undefined;
    return new Set(parsed);
  } catch {
    return undefined;
  }
}

/** Remembers `seen`, pruned to the ids still in `entries`, so the list never outgrows the changelog. */
export function saveSeenIds(seen: Iterable<string>, entries: readonly ChangelogEntry[], storage?: KeyValueStore): void {
  const kept = new Set(seen);
  try {
    (storage ?? localStorage).setItem(WHATS_NEW_SEEN_KEY, JSON.stringify(entries.map((e) => e.id).filter((id) => kept.has(id))));
  } catch {
    // Storage unavailable: no unseen count, the dialog itself works.
  }
}

/** Ids not seen yet, in changelog order. Nothing remembered counts as having seen everything (first-visit baseline). */
export function unseenIds(entries: readonly ChangelogEntry[], seen: ReadonlySet<string> | undefined): string[] {
  if (!seen) return [];
  return entries.filter((e) => !seen.has(e.id)).map((e) => e.id);
}

/** The local calendar date of a `YYYY-MM-DD` string — never parsed as UTC, so it cannot slip a day. */
export function calendarDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

export interface ChangelogMonth {
  key: string;
  label: string;
  entries: ChangelogEntry[];
}

/** Groups entries (newest first) under month headings such as "October 2026". */
export function groupByMonth(entries: readonly ChangelogEntry[], locale?: string): ChangelogMonth[] {
  const months: ChangelogMonth[] = [];
  for (const entry of entries) {
    const key = entry.date.slice(0, 7);
    let month = months[months.length - 1];
    if (!month || month.key !== key) {
      month = { key, label: calendarDate(entry.date).toLocaleDateString(locale, { year: "numeric", month: "long" }), entries: [] };
      months.push(month);
    }
    month.entries.push(entry);
  }
  return months;
}

export function formatEntryDate(date: string, locale?: string): string {
  return calendarDate(date).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}
