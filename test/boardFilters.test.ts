import { expect, test } from "bun:test";
import type { ChangeSnapshot, PullRequest, PullRequestsResponse, RepoSnapshot, SessionWorktree, WorkStatus } from "../src/shared/types.ts";
import { activeTags, EMPTY_FILTERS, hasActiveFilters, parseFilters, resolveLayout, serializeFilters, staleOptions } from "../src/ui/filters.ts";
import { boardCards, boardStats, visibleCards } from "../src/ui/kanban.tsx";
import { archivePending } from "../src/ui/sessionState.ts";

test("the Stale selector offers the presets and keeps a threshold from the URL", () => {
  expect(staleOptions(0).map((o) => o.label)).toEqual(["Any activity", "Idle 7+ days", "Idle 14+ days", "Idle 30+ days", "Idle 90+ days"]);
  expect(staleOptions(10).map((o) => o.value)).toEqual([0, 7, 10, 14, 30, 90]);
  expect(staleOptions(14).map((o) => o.value)).toEqual([0, 7, 14, 30, 90]);
});

test("tags follow the board's repository order, and removing one clears only that filter", () => {
  const repos = [
    { id: "a1", name: "alpha-infra" },
    { id: "b2", name: "beta-soc" },
    { id: "c3", name: "gamma-web" },
  ];
  const filters = parseFilters("?repos=b2,a1&stale=10&q=sync");
  const tags = activeTags(filters, repos);
  expect(tags.map((t) => t.label)).toEqual(["alpha-infra", "beta-soc", "Idle 10+ days"]);
  expect(tags[1]).toMatchObject({ repoId: "b2", clear: { repos: ["a1"] } });
  expect(serializeFilters({ ...filters, ...tags[1].clear })).toBe("?repos=a1&q=sync&stale=10");
  expect(serializeFilters({ ...filters, ...tags[2].clear })).toBe("?repos=b2%2Ca1&q=sync");
});

test("a repository no longer tracked produces no tag", () => {
  expect(activeTags(parseFilters("?repos=zz"), [{ id: "a1", name: "alpha-infra" }])).toEqual([]);
});

test("clear filters shows only while something is filtered", () => {
  expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  expect(hasActiveFilters(parseFilters("?archived=0"))).toBe(true);
  expect(hasActiveFilters(parseFilters("?q=x"))).toBe(true);
});

test("Hide merged is on by default and only merged=1 in the URL turns it off", () => {
  expect(EMPTY_FILTERS.hideMerged).toBe(true);
  expect(parseFilters("").hideMerged).toBe(true);
  expect(parseFilters("?merged=0").hideMerged).toBe(true);
  expect(parseFilters("?merged=1").hideMerged).toBe(false);
  expect(serializeFilters(EMPTY_FILTERS)).toBe("");
  expect(serializeFilters({ ...EMPTY_FILTERS, hideMerged: false })).toBe("?merged=1");
  expect(parseFilters(serializeFilters({ ...EMPTY_FILTERS, hideMerged: false, hideArchived: true }))).toEqual({ ...EMPTY_FILTERS, hideMerged: false, hideArchived: true });
  // Only a departure from the default is a filter to clear.
  expect(hasActiveFilters(parseFilters(""))).toBe(false);
  expect(hasActiveFilters(parseFilters("?merged=1"))).toBe(true);
});

test("the board layout follows the window unless chosen, and lives in the URL", () => {
  expect(resolveLayout("auto", true)).toBe("stack");
  expect(resolveLayout("auto", false)).toBe("lanes");
  expect(resolveLayout("lanes", true)).toBe("lanes");
  expect(resolveLayout("stack", false)).toBe("stack");
  expect(parseFilters("?layout=stack").layout).toBe("stack");
  expect(parseFilters("?layout=galaxy").layout).toBe("auto");
  expect(serializeFilters({ ...EMPTY_FILTERS, layout: "lanes" })).toBe("?layout=lanes");
  expect(serializeFilters(EMPTY_FILTERS)).toBe("");
  // A layout is not a filter: it does not light up "Clear filters".
  expect(hasActiveFilters(parseFilters("?layout=stack"))).toBe(false);
});

// ---- a card's pull-request link is display only ----

const prCard = (name: string, column: string, stage: ChangeSnapshot["stage"], branchMatch?: string): ChangeSnapshot => ({
  repoId: "a1",
  name,
  schema: "spec-driven",
  artifacts: [],
  tasks: { done: 2, total: 4 },
  lastActivityAt: "2026-03-01T12:00:00Z",
  branchMatch,
  stage,
  column,
});
const prRepo: RepoSnapshot = {
  id: "a1",
  name: "alpha-infra",
  path: "/w/acme/alpha-infra",
  ok: true,
  scannedAt: "2026-03-10T12:00:00Z",
  isGit: true,
  worktrees: [],
  changes: [prCard("add-sync", "Implementing", "implementing", "feat/add-sync"), prCard("ship-it", "Done", "done", "feat/ship-it"), prCard("idle-one", "Backlog", "backlog")],
};
const prList = (head: string, number: number, state: PullRequest["state"] = "open"): PullRequest => ({
  number,
  title: head,
  url: `https://github.com/acme/alpha-infra/pull/${number}`,
  author: "octo",
  head,
  base: "main",
  draft: false,
  state,
  createdAt: "2026-03-09T12:00:00Z",
  mergedAt: state === "merged" ? "2026-03-09T13:00:00Z" : undefined,
  review: "none",
  reviewRequestedFromViewer: false,
  checks: "none",
});
const withPrs: PullRequestsResponse = {
  repos: [{ repoId: "a1", github: "acme/alpha-infra", status: "ok", fetchedAt: "2026-03-10T12:00:00Z", pullRequests: [prList("feat/add-sync", 7), prList("feat/ship-it", 8, "merged")] }],
};

test("a pull-request link is not a filter: clearing filters shows the same cards with or without pull requests", () => {
  const NOW_PR = Date.parse("2026-03-10T12:00:00Z");
  const hues = new Map([["a1", 0]]);
  const without = boardCards([prRepo], hues);
  const linked = boardCards([prRepo], hues, withPrs);
  expect(linked.map((c) => c.pullRequest?.number)).toEqual([7, 8, undefined]);
  const filtered = parseFilters("?q=sync&stale=3");
  for (const filters of [filtered, EMPTY_FILTERS]) {
    expect(visibleCards(linked, filters, false, NOW_PR).map((c) => c.name)).toEqual(visibleCards(without, filters, false, NOW_PR).map((c) => c.name));
  }
  expect(visibleCards(linked, EMPTY_FILTERS, false, NOW_PR).map((c) => c.name)).toEqual(["add-sync", "ship-it", "idle-one"]);
  // No filter knows about pull requests at all.
  expect(Object.keys(EMPTY_FILTERS).some((k) => /pr|pull/i.test(k))).toBe(false);
});

test("a pull-request link changes no column, no column count and no to-archive count", () => {
  const NOW_PR = Date.parse("2026-03-10T12:00:00Z");
  const hues = new Map([["a1", 0]]);
  const without = boardCards([prRepo], hues);
  const linked = boardCards([prRepo], hues, withPrs);
  expect(linked.map((c) => c.column)).toEqual(without.map((c) => c.column));
  const perColumn = (cards: { column: string }[]) => cards.reduce<Record<string, number>>((n, c) => ({ ...n, [c.column]: (n[c.column] ?? 0) + 1 }), {});
  expect(perColumn(linked)).toEqual(perColumn(without));
  expect(boardStats(linked, visibleCards(linked, EMPTY_FILTERS, false, NOW_PR))).toEqual(boardStats(without, visibleCards(without, EMPTY_FILTERS, false, NOW_PR)));
  expect(boardStats(linked, linked)).toEqual({ open: 3, toArchive: 1 });
});

test("Hide merged ignores the pull-request link: an archive is pending or not by its worktree alone", () => {
  const hues = new Map([["a1", 0]]);
  const archived = (name: string): ChangeSnapshot => ({ ...prCard(name, "Archived", "archived"), archived: "2026-03-09", checkout: { path: "/w/acme/alpha-infra", branch: "main", isMain: true } });
  const repo: RepoSnapshot = { ...prRepo, changes: [archived("landed"), archived("waiting")] };
  const worktree = (change: string, state: WorkStatus["state"]): SessionWorktree => ({
    repoId: "a1",
    name: `archive-${change}`,
    path: `/w/home/worktrees/a1/archive-${change}`,
    change,
    action: "archive",
    branch: `chore/archive-${change}`,
    work: { state },
  });
  const worktrees = [worktree("landed", "merged"), worktree("waiting", "pushed")];
  // The opposite of what each worktree says: an open pull request on the landed archive, a merged one on the waiting one.
  const prs: PullRequestsResponse = {
    repos: [{ repoId: "a1", github: "acme/alpha-infra", status: "ok", fetchedAt: "2026-03-10T12:00:00Z", pullRequests: [prList("chore/archive-landed", 21), prList("chore/archive-waiting", 22, "merged")] }],
  };
  const without = boardCards([repo], hues);
  const linked = boardCards([repo], hues, prs);
  expect(linked.map((c) => c.pullRequest?.number)).toEqual([21, 22]);
  const pending = (cards: ChangeSnapshot[]) => cards.map((c) => archivePending(c, worktrees));
  expect(pending(linked)).toEqual([false, true]);
  expect(pending(linked)).toEqual(pending(without));
});
