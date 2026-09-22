import { expect, test } from "bun:test";
import { assignRepoHues, groupByRepo, newChangeTargets, recentArchived, REPO_HUES, repoTint } from "../src/ui/repoGroups.ts";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `repo-${i.toString(16).padStart(4, "0")}`);

test("assignRepoHues is deterministic regardless of input order", () => {
  const list = ids(17);
  const forward = assignRepoHues(list);
  const backward = assignRepoHues([...list].reverse());
  expect([...backward.entries()].sort()).toEqual([...forward.entries()].sort());
  expect(assignRepoHues(list)).toEqual(forward);
});

test("assignRepoHues gives distinct hues for up to 19 repositories", () => {
  for (const n of [17, 19]) {
    const hues = [...assignRepoHues(ids(n)).values()];
    expect(hues).toHaveLength(n);
    expect(new Set(hues).size).toBe(n);
  }
});

test("assignRepoHues still colours every repository beyond 19", () => {
  const list = ids(30);
  const hues = assignRepoHues(list);
  expect(hues.size).toBe(30);
  for (const id of list) expect(hues.has(id)).toBe(true);
});

test("assignRepoHues only hands out hues the status roles left free", () => {
  for (const hue of assignRepoHues(ids(30)).values()) expect(REPO_HUES).toContain(hue);
});

test("assignRepoHues ignores duplicate ids and handles an empty set", () => {
  expect(assignRepoHues([]).size).toBe(0);
  expect(assignRepoHues(["a", "a", "b"])).toEqual(assignRepoHues(["a", "b"]));
});

const card = (repoId: string, repoName: string, name: string) => ({ repoId, repoName, name });

test("groupByRepo gathers interleaved cards and keeps their order within a group", () => {
  const groups = groupByRepo([card("1", "alpha", "a1"), card("2", "beta", "b1"), card("1", "alpha", "a2")]);
  expect(groups.map((g) => [g.repoName, g.cards.map((c) => c.name)])).toEqual([
    ["alpha", ["a1", "a2"]],
    ["beta", ["b1"]],
  ]);
});

test("groupByRepo orders groups by name case-insensitively", () => {
  const groups = groupByRepo([card("z", "zeta", "z1"), card("a", "Alpha", "a1"), card("b", "beta", "b1")]);
  expect(groups.map((g) => g.repoName)).toEqual(["Alpha", "beta", "zeta"]);
});

test("groupByRepo keeps same-named repositories with different ids apart", () => {
  const groups = groupByRepo([card("2", "ops", "x"), card("1", "ops", "y"), card("2", "ops", "z")]);
  expect(groups.map((g) => [g.repoId, g.cards.map((c) => c.name)])).toEqual([
    ["1", ["y"]],
    ["2", ["x", "z"]],
  ]);
});

test("groupByRepo returns no groups for no cards", () => {
  expect(groupByRepo([])).toEqual([]);
});

const archivedOn = (archived: string | undefined, name: string) => ({ archived, name });

test("recentArchived sorts newest archive first and applies the bound", () => {
  const cards = [archivedOn("2026-01-05", "a"), archivedOn("2026-03-01", "b"), archivedOn("2025-12-31", "c"), archivedOn("2026-02-10", "d")];
  expect(recentArchived(cards, 3).map((c) => c.name)).toEqual(["b", "d", "a"]);
});

test("recentArchived returns everything when under the bound and does not mutate its input", () => {
  const cards = [archivedOn("2026-01-05", "a"), archivedOn(undefined, "x"), archivedOn("2026-03-01", "b")];
  const before = [...cards];
  expect(recentArchived(cards, 25).map((c) => c.name)).toEqual(["b", "a", "x"]);
  expect(cards).toEqual(before);
  expect(recentArchived([], 25)).toEqual([]);
});

test("repoTint gives a repository of the snapshot the board's own hue", () => {
  const hues = assignRepoHues(ids(5));
  for (const id of ids(5)) {
    expect(repoTint(hues, id)).toEqual({ class: "repo-tint", style: { "--repo-hue": String(hues.get(id)) } });
  }
});

test("repoTint leaves a repository outside the snapshot untinted", () => {
  const hues = assignRepoHues(ids(3));
  expect(repoTint(hues, "not-in-the-snapshot")).toEqual({ class: "" });
  expect(repoTint(new Map(), ids(1)[0]).style).toBeUndefined();
});

const alpha = { id: "a1", name: "alpha-infra", ok: true };
const beta = { id: "b2", name: "beta-soc", ok: true };
const gamma = { id: "c3", name: "gamma-web", ok: false };

test("newChangeTargets offers only repositories whose scan succeeded, in snapshot order", () => {
  expect(newChangeTargets([beta, gamma, alpha], []).projects).toEqual([
    { id: "b2", name: "beta-soc" },
    { id: "a1", name: "alpha-infra" },
  ]);
});

test("newChangeTargets pre-selects nothing with several projects and no filter", () => {
  expect(newChangeTargets([alpha, beta, gamma], []).preselected).toBeUndefined();
});

test("newChangeTargets pre-selects the one eligible repository the filter selects", () => {
  expect(newChangeTargets([alpha, beta, gamma], ["b2"]).preselected).toBe("b2");
  expect(newChangeTargets([alpha, beta, gamma], ["b2", "c3"]).preselected).toBe("b2");
  expect(newChangeTargets([alpha, beta, gamma], ["a1", "b2"]).preselected).toBeUndefined();
});

test("newChangeTargets ignores a filter on a failed repository", () => {
  expect(newChangeTargets([alpha, beta, gamma], ["c3"]).preselected).toBeUndefined();
});

test("newChangeTargets pre-selects the only eligible repository", () => {
  expect(newChangeTargets([alpha, gamma], [])).toEqual({ projects: [{ id: "a1", name: "alpha-infra" }], preselected: "a1" });
  expect(newChangeTargets([alpha, gamma], ["c3"]).preselected).toBe("a1");
});

test("newChangeTargets offers nothing when no repository is eligible", () => {
  expect(newChangeTargets([gamma], [])).toEqual({ projects: [] });
  expect(newChangeTargets([], [])).toEqual({ projects: [] });
});
