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
  // the demo starts with profiles already carried (see the seed test below); clear the slate for this walk-through
  await api.saveSharedConfig({ profiles: [] });
  const everyRepo = (await api.state()).repos.map((r) => ({ repoId: r.id, profileIds: [] }));
  await api.applySharedConfig(everyRepo);
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

  expect((await demo().api.sharedConfig()).profiles.map((p) => p.id)).toEqual(["base", "security"]); // a reload starts over, from the seed
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

test("change artifacts in the demo: files follow the sample's state, tasks.md agrees with the card, errors match the server's", async () => {
  const { api } = demo();
  const [repo] = (await api.state()).repos;
  const inProgress = repo.changes.find((c) => c.name === "add-rate-limiting")!;
  const listing = await api.changeArtifacts(repo.id, inProgress.name);
  expect(listing.change).toEqual({ repoId: repo.id, name: "add-rate-limiting", schema: "spec-driven", dir: `${repo.path}/openspec/changes/add-rate-limiting`, archived: false });
  expect(listing.artifacts.map((a) => a.id)).toEqual(inProgress.artifacts.map((a) => a.id));
  expect(listing.artifacts.every((a) => a.files.length > 0 && a.files.every((f) => f.bytes > 0))).toBe(true);

  const tasks = await api.artifactFile(repo.id, inProgress.name, "tasks.md");
  expect(tasks.text.match(/^- \[x\]/gm)?.length).toBe(inProgress.tasks!.done);
  expect(tasks.text.match(/^- \[[ x]\]/gm)?.length).toBe(inProgress.tasks!.total);
  expect(tasks.bytes).toBe(new TextEncoder().encode(tasks.text).length);

  const early = await api.changeArtifacts(repo.id, "idempotency-keys");
  expect(early.artifacts.map((a) => [a.id, a.status, a.files.length])).toEqual([["proposal", "done", 1], ["specs", "ready", 0], ["design", "ready", 0], ["tasks", "blocked", 0]]);

  const archived = repo.changes.find((c) => c.archived)!;
  const old = await api.changeArtifacts(repo.id, archived.name);
  expect(old.change.archived).toBe(true);
  expect(old.change.dir).toBe(`${repo.path}/openspec/changes/archive/${archived.archived}-${archived.name}`);

  const status = (p: Promise<unknown>) => p.then(() => 200, (err) => (err as { status?: number }).status);
  expect(await status(api.changeArtifacts(repo.id, "never-existed"))).toBe(404);
  expect(await status(api.changeArtifacts("nope", inProgress.name))).toBe(404);
  expect(await status(api.artifactFile(repo.id, "never-existed", "proposal.md"))).toBe(404);
  expect(await status(api.artifactFile(repo.id, inProgress.name, "missing.md"))).toBe(404);
  expect(await status(api.artifactFile(repo.id, inProgress.name, "../secrets.md"))).toBe(400);
  expect(await status(api.artifactFile(repo.id, "a/b", "proposal.md"))).toBe(400);
});

test("cleanup is simulated: a merged worktree and its branch go, kept items say why, and a reload brings them back", async () => {
  const { api } = demo();
  const repo = (await api.state()).repos.find((r) => r.name === "lantern-infra")!;
  const preview = await api.cleanupPreview(repo.id);
  const worktree = preview.worktrees.find((w) => w.branch === "chore/upgrade-terraform")!;
  expect(worktree).toMatchObject({ removable: true, work: { state: "merged" } });
  expect(preview.worktrees.some((w) => !w.removable && w.reason)).toBe(true);
  expect(preview.branches.find((b) => b.name === "experiment/plan-cache")).toMatchObject({ removable: false, reason: "4 commit(s) not in origin/main" });
  expect(preview.prunable.length).toBe(1);
  const branch = preview.branches.find((b) => b.name === "chore/upgrade-terraform")!;
  expect(branch).toMatchObject({ removable: true, worktreePath: worktree.path });

  const result = await api.cleanup(repo.id, { worktrees: [worktree.path], prune: true, branches: [{ name: branch.name, commit: branch.commit }] });
  expect(result.items.map((i) => [i.kind, i.outcome])).toEqual([
    ["worktree", "removed"],
    ["prune", "pruned"],
    ["branch", "deleted"],
  ]);
  expect(result.items[2].commit).toBe(branch.commit);
  const after = (await api.state()).repos.find((r) => r.id === repo.id)!;
  expect(after.worktrees.some((w) => w.path === worktree.path || w.prunable)).toBe(false);
  expect((await api.cleanupPreview(repo.id)).branches.map((b) => b.name)).not.toContain("chore/upgrade-terraform");

  const fresh = demo().api;
  expect((await fresh.state()).repos.find((r) => r.id === repo.id)!.worktrees.some((w) => w.path === worktree.path)).toBe(true);
});

test("the main checkout's branch is never offered in the demo either", async () => {
  const { api } = demo();
  const repo = (await api.state()).repos.find((r) => r.name === "harbor-web")!;
  const preview = await api.cleanupPreview(repo.id);
  expect(preview.branches.find((b) => b.name === repo.currentBranch)).toMatchObject({ removable: false, reason: "it is checked out in the main checkout" });
  expect(preview.branches.find((b) => b.name === "fix/focus-ring-contrast")).toMatchObject({ removable: true });
});
