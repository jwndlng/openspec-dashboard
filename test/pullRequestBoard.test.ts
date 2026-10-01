// A board as the third view that shows pull requests: the one refresh opening it may start, and the link on its cards.
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChangeSnapshot, PullRequest, PullRequestsResponse, RepoPullRequests, RepoSnapshot } from "../src/shared/types.ts";
import { boardCards, type Card, ChangeCard } from "../src/ui/kanban.tsx";
import { createPrRefresher, FRESHNESS_MS } from "../src/ui/pullRequestsState.ts";
import { byTag, elements, textOf } from "./vnode.ts";

const NOW = Date.parse("2026-03-10T12:00:00Z");
const MIN = 60_000;
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const pr = (patch: Partial<PullRequest> & { number: number }): PullRequest => ({
  title: `change ${patch.number}`,
  url: `https://github.com/acme/alpha-infra/pull/${patch.number}`,
  author: "octo",
  head: "feat/add-validate-phase",
  base: "main",
  draft: false,
  state: "open",
  createdAt: ago(120 * MIN),
  review: "none",
  reviewRequestedFromViewer: false,
  checks: "none",
  ...patch,
});

const list = (repoId: string, fetchedAt: string | undefined, pullRequests: PullRequest[] = [], patch: Partial<RepoPullRequests> = {}): RepoPullRequests => ({
  repoId,
  github: `acme/${repoId}`,
  status: fetchedAt ? "ok" : "never",
  fetchedAt,
  pullRequests,
  ...patch,
});

/** A refresher over a fake server that counts the refreshes asked for and answers when told to. */
function harness(initial: PullRequestsResponse | undefined, synthetic = false) {
  let current = initial;
  const asked: { repoId?: string; force?: boolean }[] = [];
  const pending: (() => void)[] = [];
  const refresher = createPrRefresher({
    current: () => current,
    fetch: (options) => {
      asked.push(options);
      return new Promise((resolve) =>
        pending.push(() => resolve({ repos: (current?.repos ?? []).map((r) => ({ ...r, status: "ok", fetchedAt: new Date(NOW).toISOString() })) })),
      );
    },
    onStart: () => {},
    onAnswer: (answer) => {
      current = answer;
    },
    onError: () => {},
    onSettled: () => {},
    synthetic,
  });
  const answer = async () => {
    for (const done of pending.splice(0)) done();
    await new Promise((r) => setTimeout(r, 0));
  };
  return { refresher, asked, answer };
}

test("the freshness window is five minutes", () => {
  expect(FRESHNESS_MS).toBe(5 * MIN);
});

test("opening a board with a stale cache starts one refresh", async () => {
  const { refresher, asked, answer } = harness({ repos: [list("alpha", ago(20 * MIN))] });
  expect(refresher.openBoard(undefined, NOW)).toBeDefined();
  expect(asked).toEqual([{}]);
  await answer();
});

test("never fetched counts as stale; a repository board looks at its own list only", async () => {
  const { refresher, asked, answer } = harness({ repos: [list("alpha", ago(1 * MIN)), list("beta", undefined)] });
  expect(refresher.openBoard("alpha", NOW)).toBeUndefined();
  expect(asked).toEqual([]);
  refresher.openBoard("beta", NOW);
  expect(asked).toEqual([{ repoId: "beta" }]);
  await answer();
});

test("opening a board with a fresh cache starts nothing", () => {
  const { refresher, asked } = harness({ repos: [list("alpha", ago(2 * MIN)), list("beta", ago(4 * MIN))] });
  expect(refresher.openBoard(undefined, NOW)).toBeUndefined();
  expect(refresher.openBoard("beta", NOW)).toBeUndefined();
  expect(asked).toEqual([]);
});

test("two boards opened in quick succession share one refresh, and the next one finds the cache fresh", async () => {
  const { refresher, asked, answer } = harness({ repos: [list("alpha", ago(20 * MIN)), list("beta", ago(20 * MIN))] });
  const first = refresher.openBoard(undefined, NOW);
  const second = refresher.openBoard("alpha", NOW);
  expect(second).toBe(first);
  expect(asked).toHaveLength(1);
  await answer();
  expect(refresher.openBoard("beta", NOW + 1 * MIN)).toBeUndefined();
  expect(asked).toHaveLength(1);
});

test("a board left open asks nothing further on its own: only an explicit call ever reaches the server", async () => {
  const { refresher, asked, answer } = harness({ repos: [list("alpha", ago(20 * MIN))] });
  refresher.openBoard(undefined, NOW);
  await answer();
  // An hour passes with scans; the refresher has no timer of its own, so nothing happens until a view asks.
  await new Promise((r) => setTimeout(r, 20));
  expect(asked).toHaveLength(1);
});

test("synthetic lists (the demo) are never refreshed by a board, however old", () => {
  const { refresher, asked } = harness({ repos: [list("alpha", ago(120 * MIN))] }, true);
  expect(refresher.openBoard(undefined, NOW)).toBeUndefined();
  expect(refresher.openBoard("alpha", NOW)).toBeUndefined();
  expect(asked).toEqual([]);
  // The Pull requests view's own rule is unchanged.
  refresher.refreshIfStale(undefined, NOW);
  expect(asked).toHaveLength(1);
});

// ---- only a board's opening triggers it ----

const UI = join(import.meta.dir, "..", "src", "ui");
const sources = () =>
  readdirSync(UI)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => ({ file: f, text: readFileSync(join(UI, f), "utf8") }));

test("the board's opening is the only place that calls openBoard, once, in an effect keyed to the board", () => {
  const calls = sources().flatMap(({ file, text }) => [...text.matchAll(/\bopenBoard\(/g)].map(() => file));
  // pullRequests.tsx defines and forwards it; kanban.tsx is the one caller.
  expect(calls.filter((f) => f !== "pullRequests.tsx" && f !== "pullRequestsState.ts")).toEqual(["kanban.tsx"]);
  const kanban = readFileSync(join(UI, "kanban.tsx"), "utf8");
  expect(kanban).toMatch(/useEffect\(\(\) => \{\s*if \(!prsLoading\) openBoard\(repoId\);\s*\}, \[prsLoading, openBoard, repoId\]\);/);
  // No timer anywhere near it.
  expect(kanban).not.toMatch(/setInterval/);
});

test("the projects overview and the scan path never start a pull-request refresh", () => {
  for (const file of ["overview.tsx", "overviewState.ts", "autoRefresh.ts", "app.tsx"]) {
    const text = readFileSync(join(UI, file), "utf8");
    expect({ file, refresh: /refreshIfStale|openBoard|refreshPullRequests|\.refresh\(/.test(text) }).toEqual({ file, refresh: false });
  }
});

// ---- the card ----

const change = (patch: Partial<ChangeSnapshot> = {}): ChangeSnapshot => ({
  repoId: "alpha",
  name: "add-validate-phase",
  schema: "spec-driven",
  artifacts: [],
  tasks: { done: 4, total: 12 },
  lastActivityAt: ago(60 * MIN),
  branchMatch: "feat/add-validate-phase",
  stage: "implementing",
  column: "Implementing",
  ...patch,
});

const repo = (changes: ChangeSnapshot[]): RepoSnapshot => ({ id: "alpha", name: "alpha-infra", path: "/w/acme/alpha-infra", ok: true, scannedAt: ago(0), isGit: true, worktrees: [], changes });
const hues = new Map([["alpha", 120]]);
const cardOf = (c: ChangeSnapshot, prs?: PullRequestsResponse): Card => boardCards([repo([c])], hues, prs)[0];
const render = (card: Card) => ChangeCard({ card, now: NOW, from: "/board" });
const prLink = (card: Card) => byTag(render(card), "a").find((a) => String(a.props.class ?? "").includes("card-pr"));

test("a card with an open pull request links to it in a new tab, saying its number and state", () => {
  const card = cardOf(change(), { repos: [list("alpha", ago(MIN), [pr({ number: 125 })])] });
  const link = prLink(card);
  expect(link?.props.href).toBe("https://github.com/acme/alpha-infra/pull/125");
  expect(link?.props.target).toBe("_blank");
  expect(link?.props.rel).toBe("noopener noreferrer");
  expect(textOf(link).replace(/\s+/g, " ")).toBe("PR #125○ open");
  expect(link?.props["aria-label"]).toBe("Pull request #125 of alpha-infra, open, opens on GitHub");
  expect(String(link?.props.title)).toContain("open on GitHub");
  expect(String(link?.props.class)).not.toContain("settled");
  // On the footer's status line, before the session controls and Show details.
  const meta = elements(render(card)).find((el) => el.props.class === "meta");
  expect(byTag(meta, "a").map((a) => String(a.props.class))).toEqual([expect.stringContaining("card-pr"), "show-details"]);
});

test("a draft is read as a draft, by name and number", () => {
  const link = prLink(cardOf(change(), { repos: [list("alpha", ago(MIN), [pr({ number: 126, draft: true })])] }));
  expect(link?.props["aria-label"]).toBe("Pull request #126 of alpha-infra, draft, opens on GitHub");
  expect(textOf(link)).toContain("draft");
});

test("merged and closed pull requests are still shown, more quietly", () => {
  for (const state of ["merged", "closed"] as const) {
    const p = pr({ number: 120, state, mergedAt: state === "merged" ? ago(MIN) : undefined, closedAt: ago(MIN) });
    const link = prLink(cardOf(change(), { repos: [list("alpha", ago(MIN), [p])] }));
    expect(textOf(link)).toContain(state);
    expect(String(link?.props.class)).toContain("settled");
    expect(link?.props["aria-label"]).toContain(`, ${state},`);
  }
});

test("no pull request, or unavailable pull requests: no link and no error", () => {
  const prs = { repos: [list("alpha", ago(MIN), [pr({ number: 125 })])] };
  expect(prLink(cardOf(change({ name: "other", branchMatch: "feat/other" }), prs))).toBeUndefined();
  const unavailable = { repos: [list("alpha", ago(MIN), [pr({ number: 125 })], { status: "unavailable", setup: "gh-missing", reason: "gh is not installed" })] };
  const card = cardOf(change(), unavailable);
  expect(prLink(card)).toBeUndefined();
  expect(textOf(render(card))).not.toMatch(/gh|unavailable|error/i);
});

test("an archived card shows its archive pull request while it awaits review, and a merged one quietly", () => {
  const archived = change({ archived: "2026-03-09", column: "Archived", stage: "archived", branchMatch: undefined });
  const implementation = pr({ number: 125, state: "merged", mergedAt: ago(3 * 60 * MIN) });
  const archive = pr({ number: 131, head: "chore/archive-add-validate-phase", createdAt: ago(MIN) });
  const open = prLink(cardOf(archived, { repos: [list("alpha", ago(MIN), [implementation, archive])] }));
  expect(open?.props.href).toBe(archive.url);
  expect(open?.props["aria-label"]).toContain(", open,");
  const merged = prLink(cardOf(archived, { repos: [list("alpha", ago(MIN), [implementation])] }));
  expect(merged?.props.href).toBe(implementation.url);
  expect(textOf(merged)).toContain("merged");
  expect(String(merged?.props.class)).toContain("settled");
});

test("a board with no pull requests renders exactly as without this feature", () => {
  const changes = [change(), change({ name: "other", branchMatch: undefined }), change({ name: "done-one", archived: "2026-03-09", column: "Archived" })];
  const plain: Card[] = changes.map((c) => ({ ...c, repoName: "alpha-infra", repoPath: "/w/acme/alpha-infra", hue: 120 }));
  for (const prs of [undefined, { repos: [] }, { repos: [list("alpha", ago(MIN))] }, { repos: [list("alpha", undefined)] }]) {
    const cards = boardCards([repo(changes)], hues, prs);
    expect(cards).toEqual(plain);
    expect(cards.map((c) => "pullRequest" in c)).toEqual([false, false, false]);
    const markup = (c: Card) => JSON.stringify(elements(render(c)).map((el) => [el.type, el.props.class]));
    expect(cards.map(markup)).toEqual(plain.map(markup));
  }
});

test("pull requests arriving later keep the cards' order and add the link in place", () => {
  const changes = [change({ name: "a", branchMatch: "feat/a" }), change({ name: "b", branchMatch: "feat/b" }), change({ name: "c", branchMatch: "feat/c" })];
  const before = boardCards([repo(changes)], hues, { repos: [list("alpha", ago(20 * MIN))] });
  const after = boardCards([repo(changes)], hues, { repos: [list("alpha", ago(0), [pr({ number: 2, head: "feat/b" })])] });
  expect(after.map((c) => c.name)).toEqual(before.map((c) => c.name));
  expect(after.map((c) => c.column)).toEqual(before.map((c) => c.column));
  expect(after.map((c) => c.pullRequest?.number)).toEqual([undefined, 2, undefined]);
  const { pullRequest: _added, ...rest } = after[1];
  expect(rest).toEqual(before[1]);
});
