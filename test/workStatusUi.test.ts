import { expect, test } from "bun:test";
import type { Session, SessionWorktree, WorkStatus } from "../src/shared/types.ts";
import { openWork, staleAge, workBadge, worktreeForChange } from "../src/ui/sessionState.ts";

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
