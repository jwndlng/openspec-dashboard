import { expect, test } from "bun:test";
import type { Session, SessionWorktree, WorkStatus } from "../src/shared/types.ts";
import { endSeverity, endWarning, nextStepFor, openWork, sessionsForChange, sessionTabs, staleAge, workBadge, worktreeForChange } from "../src/ui/sessionState.ts";

const NOW = Date.parse("2026-09-21T12:00:00Z");
const ago = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();

const wt = (name: string, work: WorkStatus, hours = 1, patch: Partial<SessionWorktree> = {}): SessionWorktree => ({
  repoId: "r",
  name,
  path: `/home/demo/.openspec-dashboard/worktrees/r/${name}`,
  change: name.replace(/^archive-/, ""),
  action: name.startsWith("archive-") ? "archive" : "implement",
  branch: `feat/${name}`,
  work,
  lastActivityAt: ago(hours),
  ...patch,
});
const running = (id: string) => ({ id, state: "running" }) as Session;

test("badges say what is left to do, in words", () => {
  expect(workBadge(wt("a", { state: "uncommitted", count: 3 }), [], NOW)).toMatchObject({ label: "✎ 3 uncommitted", tone: "warn" });
  expect(workBadge(wt("a", { state: "unpushed", count: 1 }), [], NOW)?.title).toContain("1 commit exist");
  expect(workBadge(wt("a", { state: "pushed", base: "origin/main" }), [], NOW)).toMatchObject({ label: "⇡ pushed", tone: "brand" });
  expect(workBadge(wt("a", { state: "merged", base: "origin/main" }), [], NOW)?.title).toContain("as of your last fetch");
  expect(workBadge(wt("a", { state: "clean" }), [], NOW)).toBeUndefined();
  expect(workBadge(wt("a", { state: "missing" }), [], NOW)).toBeUndefined();
});

test("open work goes stale after a day, pushed work after a week, and never while its session runs", () => {
  expect(staleAge(wt("a", { state: "unpushed", count: 2 }, 23), [], NOW)).toBeUndefined();
  expect(staleAge(wt("a", { state: "unpushed", count: 2 }, 30), [], NOW)).toBe("30h");
  expect(workBadge(wt("a", { state: "uncommitted", count: 2 }, 72), [], NOW)).toMatchObject({ label: "✎ 2 uncommitted · 3d", tone: "danger" });
  expect(staleAge(wt("a", { state: "pushed" }, 72), [], NOW)).toBeUndefined();
  expect(staleAge(wt("a", { state: "pushed" }, 8 * 24), [], NOW)).toBe("8d");
  expect(staleAge(wt("a", { state: "merged" }, 900), [], NOW)).toBeUndefined();
  expect(staleAge(wt("a", { state: "unpushed", count: 1 }, 72, { sessionId: "s1" }), [running("s1")], NOW)).toBeUndefined();
});

test("a card shows its change's open work first, its merged worktree otherwise, and nothing for clean ones", () => {
  const list = [wt("add-x", { state: "merged" }), wt("archive-add-x", { state: "unpushed", count: 1 }), wt("other", { state: "uncommitted", count: 1 }), wt("idle", { state: "clean" })];
  expect(worktreeForChange(list, "r", "add-x")?.name).toBe("archive-add-x");
  expect(worktreeForChange([list[0]], "r", "add-x")?.name).toBe("add-x");
  expect(worktreeForChange(list, "r", "idle")).toBeUndefined();
  expect(worktreeForChange(list, "elsewhere", "add-x")).toBeUndefined();
});

test("the open work list counts what is unshipped and puts stale work first, merged last", () => {
  const list = [wt("merged", { state: "merged" }, 500), wt("fresh", { state: "uncommitted", count: 1 }, 2), wt("clean", { state: "clean" }), wt("old", { state: "unpushed", count: 4 }, 100)];
  const { items, unshipped } = openWork(list, [], NOW);
  expect(items.map((w) => w.name)).toEqual(["old", "fresh", "merged"]);
  expect(unshipped).toBe(2);
});

const sess = (id: string, patch: Partial<Session> = {}): Session => ({ id, repoId: "r", change: "add-x", action: "implement", agentId: "a", agentName: "A", state: "running", worktreePath: `/w/${id}`, branch: "feat/add-x", createdAt: `2026-09-21T10:0${id.length}:00Z`, updatedAt: "", resumable: true, ...patch });

test("a starter goes into the change's running session; archive always gets its own", () => {
  const draft = sess("d", { action: "draft" });
  expect(nextStepFor([draft], "r", "add-x", "implement")).toEqual({ promptSessionId: "d" });
  expect(nextStepFor([draft], "r", "add-x", "archive")).toEqual({ blocked: false });
  expect(nextStepFor([sess("d", { state: "exited" })], "r", "add-x", "implement")).toEqual({ promptSessionId: undefined });
  const arch = sess("ar", { action: "archive" });
  expect(nextStepFor([arch], "r", "add-x", "implement")).toEqual({ promptSessionId: undefined }); // never typed into an archive session
  expect(nextStepFor([arch], "r", "add-x", "archive")).toEqual({ blocked: true });
  expect(nextStepFor([draft], "r", "other", "implement")).toEqual({ promptSessionId: undefined });
});

test("a card shows every running session, else the latest one that went wrong", () => {
  const a = sess("a");
  const arch = sess("arc", { action: "archive" });
  expect(sessionsForChange([a, arch, sess("x", { change: "other" })], "r", "add-x").map((s) => s.id).sort()).toEqual(["a", "arc"]);
  expect(sessionsForChange([sess("a", { state: "exited", exitCode: 0 })], "r", "add-x")).toEqual([]);
  expect(sessionsForChange([sess("a", { state: "exited", exitCode: 2 })], "r", "add-x").map((s) => s.id)).toEqual(["a"]);
});

test("tabs: running sessions oldest first, plus the one shown if it has ended", () => {
  const list = [sess("bbb"), sess("a"), sess("cc", { state: "exited" }), sess("dddd", { state: "exited" })];
  expect(sessionTabs(list, undefined).map((s) => s.id)).toEqual(["a", "bbb"]);
  expect(sessionTabs(list, "cc").map((s) => s.id)).toEqual(["a", "cc", "bbb"]);
});

test("ending is questioned as loudly as the work is unshipped", () => {
  expect(endSeverity({ state: "uncommitted" })).toBe("danger");
  expect(endSeverity({ state: "unpushed" })).toBe("danger");
  expect(endSeverity({ state: "pushed" })).toBe("notice");
  for (const state of ["clean", "merged", "missing"] as const) expect(endSeverity({ state })).toBe("plain");
  expect(endSeverity(undefined)).toBe("plain");
  expect(endWarning({ state: "uncommitted", count: 3 })).toContain("3 uncommitted files exist only in this worktree");
  expect(endWarning({ state: "unpushed", count: 1 })).toContain("1 commit exists only on this machine");
  expect(endWarning({ state: "clean" })).toBeUndefined();
});
