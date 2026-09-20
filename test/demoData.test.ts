// Guards for the demo's sample data: it must be obviously fictional, showcase every board feature, and stay fresh.
import { expect, test } from "bun:test";
import { boardColumns } from "../src/shared/columns.ts";
import { buildSample, DEMO_ROOT } from "../src/ui/demo/sampleData.ts";
import { looksLikeRealHome } from "./helpers.ts";

const NOW = Date.parse("2026-06-01T12:00:00.000Z");
const sample = buildSample(NOW);
const changes = sample.snapshot.repos.flatMap((r) => r.changes);

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

test("every path in the sample is under the fictional root", () => {
  const paths = [
    ...sample.snapshot.repos.flatMap((r) => [r.path, ...r.worktrees.map((w) => w.path)]),
    ...sample.config.repos.map((r) => r.path),
    ...sample.config.scanRoots,
    ...sample.candidates.map((r) => r.path),
  ];
  expect(DEMO_ROOT.startsWith("/home/demo/")).toBe(true);
  expect(paths.length).toBeGreaterThan(10);
  for (const path of paths) expect(path.startsWith("/home/demo/")).toBe(true);
});

test("no string in the sample looks like a real home directory", () => {
  expect(strings(sample).filter(looksLikeRealHome)).toEqual([]);
});

test("the real-home detector catches the usual shapes and lets the demo root through", () => {
  for (const bad of ["/Users/alice/Workspace/secret-repo", "/home/bob/src/x", "C:\\Users\\carol\\code", "see /Users/dave"]) {
    expect(looksLikeRealHome(bad)).toBe(true);
  }
  for (const ok of ["/home/demo/work/atlas-api", "feat/users-page", "openspec/changes/x"]) expect(looksLikeRealHome(ok)).toBe(false);
});

test("the sample showcases every board feature", () => {
  expect(sample.snapshot.repos.length).toBeGreaterThanOrEqual(5);
  const perColumn = new Map<string, number>();
  for (const c of changes) perColumn.set(c.column, (perColumn.get(c.column) ?? 0) + 1);
  for (const column of boardColumns(sample.snapshot)) expect([column, perColumn.get(column) ?? 0]).not.toEqual([column, 0]);
  expect(perColumn.get("Archived") ?? 0).toBeGreaterThan(25);
  expect(changes.some((c) => c.branchMatch)).toBe(true);
  expect(changes.some((c) => c.warnings?.includes("tasks file has no tasks"))).toBe(true);
  expect(changes.some((c) => c.warnings?.some((w) => w !== "tasks file has no tasks"))).toBe(true);
  expect(sample.snapshot.repos.some((r) => !r.ok && r.error)).toBe(true);
  expect(sample.candidates.length).toBeGreaterThan(0);
});

test("ids and change names are unique where the UI relies on it", () => {
  const ids = [...sample.config.repos, ...sample.candidates].map((r) => r.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const repo of sample.snapshot.repos) {
    const names = repo.changes.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  }
});

test("dates move with now, so ages never grow", () => {
  const later = buildSample(NOW + 180 * 24 * 3_600_000);
  const age = (s: typeof sample, now: number) => now - Date.parse(s.snapshot.repos[0].changes[1].lastActivityAt ?? "");
  expect(age(later, NOW + 180 * 24 * 3_600_000)).toBe(age(sample, NOW));
  expect(later.snapshot.generatedAt).not.toBe(sample.snapshot.generatedAt);
});
