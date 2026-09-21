import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { type AppState, createFetchHandler } from "../src/server/api.ts";
import { defaultConfig, newRepoConfig } from "../src/server/config.ts";
import { Scanner } from "../src/server/scanner.ts";
import type { PullResult, RepoConfig } from "../src/shared/types.ts";
import { tempDir, useTempHome } from "./helpers.ts";
import { type Fixture, fixture, git, remoteCommits } from "./pullHelpers.ts";

let cleanup: () => Promise<void>;
let server: ReturnType<typeof Bun.serve>;
let base: string;
let state: AppState;
let behind: Fixture;
let unreachable: Fixture;
let offBranch: Fixture;
let disabled: Fixture;
let plain: RepoConfig;
const bases: string[] = [];
const savedSsh = process.env.GIT_SSH_COMMAND;

const post = async (path: string, headers: Record<string, string> = {}) => {
  const res = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers } });
  return { status: res.status, body: await res.json() };
};
const id = (f: Fixture) => newRepoConfig(f.repo, true).id;

beforeAll(async () => {
  ({ cleanup } = await useTempHome());
  [behind, unreachable, offBranch, disabled] = await Promise.all([fixture(), fixture(), fixture(), fixture()]);
  bases.push(behind.base, unreachable.base, offBranch.base, disabled.base);
  git(unreachable.repo, "remote", "set-url", "origin", join(unreachable.base, "nowhere.git"));
  git(offBranch.repo, "checkout", "-q", "-b", "release/4.2");
  const plainRoot = join(await tempDir("osd-plain-"), "plain-notes");
  bases.push(join(plainRoot, ".."));
  await mkdir(join(plainRoot, "openspec", "changes"), { recursive: true });
  plain = newRepoConfig(plainRoot, true);
  const repos = [newRepoConfig(behind.repo, true), newRepoConfig(unreachable.repo, true), newRepoConfig(offBranch.repo, true), newRepoConfig(disabled.repo, false), plain];
  state = { config: { ...defaultConfig(), repos }, scanner: undefined as unknown as Scanner };
  state.scanner = new Scanner(() => state.config, { persist: false });
  await state.scanner.trigger().done;
  server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: createFetchHandler({ state, indexHtml: "" }) });
  base = `http://127.0.0.1:${server.port}`;
});
afterEach(() => {
  if (savedSsh === undefined) delete process.env.GIT_SSH_COMMAND;
  else process.env.GIT_SSH_COMMAND = savedSsh;
});
afterAll(async () => {
  state.scanner.stop();
  server.stop(true);
  for (const b of bases) await rm(b, { recursive: true, force: true });
  await cleanup();
});

test("pulling one repository fast-forwards it, and the state reflects it after the rescan", async () => {
  await remoteCommits(behind, 2);
  const before = git(behind.repo, "rev-parse", "HEAD");
  const res = await post(`/api/repos/${id(behind)}/pull`);
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ repoId: id(behind), fetched: true, update: "fast-forwarded", commits: 2 });
  expect(git(behind.repo, "rev-parse", "HEAD")).not.toBe(before);
  await state.scanner.trigger().done;
  await state.scanner.trigger().done;
  const snap = await (await fetch(`${base}/api/state`)).json();
  expect(snap.repos.find((r: { id: string }) => r.id === id(behind))).toMatchObject({ ok: true, defaultBranch: "main", onDefaultBranch: true });
  expect(snap.repos.find((r: { id: string }) => r.id === id(offBranch))).toMatchObject({ currentBranch: "release/4.2", defaultBranch: "main", onDefaultBranch: false });
});

test("only tracked, scanned git repositories can be pulled; the request never supplies a path", async () => {
  const heads = [disabled, behind].map((f) => git(f.repo, "rev-parse", "HEAD"));
  await remoteCommits(disabled, 1);
  for (const target of [id(disabled), plain.id, "no-such-id", encodeURIComponent(behind.repo), encodeURIComponent("../../etc")]) {
    const res = await post(`/api/repos/${target}/pull`);
    expect([target, res.status]).toEqual([target, 404]);
  }
  expect([disabled, behind].map((f) => git(f.repo, "rev-parse", "HEAD"))).toEqual(heads);
  expect(git(disabled.repo, "rev-parse", "origin/main")).toBe(heads[0]); // not even fetched
  expect((await fetch(`${base}/api/repos/${id(behind)}/pull`)).status).toBe(404); // GET does nothing
});

test("pull all: every eligible repository on its own, failures included", async () => {
  await remoteCommits(behind, 1);
  const res = await post("/api/pull");
  expect(res.status).toBe(200);
  const byId = Object.fromEntries((res.body.results as PullResult[]).map((r) => [r.repoId, r]));
  expect(Object.keys(byId).sort()).toEqual([id(behind), id(unreachable), id(offBranch)].sort()); // not the disabled, not the non-git one
  expect(byId[id(behind)]).toMatchObject({ fetched: true, update: "fast-forwarded", commits: 1 });
  expect(byId[id(unreachable)]).toMatchObject({ fetched: false, update: "failed" });
  expect(byId[id(offBranch)]).toMatchObject({ fetched: true, update: "skipped", reason: "on release/4.2, not main; only fetched" });
});

test("a second pull of the same repository while one runs is refused; a foreign origin never gets that far", async () => {
  const slow = await fixture();
  bases.push(slow.base);
  const repo = newRepoConfig(slow.repo, true);
  state.config = { ...state.config, repos: [...state.config.repos, repo] };
  await state.scanner.trigger().done;
  await state.scanner.trigger().done;
  git(slow.repo, "remote", "set-url", "origin", "ssh://git.example.invalid/team/repo.git");
  process.env.GIT_SSH_COMMAND = "sleep 2 #";
  const first = post(`/api/repos/${repo.id}/pull`);
  await new Promise((r) => setTimeout(r, 300));
  expect(await post(`/api/repos/${repo.id}/pull`)).toMatchObject({ status: 409, body: { error: "already pulling" } });
  expect((await first).body).toMatchObject({ update: "failed" });

  delete process.env.GIT_SSH_COMMAND;
  await remoteCommits(behind, 1);
  const head = git(behind.repo, "rev-parse", "HEAD");
  const tracking = git(behind.repo, "rev-parse", "origin/main");
  expect((await post(`/api/repos/${id(behind)}/pull`, { origin: "https://example.com" })).status).toBe(403);
  expect((await post("/api/pull", { origin: "https://example.com" })).status).toBe(403);
  expect([git(behind.repo, "rev-parse", "HEAD"), git(behind.repo, "rev-parse", "origin/main")]).toEqual([head, tracking]);
});
