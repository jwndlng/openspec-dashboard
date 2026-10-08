import { expect, test } from "bun:test";
import { needsAttention, pageEvents } from "../src/shared/activity.ts";
import type { ActivityEvent } from "../src/shared/types.ts";
import { collapseDay, DAY_SHOWN, describe, groupByDay, isBusyDay, kindsFor, parseActivityFilters, serializeActivityFilters, timeOfDay, tone, unseenLabel, visibleFigures } from "../src/ui/activityState.ts";

let n = 0;
const base = (at: Date) => ({ v: 1 as const, id: `id${String(n++).padStart(4, "0")}`, at: at.toISOString(), detectedAt: at.toISOString(), repoId: "r1", repoName: "demo-ops" });
const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

test("filters round-trip through the URL; unknown groups are dropped; order is stable", () => {
  expect(parseActivityFilters("")).toEqual({ repos: [], groups: [] });
  expect(parseActivityFilters("?repos=a,b&show=sessions,nonsense,changes")).toEqual({ repos: ["a", "b"], groups: ["sessions", "changes"] });
  expect(serializeActivityFilters({ repos: ["a", "b"], groups: ["sessions", "changes"] })).toBe("?repos=a,b&show=changes,sessions");
  expect(serializeActivityFilters({ repos: [], groups: [] })).toBe("");
  expect(parseActivityFilters(serializeActivityFilters({ repos: ["x"], groups: ["tasks"] }))).toEqual({ repos: ["x"], groups: ["tasks"] });
});

test("groups map to the kinds the API filters by", () => {
  expect(kindsFor([])).toEqual([]);
  expect(kindsFor(["tasks"])).toEqual(["tasks-progress"]);
  expect(kindsFor(["sessions", "repositories"])).toEqual([
    "session-started",
    "session-ended",
    "session-shipped",
    "session-conflicts-resolve",
    "session-auto-ended",
    "repo-tracked",
    "repo-untracked",
    "repo-failing",
    "repo-recovered",
  ]);
});

test("events are grouped under local days: Today, Yesterday, then dates", () => {
  const now = local(2026, 9, 21, 15);
  const events: ActivityEvent[] = [
    { ...base(local(2026, 9, 21, 9, 5)), kind: "change-moved", change: "a", from: "Specs", to: "Ready" },
    { ...base(local(2026, 9, 21, 0, 1)), kind: "repo-recovered" },
    { ...base(local(2026, 9, 20, 23, 59)), kind: "change-archived", change: "b", from: "Done" },
    { ...base(local(2026, 9, 12, 8)), kind: "repo-untracked" },
  ];
  const days = groupByDay(events, now);
  expect(days.map((d) => [d.label === "Today" || d.label === "Yesterday" ? d.label : "date", d.events.length])).toEqual([["Today", 2], ["Yesterday", 1], ["date", 1]]);
  expect(days[2].label).toContain("2026");
  expect(timeOfDay(events[0].at)).toBe("09:05");
  expect(groupByDay([], now)).toEqual([]);
});

test("every kind has wording, and what needs a look stands out", () => {
  const at = local(2026, 9, 21);
  const cases: [ActivityEvent, string, string][] = [
    [{ ...base(at), kind: "change-created", change: "a", to: "Proposal" }, "created in Proposal", "normal"],
    [{ ...base(at), kind: "change-moved", change: "a", from: "Ready", to: "Implementing", tasks: { done: 2, total: 7 } }, "moved Ready → Implementing · 2/7", "normal"],
    [{ ...base(at), kind: "tasks-progress", change: "a", column: "Implementing", from: { done: 3, total: 12 }, to: { done: 7, total: 12 } }, "tasks 3/12 → 7/12", "quiet"],
    [{ ...base(at), kind: "change-archived", change: "a", from: "Synced" }, "archived from Synced", "ok"],
    [{ ...base(at), kind: "change-archived", change: "a" }, "archived", "ok"],
    [{ ...base(at), kind: "change-removed", change: "a", from: "Proposal" }, "removed (was in Proposal)", "normal"],
    [{ ...base(at), kind: "repo-tracked", openChanges: 1 }, "now tracked · 1 open change", "quiet"],
    [{ ...base(at), kind: "repo-tracked", openChanges: 12 }, "now tracked · 12 open changes", "quiet"],
    [{ ...base(at), kind: "repo-untracked" }, "no longer tracked", "quiet"],
    [{ ...base(at), kind: "repo-failing", error: "timed out" }, "scan failing: timed out", "danger"],
    [{ ...base(at), kind: "repo-recovered" }, "scan recovered", "ok"],
    [{ ...base(at), kind: "session-started", change: "a", action: "implement", agentName: "Fake Agent" }, "session started: implement with Fake Agent", "normal"],
    [{ ...base(at), kind: "session-started", change: "a", action: "implement", agentName: "Fake Agent", resumed: true }, "session resumed: implement with Fake Agent", "normal"],
    [{ ...base(at), kind: "session-ended", change: "a", exitCode: 0 }, "session ended", "normal"],
    [{ ...base(at), kind: "session-ended", change: "a", exitCode: 1 }, "session ended (exit 1)", "danger"],
    [{ ...base(at), kind: "session-ended", change: "a", error: "could not start the agent" }, "session failed: could not start the agent", "danger"],
    [{ ...base(at), kind: "session-shipped", change: "a" }, "ship requested", "normal"],
    [{ ...base(at), kind: "session-shipped", change: "a", submitted: false }, "ship requested — typed, not sent", "normal"],
    // What was handed over, never what came of it: the outcome is re-read from git.
    [{ ...base(at), kind: "session-conflicts-resolve", change: "a" }, "conflict resolution requested", "normal"],
    [{ ...base(at), kind: "session-conflicts-resolve", change: "a", submitted: false }, "conflict resolution requested — typed, not sent", "normal"],
  ];
  for (const [event, words, weight] of cases) {
    expect(describe(event)).toBe(words);
    expect(tone(event)).toBe(weight as ReturnType<typeof tone>);
    // The summary's "need attention" counts exactly what the feed shows in red.
    expect(needsAttention(event)).toBe(weight === "danger");
  }
});

test("the unseen number: nothing for none, capped at 99+", () => {
  expect(unseenLabel(undefined)).toBe("");
  expect(unseenLabel(0)).toBe("");
  expect(unseenLabel(5)).toBe("5");
  expect(unseenLabel(99)).toBe("99");
  expect(unseenLabel(100)).toBe("99+");
});

test("what is newer than the last seen event is what the server counts", () => {
  const at = local(2026, 9, 21);
  const events: ActivityEvent[] = Array.from({ length: 8 }, () => ({ ...base(at), kind: "repo-recovered" as const }));
  expect(pageEvents(events, { limit: 1, since: events[2].id }).newerThanSince).toBe(5);
  expect(pageEvents(events, { limit: 1, since: events[7].id }).newerThanSince).toBe(0);
});

test("summary figures follow the kind filter", () => {
  const keys = (groups: Parameters<typeof visibleFigures>[0]) => visibleFigures(groups).map((f) => f.key);
  expect(keys([])).toEqual(["created", "moved", "archived", "tasksCompleted", "sessions", "attention"]);
  expect(keys(["sessions"])).toEqual(["sessions", "attention"]);
  expect(keys(["tasks"])).toEqual(["tasksCompleted"]);
  expect(keys(["repositories"])).toEqual(["attention"]);
  expect(keys(["changes", "tasks"])).toEqual(["created", "moved", "archived", "tasksCompleted"]);
});

test("a busy day shows its newest entries until expanded; a quiet day is never collapsed", () => {
  const day = (n: number) => ({
    key: "2026-09-21",
    label: "Today",
    events: Array.from({ length: n }, (_, i) => ({ v: 1, id: `e${String(n - i).padStart(4, "0")}`, at: "2026-09-21T09:00:00.000Z", detectedAt: "2026-09-21T09:00:00.000Z", repoId: "r1", repoName: "demo-ops", kind: "repo-recovered" }) as ActivityEvent),
  });
  const busy = day(140);
  const collapsed = collapseDay(busy, false);
  expect(collapsed.shown).toEqual(busy.events.slice(0, DAY_SHOWN));
  expect(collapsed.hidden).toBe(120);
  expect(collapseDay(busy, true)).toEqual({ shown: busy.events, hidden: 0 });
  expect(collapseDay(day(31), false).hidden).toBe(11);
  expect(collapseDay(day(30), false)).toEqual({ shown: day(30).events, hidden: 0 });
  expect(isBusyDay(day(30))).toBe(false);
  expect(isBusyDay(day(31))).toBe(true);
});
