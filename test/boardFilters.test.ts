import { expect, test } from "bun:test";
import { activeTags, EMPTY_FILTERS, hasActiveFilters, parseFilters, resolveLayout, serializeFilters, staleOptions } from "../src/ui/filters.ts";

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
