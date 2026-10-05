import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { dirname } from "node:path";
import { rm } from "node:fs/promises";
import { type AppState, createFetchHandler } from "../src/server/api.ts";
import { defaultConfig, newRepoConfig } from "../src/server/config.ts";
import { Scanner } from "../src/server/scanner.ts";
import type { PullRequestsResponse } from "../src/shared/types.ts";
import { ghPr, installFakeGh, type GhHarness } from "./ghHelpers.ts";
import { treeFingerprint, useTempHome } from "./helpers.ts";
import { git, tempGitRepo, tempPlainRepo } from "./sessionHelpers.ts";

setDefaultTimeout(60_000);

let cleanupHome: () => Promise<void>;
let gh: GhHarness;
let server: ReturnType<typeof Bun.serve>;
let base: string;
let state: AppState;
let alpha: string;
let beta: string;
let plain: string;
let offline: string;
const roots: string[] = [];

const SCENARIO = {
  login: "demo-user",
  repos: {
    "acme/alpha-infra": { open: [ghPr({ number: 11 }), ghPr({ number: 12 })], closed: [] },
    "acme/beta-soc": { open: [ghPr({ number: 22, url: "https://github.com/acme/beta-soc/pull/22" })], closed: [] },
  },
};

const get = async (path: string) => {
  const res = await fetch(`${base}${path}`);
  return { status: res.status, body: (await res.json()) as PullRequestsResponse & { error?: string } };
};

const post = async (path: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as PullRequestsResponse & { error?: string } };
};

const repoOf = (answer: PullRequestsResponse, id: string) => answer.repos.find((r) => r.repoId === id);

beforeAll(async () => {
  ({ cleanup: cleanupHome } = await useTempHome());
  gh = await installFakeGh(SCENARIO);
  [alpha, beta, plain, offline] = await Promise.all([tempGitRepo(), tempGitRepo(), tempPlainRepo(), tempGitRepo()]);
  roots.push(dirname(alpha), dirname(beta), dirname(plain), dirname(offline));
  git(alpha, "remote", "add", "origin", "https://github.com/acme/alpha-infra.git");
  git(beta, "remote", "add", "origin", "git@github.com:acme/beta-soc.git");
  git(offline, "remote", "add", "origin", "git@gitlab.example.test:acme/offline.git");
  const repos = [newRepoConfig(alpha, true), newRepoConfig(beta, true), newRepoConfig(plain, true), newRepoConfig(offline, true), { ...newRepoConfig(await tempGitRepo(), false) }];
  roots.push(dirname(repos[4].path));
  state = { config: { ...defaultConfig(), repos }, scanner: undefined as unknown as Scanner };
  state.scanner = new Scanner(() => state.config, { persist: false });
  await state.scanner.trigger().done;
  server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: createFetchHandler({ state, indexHtml: "" }) });
  base = `http://127.0.0.1:${server.port}`;
});

afterAll(async () => {
  state.scanner.stop();
  server.stop(true);
  gh.restore();
  for (const root of roots) await rm(root, { recursive: true, force: true });
  await cleanupHome();
});

const id = (path: string) => newRepoConfig(path, true).id;

// ---- routes (3.1) ----

test("GET /api/pull-requests reads the cache and starts no gh", async () => {
  await gh.forget();
  const { status, body } = await get("/api/pull-requests");
  expect(status).toBe(200);
  // Every enabled repository, and only those: the disabled one is not listed.
  expect(body.repos.map((r) => r.repoId)).toEqual([id(alpha), id(beta), id(plain), id(offline)]);
  expect(repoOf(body, id(alpha))?.status).toBe("never");
  expect(repoOf(body, id(plain))).toMatchObject({ status: "unavailable", reason: "not a git repository" });
  expect(repoOf(body, id(offline))).toMatchObject({ status: "unavailable", reason: "not on GitHub" });
  expect(await gh.calls()).toEqual([]);
});

test("POST /api/pull-requests/refresh queries GitHub and answers with the fresh lists", async () => {
  await gh.forget();
  const generatedAt = state.scanner.snapshot.generatedAt;
  const { status, body } = await post("/api/pull-requests/refresh", { force: true });
  expect(status).toBe(200);
  expect(body.viewer).toBe("demo-user");
  expect(repoOf(body, id(alpha))?.pullRequests.map((pr) => pr.number)).toEqual([12, 11]);
  expect(repoOf(body, id(beta))?.pullRequests.map((pr) => pr.number)).toEqual([22]);
  expect(repoOf(body, id(offline))?.status).toBe("unavailable");
  // No scan is triggered by either endpoint.
  expect(state.scanner.snapshot.generatedAt).toBe(generatedAt);
  const calls = await gh.calls();
  expect(calls.filter((c) => c.argv[0] === "pr")).toHaveLength(4);
});

test("a refresh without force leaves a fresh cache alone, and the GET then serves it", async () => {
  await post("/api/pull-requests/refresh", { force: true });
  await gh.forget();
  const refreshed = await post("/api/pull-requests/refresh");
  expect(await gh.calls()).toEqual([]);
  expect(repoOf(refreshed.body, id(alpha))?.status).toBe("ok");
  const read = await get("/api/pull-requests");
  expect(repoOf(read.body, id(alpha))?.pullRequests.map((pr) => pr.number)).toEqual([12, 11]);
  expect(await gh.calls()).toEqual([]);
});

test("refreshing one repository queries only its GitHub repository", async () => {
  await gh.forget();
  const { body } = await post("/api/pull-requests/refresh", { repoId: id(beta), force: true });
  const queried = (await gh.calls()).filter((c) => c.argv[0] === "pr").map((c) => c.argv[c.argv.indexOf("--repo") + 1]);
  expect([...new Set(queried)]).toEqual(["acme/beta-soc"]);
  expect(repoOf(body, id(alpha))?.status).toBe("ok");
});

test("refreshing a set of repositories queries only their GitHub repositories", async () => {
  await gh.forget();
  const { status, body } = await post("/api/pull-requests/refresh", { repoIds: [id(alpha)], force: true });
  expect(status).toBe(200);
  const queried = (await gh.calls()).filter((c) => c.argv[0] === "pr").map((c) => c.argv[c.argv.indexOf("--repo") + 1]);
  expect([...new Set(queried)]).toEqual(["acme/alpha-infra"]);
  expect(repoOf(body, id(beta))?.status).toBe("ok");

  await gh.forget();
  await post("/api/pull-requests/refresh", { repoIds: [id(alpha), id(beta)], force: true });
  const both = (await gh.calls()).filter((c) => c.argv[0] === "pr").map((c) => c.argv[c.argv.indexOf("--repo") + 1]);
  expect([...new Set(both)].sort()).toEqual(["acme/alpha-infra", "acme/beta-soc"]);
});

test("a malformed or unknown set of repositories is refused and starts no gh", async () => {
  await gh.forget();
  expect((await post("/api/pull-requests/refresh", { repoIds: id(alpha) })).status).toBe(400);
  expect((await post("/api/pull-requests/refresh", { repoIds: [id(alpha), 7] })).status).toBe(400);
  expect((await post("/api/pull-requests/refresh", { repoId: id(alpha), repoIds: [id(beta)] })).status).toBe(400);
  expect((await post("/api/pull-requests/refresh", { repoIds: [id(alpha), "nope"] })).status).toBe(404);
  expect((await post("/api/pull-requests/refresh", { repoIds: [state.config.repos[4].id] })).status).toBe(404);
  expect(await gh.calls()).toEqual([]);
});

test("an unknown or disabled repository is refused with 404 and starts no gh", async () => {
  await gh.forget();
  expect((await post("/api/pull-requests/refresh", { repoId: "nope" })).status).toBe(404);
  expect((await post("/api/pull-requests/refresh", { repoId: state.config.repos[4].id })).status).toBe(404);
  expect((await post("/api/pull-requests/refresh", { repoId: 7 })).status).toBe(400);
  expect(await gh.calls()).toEqual([]);
});

test("a refresh from a foreign origin is refused with 403 and starts no gh", async () => {
  await gh.forget();
  const foreign = await post("/api/pull-requests/refresh", { force: true }, { origin: "http://evil.example.test" });
  expect(foreign.status).toBe(403);
  const formPost = await fetch(`${base}/api/pull-requests/refresh`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "force=true" });
  expect(formPost.status).toBe(403);
  expect(await gh.calls()).toEqual([]);
});

// ---- the invariant (3.2) ----

test("scanning, discovery and reading state or the cache start no gh process", async () => {
  await gh.forget();
  await state.scanner.trigger().done;
  await fetch(`${base}/api/state`);
  await fetch(`${base}/api/activity`);
  await post("/api/discover", { scanRoots: roots });
  await get("/api/pull-requests");
  expect(await gh.calls()).toEqual([]);
});

test("a full refresh leaves every repository byte-for-byte unchanged and never runs gh inside one", async () => {
  const watched = [alpha, beta, plain, offline];
  const before = await Promise.all(watched.map(treeFingerprint));
  await gh.forget();
  const { status } = await post("/api/pull-requests/refresh", { force: true });
  expect(status).toBe(200);
  expect(await Promise.all(watched.map(treeFingerprint))).toEqual(before);

  const calls = await gh.calls();
  expect(calls.length).toBeGreaterThan(0);
  for (const call of calls) {
    // Only the two read-only queries the spec allows…
    expect(["pr list", "api user"]).toContain(`${call.argv[0]} ${call.argv[1]}`);
    // …and never with a tracked repository as the working directory.
    for (const repo of watched) expect(call.cwd.startsWith(repo)).toBe(false);
  }
});
