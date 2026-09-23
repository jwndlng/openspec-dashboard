import { expect, test } from "bun:test";
import type { ChangeSnapshot, Config, RepoSnapshot, Snapshot, WorkInProgress } from "../src/shared/types.ts";
import { defaultAgentSessions } from "../src/server/config.ts";
import { checkoutMarkers, hasCheckoutInfo } from "../src/ui/checkoutMarkers.ts";
import { cdCommand } from "../src/ui/format.ts";
import { checkoutsNeedingAttention } from "../src/ui/checkout.tsx";
import { attentionCount, checkoutSummary, enabledOnly, filterRows, monogram, overviewRows, parseOverviewState, serializeOverviewState, sortRows, toggleSort, wipIndicator } from "../src/ui/overviewState.ts";
import { repoPath, routeFromPath } from "../src/ui/routes.ts";

function change(repoId: string, name: string, column: string, extra: Partial<ChangeSnapshot> = {}): ChangeSnapshot {
  const stage = column === "Done" ? "done" : column === "Synced" ? "synced" : column === "Archived" ? "archived" : column === "Implementing" ? "implementing" : "artifact";
  return { repoId, name, schema: "spec-driven", artifacts: [], tasks: null, stage, column, ...extra };
}

function repo(id: string, name: string, changes: ChangeSnapshot[], extra: Partial<RepoSnapshot> = {}): RepoSnapshot {
  return { id, name, path: `/w/${name}`, ok: true, scannedAt: "2026-09-19T00:00:00Z", isGit: true, worktrees: [], changes, ...extra };
}

const snapshot: Snapshot = {
  generatedAt: "2026-09-19T00:00:00Z",
  repos: [
    repo(
      "a",
      "alpha-infra",
      [
        change("a", "s1", "Specs"),
        ...Array.from({ length: 9 }, (_, i) => change("a", `i${i}`, "Implementing")),
        change("a", "d1", "Done"),
        change("a", "d2", "Synced"),
        change("a", "old", "Archived", { archived: "2026-01-01" }),
      ],
      { lastUpdatedAt: "2026-09-18T10:00:00+02:00" },
    ),
    repo("b", "beta-soc", [change("b", "x", "Proposal", { lastActivityAt: "2026-07-01T00:00:00Z" }), change("b", "y", "Specs", { lastActivityAt: "2026-07-10T00:00:00Z" })]),
    repo("c", "Fit", [change("c", "gone", "Archived", { archived: "2026-02-02" })], { lastUpdatedAt: "2026-09-19T08:00:00Z" }),
    repo("d", "broken", [], { ok: false, error: "repository path or its openspec/ directory does not exist" }),
  ],
};

test("routeFromPath covers every view, trailing slashes, encoded ids and unknown paths", () => {
  expect(routeFromPath("/")).toEqual({ view: "overview" });
  expect(routeFromPath("")).toEqual({ view: "overview" });
  expect(routeFromPath("/board/")).toEqual({ view: "board" });
  expect(routeFromPath("/settings")).toEqual({ view: "settings" });
  expect(routeFromPath("/repo/abc123")).toEqual({ view: "repo", repoId: "abc123" });
  expect(routeFromPath("/repo/a%20b/")).toEqual({ view: "repo", repoId: "a b" });
  expect(routeFromPath(repoPath("a/b"))).toEqual({ view: "repo", repoId: "a/b" });
  expect(routeFromPath("/repo/%E0%A4%A")).toEqual({ view: "overview" });
  expect(routeFromPath("/repo/a/extra")).toEqual({ view: "overview" });
  expect(routeFromPath("/nope")).toEqual({ view: "overview" });
});

test("overview URL state omits defaults and survives a round trip", () => {
  expect(parseOverviewState("")).toEqual({ sort: "updated", dir: "desc", q: "", wip: false, view: "table" });
  expect(serializeOverviewState({ sort: "updated", dir: "desc", q: "", wip: false, view: "table" })).toBe("");
  expect(parseOverviewState("?sort=open")).toEqual({ sort: "open", dir: "desc", q: "", wip: false, view: "table" });
  expect(parseOverviewState("?sort=name")).toEqual({ sort: "name", dir: "asc", q: "", wip: false, view: "table" });
  expect(serializeOverviewState({ sort: "archive", dir: "desc", q: "", wip: false, view: "table" })).toBe("?sort=archive");
  expect(serializeOverviewState({ sort: "name", dir: "desc", q: "ops", wip: false, view: "table" })).toBe("?sort=name&dir=desc&q=ops");
  expect(parseOverviewState("?sort=name&dir=desc&q=ops")).toEqual({ sort: "name", dir: "desc", q: "ops", wip: false, view: "table" });
  expect(parseOverviewState("?sort=bogus&dir=sideways&repos=a")).toEqual({ sort: "updated", dir: "desc", q: "", wip: false, view: "table" });
});

test("toggleSort flips the active key and starts a new key in its natural direction", () => {
  const byName = toggleSort({ sort: "updated", dir: "desc", q: "x", wip: false, view: "table" }, "name");
  expect(byName).toEqual({ sort: "name", dir: "asc", q: "x", wip: false, view: "table" });
  expect(toggleSort(byName, "name")).toEqual({ sort: "name", dir: "desc", q: "x", wip: false, view: "table" });
});

test("overviewRows counts open changes per column and falls back to change activity", () => {
  const [aws, soc, fit, broken] = overviewRows(snapshot);
  expect(aws.stageCounts).toEqual({ Specs: 1, Implementing: 9, Done: 1, Synced: 1 });
  expect([aws.open, aws.toArchive, aws.archived]).toEqual([12, 2, 1]);
  expect(soc.lastUpdatedAt).toBe("2026-07-10T00:00:00Z");
  expect([fit.open, fit.archived]).toEqual([0, 1]);
  expect(broken.ok).toBe(false);
  expect(broken.error).toContain("does not exist");
  expect(broken.lastUpdatedAt).toBeUndefined();
});

test("sortRows: newest first by default, undated last in both directions, ties by name", () => {
  const rows = overviewRows(snapshot);
  const names = (sort: Parameters<typeof sortRows>[1], dir: Parameters<typeof sortRows>[2]) => sortRows(rows, sort, dir).map((r) => r.name);
  expect(names("updated", "desc")).toEqual(["Fit", "alpha-infra", "beta-soc", "broken"]);
  expect(names("updated", "asc")).toEqual(["beta-soc", "alpha-infra", "Fit", "broken"]);
  expect(names("name", "asc")).toEqual(["alpha-infra", "beta-soc", "broken", "Fit"]);
  expect(names("open", "desc")).toEqual(["alpha-infra", "beta-soc", "broken", "Fit"]);
  expect(names("archive", "desc")).toEqual(["alpha-infra", "beta-soc", "broken", "Fit"]);
});

test("filterRows matches repository names case-insensitively", () => {
  const rows = overviewRows(snapshot);
  expect(filterRows(rows, " FIT ").map((r) => r.name)).toEqual(["Fit"]);
  expect(filterRows(rows, "")).toHaveLength(4);
});

test("cdCommand shell-quotes paths that need it", () => {
  expect(cdCommand("/Users/x/Workspace/foo")).toBe("cd /Users/x/Workspace/foo");
  expect(cdCommand("/Users/x/My Repos/foo")).toBe("cd '/Users/x/My Repos/foo'");
});

test("enabledOnly drops repositories the config no longer enables, before any rescan", () => {
  const config: Config = {
    version: 1,
    scanRoots: [],
    ignorePaths: [],
    pollIntervalSeconds: 60,
    port: 4711,
    agentSessions: defaultAgentSessions(),
    repos: [
      { id: "a", path: "/w/alpha-infra", name: "alpha-infra", enabled: true },
      { id: "b", path: "/w/beta-soc", name: "beta-soc", enabled: false },
    ],
  };
  // "c" and "d" are not in the config at all (forgotten), "b" was just disabled.
  expect(enabledOnly(snapshot, config)?.repos.map((r) => r.id)).toEqual(["a"]);
  expect(enabledOnly(snapshot, config)?.generatedAt).toBe(snapshot.generatedAt);
  expect(enabledOnly(snapshot, null)).toBe(snapshot);
  expect(enabledOnly(null, config)).toBeNull();
});

test("same-named repositories get the shortest distinguishing parent path as a hint", () => {
  const at = (id: string, name: string, path: string) => ({ ...repo(id, name, []), path });
  const rows = overviewRows({
    generatedAt: "2026-09-19T00:00:00Z",
    repos: [
      at("1", "chat-groups", "/w/acme/chat-groups"),
      at("2", "chat-groups", "/w/ops/repo-mirror/repos/chat-groups"),
      at("3", "foo", "/a/x/repos/foo"),
      at("4", "Foo", "/a/y/repos/foo"),
      at("5", "foo", "/a/z/other/foo"),
      at("6", "alpha-infra", "/w/acme/alpha-infra"),
    ],
  });
  expect(rows.map((r) => r.hint)).toEqual(["acme", "repos", "x/repos", "y/repos", "other", undefined]);
  expect(filterRows(rows, "repo-mir")).toHaveLength(0);
  expect(filterRows(rows, "y/rep").map((r) => r.id)).toEqual(["4"]);
  expect(new Set(rows.map((r) => r.id)).size).toBe(6);
});

const wipOf = (extra: Partial<WorkInProgress>): WorkInProgress => ({ worktrees: 0, uncommitted: 0, unpushed: 0, stale: 0, unknown: 0, ...extra });

test("wipIndicator lists the non-zero parts in order and warns only when something needs attention", () => {
  expect(wipIndicator(wipOf({ worktrees: 2, uncommitted: 1, unpushed: 1 }))).toEqual({
    parts: ["2 worktrees", "1 uncommitted", "1 unpushed"],
    text: "2 worktrees · 1 uncommitted · 1 unpushed",
    warn: true,
  });
  expect(wipIndicator(wipOf({ worktrees: 3 }))).toMatchObject({ text: "3 worktrees", warn: false });
  expect(wipIndicator(wipOf({ worktrees: 1 }))?.text).toBe("1 worktree");
  expect(wipIndicator(wipOf({ uncommitted: 1 }))).toMatchObject({ text: "1 uncommitted", warn: true });
  expect(wipIndicator(wipOf({ worktrees: 4, stale: 1 }))).toMatchObject({ text: "4 worktrees · 1 stale", warn: true });
  // A clean repository, unknown checkouts alone, and a snapshot without a summary show nothing.
  expect(wipIndicator(wipOf({}))).toBeUndefined();
  expect(wipIndicator(wipOf({ unknown: 2 }))).toBeUndefined();
  expect(wipIndicator(undefined)).toBeUndefined();
});

const wipSnapshot: Snapshot = {
  generatedAt: "2026-09-19T00:00:00Z",
  repos: [
    repo("g", "gamma-lab", [], { workInProgress: wipOf({ worktrees: 2 }) }), // two clean, fully pushed worktrees
    repo("b", "beta-soc", [], { workInProgress: wipOf({ worktrees: 1, stale: 1 }) }),
    repo("d", "demo-ops", []), // no summary: counts as zero
    repo("a", "alpha-infra", [], { workInProgress: wipOf({ worktrees: 3, uncommitted: 2, unpushed: 1 }) }),
    repo("f", "failed-alpha", [], { ok: false, error: "boom", workInProgress: wipOf({ uncommitted: 2 }) }),
  ],
};

test("overview rows carry the summary and checkouts; a failed repository keeps its indicator", () => {
  const rows = overviewRows(wipSnapshot);
  expect(rows.map(attentionCount)).toEqual([0, 1, 0, 3, 2]);
  const failed = rows.find((r) => r.id === "f")!;
  expect(failed.ok).toBe(false);
  expect(wipIndicator(failed.workInProgress)?.text).toBe("2 uncommitted");
  const checkouts = [{ path: "/w/acme/alpha-infra", branch: "main", isMain: true }];
  expect(overviewRows({ ...wipSnapshot, repos: [repo("x", "x", [], { worktrees: checkouts })] })[0].worktrees).toEqual(checkouts);
});

test("sort by work in progress: most checkouts needing attention first, ties by name", () => {
  const rows = overviewRows(wipSnapshot);
  expect(parseOverviewState("?sort=wip")).toMatchObject({ sort: "wip", dir: "desc" });
  expect(serializeOverviewState(toggleSort(parseOverviewState(""), "wip"))).toBe("?sort=wip");
  expect(sortRows(rows, "wip", "desc").map((r) => r.name)).toEqual(["alpha-infra", "failed-alpha", "beta-soc", "demo-ops", "gamma-lab"]);
  expect(sortRows(rows, "wip", "asc").map((r) => r.name)).toEqual(["demo-ops", "gamma-lab", "beta-soc", "failed-alpha", "alpha-infra"]);
});

test("work-in-progress filter: clean worktrees do not match, and it combines with search", () => {
  const rows = overviewRows(wipSnapshot);
  expect(filterRows(rows, "", true).map((r) => r.name)).toEqual(["beta-soc", "alpha-infra", "failed-alpha"]);
  expect(filterRows(rows, "", false)).toHaveLength(5);
  const state = parseOverviewState("?wip=1&q=alpha");
  expect(state).toMatchObject({ wip: true, q: "alpha" });
  expect(filterRows(rows, state.q, state.wip).map((r) => r.name)).toEqual(["alpha-infra", "failed-alpha"]);
  expect(filterRows(rows, "gamma", true)).toHaveLength(0);
  expect(serializeOverviewState(state)).toBe("?q=alpha&wip=1");
  expect(parseOverviewState("?wip=yes").wip).toBe(false);
});

test("layout: tiles round-trips, the table is omitted, unknown values fall back to the table", () => {
  expect(parseOverviewState("?view=tiles").view).toBe("tiles");
  expect(serializeOverviewState(parseOverviewState("?view=tiles"))).toBe("?view=tiles");
  expect(serializeOverviewState({ ...parseOverviewState("?sort=open&q=ops"), view: "tiles" })).toBe("?sort=open&q=ops&view=tiles");
  expect(serializeOverviewState({ ...parseOverviewState("?view=tiles"), view: "table" })).toBe("");
  expect(parseOverviewState("?view=galaxy").view).toBe("table");
  expect(serializeOverviewState(parseOverviewState("?view=galaxy"))).toBe("");
  // Switching layout keeps sort, search and the filter.
  const before = parseOverviewState("?sort=wip&dir=asc&q=a&wip=1");
  expect(parseOverviewState(serializeOverviewState({ ...before, view: "tiles" }))).toEqual({ ...before, view: "tiles" });
});

test("checkout markers: text for every state, tooltips that say why and mention the last fetch", () => {
  const clean = { modified: 0, untracked: 0, conflicts: 0 };
  const texts = (w: Parameters<typeof checkoutMarkers>[0]) => checkoutMarkers(w).map((m) => m.text);
  expect(texts({ path: "/w/acme/alpha-infra", branch: "main", isMain: true, status: { ...clean, upstream: "origin/main", ahead: 0, behind: 0 }, unpushed: 0 })).toEqual([]);

  const busy = checkoutMarkers({ path: "/w/acme/wt/report", branch: "feat/report", status: { modified: 3, untracked: 1, conflicts: 0, upstream: "origin/feat/report", ahead: 2, behind: 5 }, unpushed: 2 });
  expect(busy.map((m) => m.text)).toEqual(["●4", "↑2", "↓5"]);
  expect(busy[0].title).toBe("4 uncommitted items (3 modified, 1 untracked)");
  expect(busy[1].title).toContain("2 commits ahead of origin/feat/report");
  expect(busy[1].title).toContain("last fetch");
  expect(busy[2].title).toContain("5 commits behind origin/feat/report");
  expect(busy[2].title).toContain("last fetch");

  const [never] = checkoutMarkers({ path: "/w/acme/wt/x", branch: "feat/x", status: clean, unpushed: 3 });
  expect(never.text).toBe("↑3");
  expect(never.title).toContain("not on any remote");
  expect(never.title).toContain("never pushed");
  expect(never.title).toContain("last fetch");
  expect(texts({ path: "/w/acme/wt/y", branch: "feat/y", status: clean, unpushed: 100 })).toEqual(["↑99+"]);

  expect(texts({ path: "/w/acme/wt/gone", branch: "feat/gone", prunable: true })).toEqual(["stale"]);
  expect(checkoutMarkers({ path: "/w/acme/wt/held", branch: "fix/held", locked: true, lockReason: "in use", status: clean, unpushed: 0 })).toEqual([{ kind: "locked", text: "locked", title: "Locked: in use" }]);
  expect(texts({ path: "/w/acme/wt/a", branch: "feat/a", status: "unknown" })).toEqual(["?"]);
  expect(texts({ path: "/w/acme/wt/b", branch: "feat/b", inspected: false })).toEqual(["?"]);

  // Snapshots cached by older versions list path/branch pairs only: the header falls back to the current branch.
  expect(hasCheckoutInfo([{ path: "/w/acme/alpha-infra", branch: "main" }])).toBe(false);
  expect(hasCheckoutInfo([{ path: "/w/acme/alpha-infra", branch: "main", isMain: true }])).toBe(true);
  expect(hasCheckoutInfo([])).toBe(false);
});

test("a tile's monogram takes the initials of the first two words", () => {
  expect(monogram("atlas-api")).toBe("AA");
  expect(monogram("quill-docs-site")).toBe("QD");
  expect(monogram("docs")).toBe("D");
  expect(monogram("my_repo.v2")).toBe("MR");
  expect(monogram("")).toBe("?");
});

test("a tile sums its checkouts up instead of listing them", () => {
  const summary = checkoutSummary([
    { path: "/w/acme/alpha", branch: "main", isMain: true },
    { path: "/w/acme/alpha-report", branch: "feat/report" },
    { path: "/w/acme/alpha-parser", branch: "fix/parser" },
    { path: "/w/acme/alpha-old", detached: true, head: "9f3c2ab" },
    { path: "/w/acme/alpha-dup", branch: "feat/report" },
  ]);
  expect(summary).toMatchObject({ worktrees: 4, branches: 3, text: "4 worktrees · 3 branches active" });
  expect(summary.detail.split("\n")).toEqual([
    "main — main checkout",
    "feat/report — worktree",
    "fix/parser — worktree",
    "detached @ 9f3c2ab — worktree",
    "feat/report — worktree",
  ]);
  expect(checkoutSummary([{ path: "/w/acme/beta", branch: "main", isMain: true }]).text).toBe("0 worktrees · 1 branch active");
});

test("the repository header counts the checkouts holding work", () => {
  expect(
    checkoutsNeedingAttention([
      { path: "/w/acme/alpha", branch: "main", isMain: true, status: { modified: 0, untracked: 0, conflicts: 0 } },
      { path: "/w/acme/alpha-a", branch: "feat/a", status: { modified: 2, untracked: 0, conflicts: 0 } },
      { path: "/w/acme/alpha-b", branch: "feat/b", status: { modified: 0, untracked: 0, conflicts: 0 } },
      { path: "/w/acme/alpha-c", branch: "feat/c", prunable: true },
    ]),
  ).toBe(2);
});

