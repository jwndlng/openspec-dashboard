import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { readFileSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { type AppState, createFetchHandler } from "../src/server/api.ts";
import { defaultConfig, newRepoConfig } from "../src/server/config.ts";
import { Scanner } from "../src/server/scanner.ts";
import type { RepoIssues } from "../src/shared/types.ts";
import { ghIssue, installFakeGh, type GhHarness } from "./ghHelpers.ts";
import { treeFingerprint, useTempHome } from "./helpers.ts";
import { git, tempGitRepo, tempPlainRepo } from "./sessionHelpers.ts";

setDefaultTimeout(60_000);

let cleanupHome: () => Promise<void>;
let gh: GhHarness;
let server: ReturnType<typeof Bun.serve>;
let base: string;
let state: AppState;
let alpha: string;
let plain: string;
let offline: string;
let disabledId: string;
const roots: string[] = [];

const SCENARIO = { issues: { "acme/alpha-infra": [ghIssue({ number: 12 }), ghIssue({ number: 15 })] } };

const idOf = (path: string) => state.config.repos.find((r) => r.path === path)?.id ?? "";

const post = async (path: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as RepoIssues & { error?: string; name?: string; staged?: boolean } };
};

beforeAll(async () => {
  ({ cleanup: cleanupHome } = await useTempHome());
  gh = await installFakeGh(SCENARIO);
  [alpha, plain, offline] = await Promise.all([tempGitRepo(), tempPlainRepo(), tempGitRepo()]);
  roots.push(dirname(alpha), dirname(plain), dirname(offline));
  git(alpha, "remote", "add", "origin", "https://github.com/acme/alpha-infra.git");
  git(offline, "remote", "add", "origin", "git@gitlab.example.test:acme/offline.git");
  const disabled = newRepoConfig(await tempGitRepo(), false);
  roots.push(dirname(disabled.path));
  disabledId = disabled.id;
  state = { config: { ...defaultConfig(), repos: [newRepoConfig(alpha, true), newRepoConfig(plain, true), newRepoConfig(offline, true), disabled] }, scanner: undefined as unknown as Scanner };
  state.scanner = new Scanner(() => state.config, { persist: false });
  await state.scanner.trigger().done;
  server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: createFetchHandler({ state, indexHtml: "" }) });
  base = `http://127.0.0.1:${server.port}`;
});

afterAll(async () => {
  server.stop(true);
  gh.restore();
  for (const root of roots) await rm(root, { recursive: true, force: true });
  await cleanupHome();
});

test("POST /api/repos/<id>/issues lists the open issues with one gh issue list", async () => {
  await gh.forget();
  const { status, body } = await post(`/api/repos/${encodeURIComponent(idOf(alpha))}/issues`);
  expect(status).toBe(200);
  expect(body).toMatchObject({ status: "ok", github: "acme/alpha-infra" });
  expect(body.issues.map((i) => i.number).sort()).toEqual([12, 15]);
  const calls = await gh.calls();
  expect(calls.map((c) => `${c.argv[0]} ${c.argv[1]}`)).toEqual(["issue list"]);
});

test("a repository off GitHub or without git is unavailable and starts no gh", async () => {
  await gh.forget();
  expect((await post(`/api/repos/${encodeURIComponent(idOf(offline))}/issues`)).body).toMatchObject({ status: "unavailable", reason: "not on GitHub" });
  expect((await post(`/api/repos/${encodeURIComponent(idOf(plain))}/issues`)).body).toMatchObject({ status: "unavailable" });
  expect(await gh.calls()).toEqual([]);
});

test("an unknown or disabled repository is refused with 404 and starts no gh", async () => {
  await gh.forget();
  expect((await post("/api/repos/nope/issues")).status).toBe(404);
  expect((await post(`/api/repos/${encodeURIComponent(disabledId)}/issues`)).status).toBe(404);
  expect(await gh.calls()).toEqual([]);
});

test("a request from a foreign origin is refused with 403 and starts no gh", async () => {
  await gh.forget();
  const foreign = await post(`/api/repos/${encodeURIComponent(idOf(alpha))}/issues`, undefined, { origin: "http://evil.example.test" });
  expect(foreign.status).toBe(403);
  expect(await gh.calls()).toEqual([]);
});

test("scans, state, the pull-request cache and a pull-request refresh never run gh issue list", async () => {
  await gh.forget();
  await state.scanner.trigger().done;
  await fetch(`${base}/api/state`);
  await fetch(`${base}/api/pull-requests`);
  expect(await gh.calls()).toEqual([]);
  await post("/api/pull-requests/refresh", { force: true });
  for (const call of await gh.calls()) expect(`${call.argv[0]} ${call.argv[1]}`).not.toBe("issue list");
});

test("listing issues leaves every repository byte-for-byte unchanged and never runs gh inside one", async () => {
  const watched = [alpha, plain, offline];
  const before = await Promise.all(watched.map(treeFingerprint));
  await gh.forget();
  await post(`/api/repos/${encodeURIComponent(idOf(alpha))}/issues`);
  expect(await Promise.all(watched.map(treeFingerprint))).toEqual(before);
  for (const call of await gh.calls()) for (const root of watched) expect(call.cwd.startsWith(root)).toBe(false);
});

// ---- importing: the create route with an issue (3.1, 3.2) ----

test("importing an issue creates the change with issue.yaml, stages exactly its three files and starts no gh", async () => {
  const id = encodeURIComponent(idOf(alpha));
  const headBefore = git(alpha, "rev-parse", "HEAD");
  const refsBefore = git(alpha, "for-each-ref");
  await gh.forget();
  const { status, body } = await post(`/api/repos/${id}/changes`, {
    name: "retry-webhooks",
    prompt: "## Retry webhook delivery\n\nImported from acme/alpha-infra#42",
    issue: { number: 42, title: "Retry webhook delivery" },
  });
  expect(status).toBe(201);
  expect(body).toMatchObject({ name: "retry-webhooks", staged: true });
  expect(await gh.calls()).toEqual([]);
  const text = await readFile(join(alpha, "openspec", "changes", "retry-webhooks", "issue.yaml"), "utf8");
  expect(text).toContain("github: acme/alpha-infra");
  expect(text).toContain("number: 42");
  expect(text).toContain("title: Retry webhook delivery");
  const porcelain = git(alpha, "status", "--porcelain", "--untracked-files=all").split("\n").filter(Boolean).sort();
  expect(porcelain).toEqual([
    "A  openspec/changes/retry-webhooks/.openspec.yaml",
    "A  openspec/changes/retry-webhooks/issue.yaml",
    "A  openspec/changes/retry-webhooks/prompt.md",
  ]);
  expect(git(alpha, "rev-parse", "HEAD")).toBe(headBefore);
  expect(git(alpha, "for-each-ref")).toBe(refsBefore);

  await state.scanner.trigger().done;
  const change = state.scanner.snapshot.repos.find((r) => r.path === alpha)?.changes.find((c) => c.name === "retry-webhooks");
  expect(change?.sourceIssue).toEqual({ github: "acme/alpha-infra", number: 42, title: "Retry webhook delivery" });
  expect(change?.column).toBe("Backlog");
});

test("an issue for a repository off GitHub is refused with 409, an invalid one with 400, and nothing is written", async () => {
  const offlineId = encodeURIComponent(idOf(offline));
  const index = readFileSync(join(offline, ".git", "index"));
  const before = await treeFingerprint(offline);
  expect((await post(`/api/repos/${offlineId}/changes`, { name: "from-issue", issue: { number: 1 } })).status).toBe(409);
  for (const issue of [{ number: 0 }, { number: "42" }, { number: 1.5 }, { number: 1, title: "x".repeat(257) }, "42", [1]]) {
    expect((await post(`/api/repos/${offlineId}/changes`, { name: "from-issue", issue })).status).toBe(400);
  }
  expect(await treeFingerprint(offline)).toEqual(before);
  expect(readFileSync(join(offline, ".git", "index")).equals(index)).toBe(true);
});
