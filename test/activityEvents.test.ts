import { expect, test } from "bun:test";
import { diffSnapshots, newEventId } from "../src/server/activity/events.ts";
import type { ChangeSnapshot, RepoSnapshot, Snapshot } from "../src/shared/types.ts";

const T0 = Date.parse("2026-09-21T09:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
const MIN = 60_000;

function change(name: string, column: string, patch: Partial<ChangeSnapshot> = {}): ChangeSnapshot {
  return { repoId: "r1", name, schema: "spec-driven", artifacts: [], tasks: null, stage: "artifact", column, ...patch };
}
function repo(id: string, name: string, changes: ChangeSnapshot[], patch: Partial<RepoSnapshot> = {}): RepoSnapshot {
  return { id, name, path: `/w/acme/${name}`, ok: true, scannedAt: iso(T0), isGit: true, worktrees: [], changes, ...patch };
}
const snap = (at: number, repos: RepoSnapshot[]): Snapshot => ({ generatedAt: iso(at), repos });
const diff = (previous: Snapshot, next: Snapshot, nowMs = Date.parse(next.generatedAt)) => diffSnapshots(previous, next, { now: new Date(nowMs), pollIntervalSeconds: 60 });
const brief = (events: ReturnType<typeof diff>) => events.map(({ v, id, at, detectedAt, repoId, catchUp, ...rest }) => rest);

test("a change that moves to another column", () => {
  const events = diff(snap(T0, [repo("r1", "demo-ops", [change("cache-api-calls", "Specs")])]), snap(T0 + MIN, [repo("r1", "demo-ops", [change("cache-api-calls", "Ready", { tasks: { done: 0, total: 7 } })])]));
  expect(brief(events)).toEqual([{ kind: "change-moved", repoName: "demo-ops", change: "cache-api-calls", from: "Specs", to: "Ready", tasks: { done: 0, total: 7 } }]);
  expect(events[0]).toMatchObject({ v: 1, repoId: "r1" });
});

test("task progress within a column; moved and progressed at once is one move", () => {
  const before = snap(T0, [repo("r1", "demo-ops", [change("a", "Implementing", { tasks: { done: 3, total: 12 } }), change("b", "Ready", { tasks: { done: 0, total: 7 } })])]);
  const after = snap(T0 + MIN, [repo("r1", "demo-ops", [change("a", "Implementing", { tasks: { done: 7, total: 12 } }), change("b", "Implementing", { tasks: { done: 2, total: 7 } })])]);
  expect(brief(diff(before, after))).toEqual([
    { kind: "tasks-progress", repoName: "demo-ops", change: "a", column: "Implementing", from: { done: 3, total: 12 }, to: { done: 7, total: 12 } },
    { kind: "change-moved", repoName: "demo-ops", change: "b", from: "Ready", to: "Implementing", tasks: { done: 2, total: 7 } },
  ]);
});

test("created, archived and removed", () => {
  const before = snap(T0, [repo("r1", "demo-ops", [change("bump-toolchain", "Done"), change("old-idea", "Proposal")])]);
  const after = snap(T0 + MIN, [repo("r1", "demo-ops", [change("add-login", "Proposal"), change("bump-toolchain", "Archived", { archived: "2026-09-21", stage: "archived" })])]);
  expect(brief(diff(before, after))).toEqual([
    { kind: "change-created", repoName: "demo-ops", change: "add-login", to: "Proposal" },
    { kind: "change-archived", repoName: "demo-ops", change: "bump-toolchain", from: "Done" },
    { kind: "change-removed", repoName: "demo-ops", change: "old-idea", from: "Proposal" },
  ]);
});

test("nothing changed, nothing recorded", () => {
  const repos = [repo("r1", "demo-ops", [change("a", "Ready", { tasks: { done: 0, total: 3 } }), change("z", "Archived", { archived: "2026-01-01" })])];
  expect(diff(snap(T0, repos), snap(T0 + MIN, structuredClone(repos)))).toEqual([]);
});

test("first sight of a repository is a baseline: one tracked event, none per change", () => {
  const many = Array.from({ length: 40 }, (_, i) => change(`c${i}`, i % 2 ? "Ready" : "Archived", i % 2 ? {} : { archived: "2026-09-20" }));
  const first = diff(snap(T0, []), snap(T0 + MIN, [repo("r1", "demo-ops", many), repo("r2", "beta-soc", [change("x", "Proposal")])]));
  expect(brief(first)).toEqual([
    { kind: "repo-tracked", repoName: "demo-ops", openChanges: 20 },
    { kind: "repo-tracked", repoName: "beta-soc", openChanges: 1 },
  ]);
  // enabling one more repository later behaves the same, and the known one is compared normally
  const later = diff(snap(T0, [repo("r1", "demo-ops", [change("a", "Specs")])]), snap(T0 + MIN, [repo("r1", "demo-ops", [change("a", "Ready")]), repo("r2", "beta-soc", many)]));
  expect(brief(later).map((e) => e.kind)).toEqual(["change-moved", "repo-tracked"]);
});

test("a repository that is no longer tracked", () => {
  expect(brief(diff(snap(T0, [repo("r1", "demo-ops", [change("a", "Ready")])]), snap(T0 + MIN, [])))).toEqual([{ kind: "repo-untracked", repoName: "demo-ops" }]);
});

test("a failing scan is not activity: failing, silence, recovered, then comparison resumes", () => {
  const healthy = repo("r1", "demo-ops", [change("a", "Specs")]);
  const failing = repo("r1", "demo-ops", [change("a", "Specs")], { ok: false, error: "timed out" });
  expect(brief(diff(snap(T0, [healthy]), snap(T0 + MIN, [failing])))).toEqual([{ kind: "repo-failing", repoName: "demo-ops", error: "timed out" }]);
  expect(diff(snap(T0, [failing]), snap(T0 + MIN, [failing]))).toEqual([]);
  // recovering with different changes reports only the recovery; the next scan compares again
  const recovered = repo("r1", "demo-ops", [change("a", "Ready"), change("b", "Proposal")]);
  expect(brief(diff(snap(T0, [failing]), snap(T0 + MIN, [recovered])))).toEqual([{ kind: "repo-recovered", repoName: "demo-ops" }]);
  expect(brief(diff(snap(T0, [recovered]), snap(T0 + MIN, [repo("r1", "demo-ops", [change("a", "Implementing"), change("b", "Proposal")])]))).map((e) => e.kind)).toEqual(["change-moved"]);
});

test("archives never seen before count only when recent", () => {
  const before = snap(T0, [repo("r1", "demo-ops", [])]);
  const after = snap(T0 + MIN, [repo("r1", "demo-ops", [change("months-old", "Archived", { archived: "2026-03-02" }), change("last-week", "Archived", { archived: "2026-09-18" })])]);
  expect(brief(diff(before, after))).toEqual([{ kind: "change-archived", repoName: "demo-ops", change: "last-week" }]);
});

test("event time: the change's last activity when it lies between the snapshots, otherwise detection time", () => {
  const before = snap(T0, [repo("r1", "demo-ops", [change("inside", "Specs"), change("stale", "Specs"), change("future", "Specs")])]);
  const after = snap(T0 + 5 * MIN, [
    repo("r1", "demo-ops", [
      change("inside", "Ready", { lastActivityAt: iso(T0 + 2 * MIN) }),
      change("stale", "Ready", { lastActivityAt: iso(T0 - 60 * MIN) }),
      change("future", "Ready", { lastActivityAt: iso(T0 + 50 * MIN) }),
    ]),
  ]);
  const events = diff(before, after);
  expect(events.map((e) => e.at)).toEqual([iso(T0 + 2 * MIN), iso(T0 + 5 * MIN), iso(T0 + 5 * MIN)]);
  expect(new Set(events.map((e) => e.detectedAt))).toEqual(new Set([iso(T0 + 5 * MIN)]));
});

test("catch-up: marked when the snapshots are further apart than three poll intervals", () => {
  const before = [repo("r1", "demo-ops", [change("add-login", "Done")])];
  const archived = [repo("r1", "demo-ops", [change("add-login", "Archived", { archived: "2026-09-19", lastActivityAt: "2026-09-19T14:02:00.000Z" })])];
  const friday = Date.parse("2026-09-18T17:00:00.000Z");
  const [weekend] = diff(snap(friday, before), snap(T0, archived));
  expect(weekend).toMatchObject({ kind: "change-archived", catchUp: true, at: "2026-09-19T14:02:00.000Z" });
  const [regular] = diff(snap(T0 - MIN, before), snap(T0, archived));
  expect(regular.catchUp).toBeUndefined();
});

test("ids are unique and sort in the order they were created, also within one millisecond", () => {
  const ids = Array.from({ length: 500 }, () => newEventId(T0));
  expect(new Set(ids).size).toBe(500);
  expect([...ids].sort()).toEqual(ids);
  expect(newEventId(T0 + 1) > ids[ids.length - 1]).toBe(true);
  const events = diff(snap(T0, [repo("r1", "demo-ops", [change("a", "Specs"), change("b", "Specs")])]), snap(T0 + MIN, [repo("r1", "demo-ops", [change("a", "Ready"), change("b", "Ready")])]));
  expect(events[0].id < events[1].id).toBe(true);
});
