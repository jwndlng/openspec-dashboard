import { expect, test } from "bun:test";
import { CHANGELOG, type ChangelogEntry } from "../src/ui/changelog.ts";
import { groupByMonth, loadSeenIds, saveSeenIds, unseenIds, WHATS_NEW_SEEN_KEY } from "../src/ui/whatsNewState.ts";

const entry = (date: string, slug: string): ChangelogEntry => ({ id: `${date}-${slug}`, date, title: slug, summary: `About ${slug}.` });
const memory = (data: Record<string, string> = {}) => ({
  data,
  getItem: (key: string) => data[key] ?? null,
  setItem: (key: string, value: string) => {
    data[key] = value;
  },
});
const throwing = {
  getItem: (): string | null => {
    throw new Error("refused");
  },
  setItem: () => {
    throw new Error("refused");
  },
};

const older = [entry("2026-09-24", "repository-cleanup"), entry("2026-09-20", "activity")];
const newer = [entry("2026-10-02", "project-labels"), entry("2026-10-01", "new-project"), entry("2026-09-30", "pull-requests"), ...older];

test("first visit: nothing remembered counts every entry as seen", () => {
  const store = memory();
  const seen = loadSeenIds(store);
  expect(seen).toBeUndefined();
  expect(unseenIds(newer, seen)).toEqual([]);
});

test("entries added after the user saw the list are counted, in changelog order", () => {
  const store = memory();
  saveSeenIds(older.map((e) => e.id), older, store);
  expect(unseenIds(newer, loadSeenIds(store))).toEqual(["2026-10-02-project-labels", "2026-10-01-new-project", "2026-09-30-pull-requests"]);
  saveSeenIds(newer.map((e) => e.id), newer, store);
  expect(unseenIds(newer, loadSeenIds(store))).toEqual([]);
});

test("removing a seen entry changes nothing and makes no other entry unseen", () => {
  const store = memory();
  saveSeenIds(newer.map((e) => e.id), newer, store);
  const without = newer.filter((e) => e.id !== "2026-10-01-new-project");
  expect(unseenIds(without, loadSeenIds(store))).toEqual([]);
});

test("a malformed or refused storage is 'nothing remembered' without an error", () => {
  for (const raw of ["not json", "{}", '["a", 1]', "null"]) expect(loadSeenIds(memory({ [WHATS_NEW_SEEN_KEY]: raw }))).toBeUndefined();
  expect(loadSeenIds(memory({ [WHATS_NEW_SEEN_KEY]: "[]" }))).toEqual(new Set());
  expect(loadSeenIds(throwing)).toBeUndefined();
  expect(unseenIds(newer, loadSeenIds(throwing))).toEqual([]);
  expect(() => saveSeenIds(["x"], newer, throwing)).not.toThrow();
});

test("saving prunes ids that are no longer in the changelog", () => {
  const store = memory();
  saveSeenIds(["2025-01-01-gone", ...older.map((e) => e.id)], older, store);
  expect(JSON.parse(store.data[WHATS_NEW_SEEN_KEY] ?? "")).toEqual(older.map((e) => e.id));
});

test("months group by the entry's calendar date, across a year boundary", () => {
  const entries = [entry("2027-01-01", "new-year"), entry("2026-12-31", "last-day"), entry("2026-12-01", "first-of-december"), entry("2026-11-30", "november")];
  const months = groupByMonth(entries, "en-US");
  expect(months.map((m) => m.label)).toEqual(["January 2027", "December 2026", "November 2026"]);
  expect(months.map((m) => m.entries.map((e) => e.id.slice(11)))).toEqual([["new-year"], ["last-day", "first-of-december"], ["november"]]);
  expect(groupByMonth([entry("2026-10-02", "project-labels"), entry("2026-09-24", "repository-cleanup")], "en-US").map((m) => m.label)).toEqual(["October 2026", "September 2026"]);
});

// ---- the changelog itself ----

const ID = /^(\d{4}-\d{2}-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const validDate = (date: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const at = new Date(Date.UTC(y, mo - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === mo - 1 && at.getUTCDate() === d;
};

/** Every problem with the list, each naming the entry it is about. */
function changelogProblems(entries: readonly ChangelogEntry[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  entries.forEach((e, i) => {
    if (ids.has(e.id)) problems.push(`${e.id}: duplicate id`);
    ids.add(e.id);
    if (!validDate(e.date)) problems.push(`${e.id}: invalid date ${e.date}`);
    const m = ID.exec(e.id);
    if (!m) problems.push(`${e.id}: id is not <YYYY-MM-DD>-<kebab-case-slug>`);
    else if (m[1] !== e.date) problems.push(`${e.id}: id does not start with the entry's date ${e.date}`);
    if (!e.title.trim()) problems.push(`${e.id}: empty title`);
    if (!e.summary.trim()) problems.push(`${e.id}: empty summary`);
    const previous = entries[i - 1];
    if (previous && e.date > previous.date) problems.push(`${e.id}: dated after ${previous.id} above it — the list is newest first`);
  });
  return problems;
}

test("the changelog is well-formed: unique ids of its own date, valid dates, newest first, title and summary", () => {
  expect(CHANGELOG.length).toBeGreaterThan(0);
  expect(changelogProblems(CHANGELOG)).toEqual([]);
});

test("the checks name the offending entry", () => {
  const ok = entry("2026-10-01", "a");
  expect(changelogProblems([ok, ok])).toEqual(["2026-10-01-a: duplicate id"]);
  expect(changelogProblems([entry("2026-09-01", "early"), entry("2026-10-01", "late")])).toEqual(["2026-10-01-late: dated after 2026-09-01-early above it — the list is newest first"]);
  expect(changelogProblems([{ ...entry("2026-02-30", "x") }])).toContain("2026-02-30-x: invalid date 2026-02-30");
  expect(changelogProblems([{ ...ok, id: "2026-10-01-Bad_Slug" }])).toEqual(["2026-10-01-Bad_Slug: id is not <YYYY-MM-DD>-<kebab-case-slug>"]);
  expect(changelogProblems([{ ...ok, date: "2026-10-02" }])).toEqual(["2026-10-01-a: id does not start with the entry's date 2026-10-02"]);
  expect(changelogProblems([{ ...ok, title: " ", summary: "" }])).toEqual(["2026-10-01-a: empty title", "2026-10-01-a: empty summary"]);
});
