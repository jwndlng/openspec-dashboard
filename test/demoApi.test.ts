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

test("shared config in the demo: per-repository profiles, outdated after an edit, orphaned after a delete, nothing persisted", async () => {
  const { api } = demo();
  expect(await api.sharedConfig()).toEqual({ profiles: [] });
  expect((await api.state()).repos.every((r) => r.sharedConfig === undefined)).toBe(true);

  const base = { id: "base", name: "Base", context: "We use conventional commits.", rules: { proposal: ["Always include Non-goals"] } };
  const security = { id: "security", name: "Security", context: "Threat-model every new endpoint.", rules: {} };
  await api.saveSharedConfig({ profiles: [base, security] });
  const [first, second] = (await api.state()).repos;
  expect(first.sharedConfig).toEqual({ unreadable: false, applied: [] });

  const assignments = [{ repoId: first.id, profileIds: ["base", "security"] }, { repoId: second.id, profileIds: ["base"] }, { repoId: "nope", profileIds: ["base"] }, { repoId: second.id.concat("x"), profileIds: [] }];
  const { previews } = await api.previewSharedConfig(assignments.slice(0, 3));
  expect(previews[0].after).toContain("openspec-dashboard:shared:begin security");
  expect(previews[0].after).toContain("- Always include Non-goals # openspec-dashboard:shared:base");
  expect(previews[0].before).not.toContain("openspec-dashboard:shared");
  expect(previews[2].refusal).toContain("not an enabled repository");
  expect((await api.state()).repos[0].sharedConfig?.applied).toEqual([]); // a preview changes nothing

  const { results } = await api.applySharedConfig(assignments.slice(0, 3));
  expect(results.map((r) => r.result)).toEqual(["written", "written", "refused"]);
  expect((await api.applySharedConfig([assignments[1]])).results[0].result).toBe("unchanged");
  expect((await api.applySharedConfig([{ repoId: first.id, profileIds: ["missing"] }])).results[0].reason).toBe("unknown profile: missing");
  let repos = (await api.state()).repos;
  expect(repos[0].sharedConfig?.applied).toEqual([{ id: "base", state: "in-sync" }, { id: "security", state: "in-sync" }]);
  expect(repos[1].sharedConfig?.applied).toEqual([{ id: "base", state: "in-sync" }]);

  await api.saveSharedConfig({ profiles: [{ ...base, context: "We use conventional commits. Squash on merge." }] });
  repos = (await api.state()).repos;
  expect(repos[0].sharedConfig?.applied).toEqual([{ id: "base", state: "outdated" }, { id: "security", state: "orphaned" }]);

  expect(await demo().api.sharedConfig()).toEqual({ profiles: [] }); // a reload starts over
});

test("pull in the demo: canned outcomes, the notice's repositories are only fetched, nothing persists", async () => {
  const { api } = demo();
  const repos = (await api.state()).repos;
  const offDefault = repos.filter((r) => r.onDefaultBranch === false).map((r) => r.name);
  expect(offDefault.sort()).toEqual(["ember-mobile", "harbor-web"]); // the sample shows the notice at first sight
  expect(repos.every((r) => r.defaultBranch === "main")).toBe(true);

  const onMain = repos.find((r) => r.name === "atlas-api")!;
  const first = await api.pullRepo(onMain.id);
  expect(first).toMatchObject({ fetched: true, update: "fast-forwarded", branch: "main", upstream: "origin/main" });
  expect(first.commits).toBeGreaterThan(0);
  expect((await api.pullRepo(onMain.id)).update).toBe("up-to-date");

  const harbor = repos.find((r) => r.name === "harbor-web")!;
  expect(await api.pullRepo(harbor.id)).toMatchObject({ fetched: true, update: "skipped", reason: "on feat/redesign-settings-page, not main; only fetched" });

  const failedScan = repos.find((r) => !r.ok)!;
  await expect(api.pullRepo(failedScan.id)).rejects.toThrow("not a tracked");
  await expect(api.pullRepo("nope")).rejects.toThrow("not a tracked");

  const { results } = await api.pullAll();
  expect(results.map((r) => r.repoId).sort()).toEqual(repos.filter((r) => r.ok).map((r) => r.id).sort());
  expect((await demo().api.pullRepo(onMain.id)).update).toBe("fast-forwarded"); // a reload starts over
});
