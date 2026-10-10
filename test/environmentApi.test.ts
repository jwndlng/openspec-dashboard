import { afterAll, beforeAll, expect, test } from "bun:test";
import { type AppState, createFetchHandler } from "../src/server/api.ts";
import { defaultConfig, newRepoConfig } from "../src/server/config.ts";
import { resetEnvironmentCache } from "../src/server/environment.ts";
import { Scanner } from "../src/server/scanner.ts";
import type { EnvironmentReport } from "../src/shared/types.ts";
import { FIXTURES, treeFingerprint, useTempHome } from "./helpers.ts";
import { join } from "node:path";

let cleanup: () => Promise<void>;
let server: ReturnType<typeof Bun.serve>;
let base: string;
let state: AppState;

beforeAll(async () => {
  ({ cleanup } = await useTempHome());
  state = { config: defaultConfig(), scanner: undefined as unknown as Scanner };
  state.scanner = new Scanner(() => state.config, { persist: false });
  server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: createFetchHandler({ state, indexHtml: "<title>stub</title>" }) });
  base = `http://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  state.scanner.stop();
  server.stop(true);
  await cleanup();
});

// 3.1 — the endpoint's shape.
test("GET /api/environment returns the report", async () => {
  resetEnvironmentCache();
  const res = await fetch(`${base}/api/environment`);
  expect(res.status).toBe(200);
  const report = (await res.json()) as EnvironmentReport;
  expect(Date.parse(report.checkedAt)).toBeGreaterThan(0);
  expect(["ok", "warning", "problem", "not-needed"]).toContain(report.status);
  expect(report.checks.length).toBeGreaterThan(0);
  for (const check of report.checks) {
    expect(typeof check.id).toBe("string");
    expect(typeof check.label).toBe("string");
    expect(["ok", "warning", "problem", "not-needed"]).toContain(check.status);
    expect(typeof check.found).toBe("string");
  }
  expect(report.checks.map((c) => c.id)).toContain("dashboard-home");
});

test("force asks for a fresh report", async () => {
  resetEnvironmentCache();
  const first = (await (await fetch(`${base}/api/environment`)).json()) as EnvironmentReport;
  // The clock has to move for `checkedAt` to be able to differ at all; then a memoised report still carries the old one.
  await Bun.sleep(2);
  const again = (await (await fetch(`${base}/api/environment`)).json()) as EnvironmentReport;
  expect(again.checkedAt).toBe(first.checkedAt);
  const forced = (await (await fetch(`${base}/api/environment?force=1`)).json()) as EnvironmentReport;
  expect(Date.parse(forced.checkedAt)).toBeGreaterThan(Date.parse(first.checkedAt));
});

// 3.2 — nothing mutating, nothing touched.
test("POST /api/environment is not a route and computes nothing", async () => {
  const before = (await (await fetch(`${base}/api/environment`)).json()) as EnvironmentReport;
  const res = await fetch(`${base}/api/environment`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
  });
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: "not found" });
  // A computation would have replaced the cached report; the same one still comes back.
  const after = (await (await fetch(`${base}/api/environment`)).json()) as EnvironmentReport;
  expect(after.checkedAt).toBe(before.checkedAt);
});

test("a request with repositories tracked leaves them untouched", async () => {
  const repo = join(FIXTURES, "demo-ops");
  state.config = { ...defaultConfig(), repos: [newRepoConfig(repo)] };
  resetEnvironmentCache();
  const before = await treeFingerprint(repo);
  const report = (await (await fetch(`${base}/api/environment?force=1`)).json()) as EnvironmentReport;
  expect(report.checks.length).toBeGreaterThan(0);
  expect(await treeFingerprint(repo)).toBe(before);
  // Nothing in the report points into a tracked repository either.
  expect(JSON.stringify(report)).not.toContain(repo);
  state.config = defaultConfig();
});

// The setup view (dashboard-api: environment endpoint).
test("view=setup has no agent check and judges nothing not-needed while agent sessions are off", async () => {
  resetEnvironmentCache();
  const config = defaultConfig();
  state.config = {
    ...config,
    agentSessions: { ...config.agentSessions, enabled: false, agents: [...config.agentSessions.agents, { id: "codex", name: "Codex", command: ["codex", "{prompt}"], prompts: {} }] },
  };
  try {
    const res = await fetch(`${base}/api/environment?view=setup`);
    expect(res.status).toBe(200);
    const report = (await res.json()) as EnvironmentReport;
    expect(report.checks.some((c) => c.id.startsWith("agent:"))).toBe(false);
    for (const id of ["github-cli", "git-identity"]) expect(report.checks.find((c) => c.id === id)?.status).not.toBe("not-needed");
    const settings = (await (await fetch(`${base}/api/environment`)).json()) as EnvironmentReport;
    expect(settings.checks.filter((c) => c.id.startsWith("agent:")).length).toBe(2);
  } finally {
    state.config = defaultConfig();
  }
});

test("another view is refused with 400", async () => {
  const res = await fetch(`${base}/api/environment?view=everything`);
  expect(res.status).toBe(400);
});
