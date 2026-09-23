import { expect, test } from "bun:test";
import type { Session, SessionWorktree, WorkStatus } from "../src/shared/types.ts";
import { endSeverity, hideSession, pullOffer, searchWithShown, showSession, shownFromSearch, endWarning, nextStepFor, openWork, sessionsForChange, sessionTabs, staleAge, workBadge, worktreeForChange, worktreeOfSession, worktreeRemovalPossible } from "../src/ui/sessionState.ts";

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
  // Everything short of merged is work in a branch, so it wears one role; merged is the one finished state.
  expect(workBadge(wt("a", { state: "uncommitted", count: 3 }), [], NOW)).toMatchObject({ label: "✎ 3 uncommitted", tone: "branch" });
  expect(workBadge(wt("a", { state: "unpushed", count: 1 }), [], NOW)).toMatchObject({ tone: "branch" });
  expect(workBadge(wt("a", { state: "unpushed", count: 1 }), [], NOW)?.title).toContain("1 commit exist");
  expect(workBadge(wt("a", { state: "pushed", base: "origin/main" }), [], NOW)).toMatchObject({ label: "⇡ pushed", tone: "branch" });
  expect(workBadge(wt("a", { state: "merged", base: "origin/main" }), [], NOW)).toMatchObject({ label: "✓ merged", tone: "success" });
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
  // A pushed branch may simply be waiting for review, so going stale only warns.
  expect(workBadge(wt("a", { state: "pushed" }, 8 * 24), [], NOW)).toMatchObject({ label: "⇡ pushed · 8d", tone: "warning" });
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
  expect(sessionTabs(list, []).map((s) => s.id)).toEqual(["a", "bbb"]);
  expect(sessionTabs(list, ["cc"]).map((s) => s.id)).toEqual(["a", "cc", "bbb"]);
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

test("the pull is offered for a repository it can run in, and starts ticked only for merged work", () => {
  const git = { isGit: true, ok: true };
  expect(pullOffer(git, { state: "merged" })).toEqual({ offered: true, preselected: true });
  // offered, but the user has to ask for it: the work is not known to have landed
  for (const state of ["uncommitted", "unpushed", "pushed", "clean", "missing"] as const) {
    expect(pullOffer(git, { state })).toEqual({ offered: true, preselected: false });
  }
  expect(pullOffer(git, undefined)).toEqual({ offered: true, preselected: false });
  // nothing the pull action can run in
  expect(pullOffer({ isGit: false, ok: true }, { state: "merged" })).toEqual({ offered: false, preselected: false });
  expect(pullOffer({ isGit: true, ok: false }, { state: "merged" })).toEqual({ offered: false, preselected: false });
  expect(pullOffer(undefined, { state: "merged" })).toEqual({ offered: false, preselected: false });
});

test("the dock shows at most three sessions: a fourth replaces the focused pane, shown ones are only focused", () => {
  let state = showSession({ shown: [] }, "a");
  state = showSession(state, "b");
  state = showSession(state, "c");
  expect(state).toEqual({ shown: ["a", "b", "c"], focusedId: "c" });
  expect(showSession(state, "a")).toEqual({ shown: ["a", "b", "c"], focusedId: "a" }); // already shown: focus only
  expect(showSession({ ...state, focusedId: "b" }, "d")).toEqual({ shown: ["a", "d", "c"], focusedId: "d" }); // the others stay put
  expect(showSession({ shown: ["a", "b", "c"] }, "d").shown).toEqual(["a", "b", "d"]); // nobody focused: the last pane
  expect(showSession({ shown: ["a", "b", "c"], focusedId: "gone" }, "d").shown).toEqual(["a", "b", "d"]);
});

test("closing a pane moves the keyboard to its neighbour and never touches the others", () => {
  expect(hideSession({ shown: ["a", "b", "c"], focusedId: "b" }, "b")).toEqual({ shown: ["a", "c"], focusedId: "c" });
  expect(hideSession({ shown: ["a", "b"], focusedId: "b" }, "b")).toEqual({ shown: ["a"], focusedId: "a" });
  expect(hideSession({ shown: ["a"], focusedId: "a" }, "a")).toEqual({ shown: [], focusedId: undefined });
  expect(hideSession({ shown: ["a", "b"], focusedId: "a" }, "b")).toEqual({ shown: ["a"], focusedId: "a" });
  expect(hideSession({ shown: ["a"], focusedId: "a" }, "zz")).toEqual({ shown: ["a"], focusedId: "a" });
});

test("the URL carries the shown sessions in pane order, at most three, and keeps other parameters", () => {
  expect(shownFromSearch("?session=a,b,c,d&q=x")).toEqual(["a", "b", "c"]);
  expect(shownFromSearch("?session=a,,a, b")).toEqual(["a", "b"]);
  expect(shownFromSearch("?q=x")).toEqual([]);
  expect(searchWithShown("?q=x", ["a", "b"])).toBe("?q=x&session=a,b");
  expect(searchWithShown("?session=a,b&q=x", ["b"])).toBe("?session=b&q=x");
  expect(shownFromSearch(searchWithShown("", ["a", "b", "c"]))).toEqual(["a", "b", "c"]);
});

test("a session in a folder without git has no worktree, so no work status, no Ship and nothing to remove", () => {
  const worktrees = [wt("upgrade-runtime", { state: "uncommitted", count: 2 })];
  const inRepo = { inPlace: true, worktreePath: "/w/acme/demo-ops" } as Session;
  const inWorktree = { worktreePath: worktrees[0].path } as Session;

  // The in-place session's directory is the repository itself; it must never be matched against a worktree.
  expect(worktreeOfSession(inWorktree, worktrees)).toBe(worktrees[0]);
  expect(worktreeOfSession(inRepo, worktrees)).toBeUndefined();
  expect(worktreeOfSession(undefined, worktrees)).toBeUndefined();

  expect(worktreeRemovalPossible(inWorktree)).toBe(true);
  expect(worktreeRemovalPossible(inRepo)).toBe(false);
  expect(worktreeRemovalPossible(undefined)).toBe(false);

  // Ending it offers no pull either: the pull action only runs in a git repository.
  expect(pullOffer({ isGit: false, ok: true }, undefined)).toEqual({ offered: false, preselected: false });
  expect(pullOffer({ isGit: true, ok: true }, { state: "merged" })).toEqual({ offered: true, preselected: true });
});
