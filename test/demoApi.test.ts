import { expect, test } from "bun:test";
import { createDemoApi } from "../src/ui/demo/demoApi.ts";
import { DEMO_ROOT } from "../src/ui/demo/sampleData.ts";

function demo() {
  let clock = Date.parse("2026-06-01T12:00:00.000Z");
  return { api: createDemoApi({ now: () => clock, latencyMs: 0 }), tick: (ms: number) => (clock += ms) };
}

test("a scan changes generatedAt, so Refresh's wait-for-a-new-snapshot loop ends", async () => {
  const { api, tick } = demo();
  const before = (await api.state()).generatedAt;
  tick(5_000);
  expect(await api.scan()).toEqual({ started: true });
  expect((await api.state()).generatedAt).not.toBe(before);
});

test("saving a config with a repository disabled removes it from the state, for this instance only", async () => {
  const { api } = demo();
  const config = await api.config();
  const [first] = config.repos;
  await api.saveConfig({ ...config, repos: config.repos.map((r) => (r.id === first.id ? { ...r, enabled: false } : r)) });
  expect((await api.state()).repos.map((r) => r.id)).not.toContain(first.id);
  // What a reload does: a fresh instance has the original sample again.
  expect((await demo().api.state()).repos.map((r) => r.id)).toContain(first.id);
});

test("renaming a repository shows on the board", async () => {
  const { api } = demo();
  const config = await api.config();
  await api.saveConfig({ ...config, repos: config.repos.map((r, i) => (i === 0 ? { ...r, name: "renamed" } : r)) });
  expect((await api.state()).repos[0].name).toBe("renamed");
});

test("discovery offers only untracked candidates, and an enabled one appears as an empty repository", async () => {
  const { api } = demo();
  const config = await api.config();
  const found = await api.discover();
  expect(found.candidates.length).toBeGreaterThan(0);
  expect(found.candidates.every((c) => !config.repos.some((r) => r.id === c.id))).toBe(true);

  const [picked] = found.candidates;
  await api.saveConfig({ ...config, repos: [...config.repos, { ...picked, enabled: true }] });
  expect((await api.discover()).candidates.map((c) => c.id)).not.toContain(picked.id);
  expect((await api.state()).repos.find((r) => r.id === picked.id)?.changes).toEqual([]);
});

test("discovery outside the sample workspace explains itself instead of pretending", async () => {
  const { api } = demo();
  const result = await api.discover(["/somewhere/else"]);
  expect(result.candidates).toEqual([]);
  expect(result.errors.map((e) => e.root)).toEqual(["/somewhere/else"]);
  expect((await api.discover([DEMO_ROOT])).errors).toEqual([]);
});

test("callers cannot mutate the demo's state through returned objects", async () => {
  const { api } = demo();
  const state = await api.state();
  state.repos.length = 0;
  expect((await api.state()).repos.length).toBeGreaterThan(0);
});
