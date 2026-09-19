import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";
import { createFetchHandler, type AppState } from "../src/server/api.ts";
import { defaultConfig, newRepoConfig } from "../src/server/config.ts";
import { Scanner } from "../src/server/scanner.ts";
import { FIXTURES, useTempHome } from "./helpers.ts";

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

test("fresh install: empty state, default config, UI fallback", async () => {
  const stateRes = await (await fetch(`${base}/api/state`)).json();
  expect(stateRes.repos).toEqual([]);
  const config = await (await fetch(`${base}/api/config`)).json();
  expect(config.port).toBe(4711);
  const html = await fetch(`${base}/settings`);
  expect(html.headers.get("content-type")).toContain("text/html");
  expect(await html.text()).toContain("stub");
  expect((await fetch(`${base}/api/nope`)).status).toBe(404);
});

test("invalid config is rejected and unchanged", async () => {
  const res = await fetch(`${base}/api/config`, { method: "PUT", body: JSON.stringify({ ...defaultConfig(), pollIntervalSeconds: 1 }) });
  expect(res.status).toBe(400);
  expect((await res.json()).issues[0]).toContain("pollIntervalSeconds");
  expect(state.config.pollIntervalSeconds).toBe(60);
});

test("enabling a repo persists and triggers a scan that populates state", async () => {
  const repo = newRepoConfig(join(FIXTURES, "demo-ops"), true);
  const res = await fetch(`${base}/api/config`, { method: "PUT", body: JSON.stringify({ ...defaultConfig(), repos: [repo] }) });
  expect(res.status).toBe(200);
  expect(state.scanner.scanning).toBe(true);
  expect((await (await fetch(`${base}/api/scan`, { method: "POST" })).json()).started).toBe(false);
  await state.scanner.trigger().done;
  const snap = await (await fetch(`${base}/api/state`)).json();
  expect(snap.repos[0].name).toBe("demo-ops");
  expect(snap.repos[0].changes.length).toBeGreaterThan(8);
  expect((await (await fetch(`${base}/api/scan`, { method: "POST" })).json()).started).toBe(true);
  await state.scanner.trigger().done;
});

const discover = (body?: unknown) =>
  fetch(`${base}/api/discover`, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

test("discover uses saved roots, returns only unconfigured repos and persists nothing", async () => {
  state.config = { ...state.config, scanRoots: [FIXTURES] };
  const before = structuredClone(state.config);
  const result = await (await discover()).json();
  expect(result.errors).toEqual([]);
  // demo-ops was configured by the previous test, so only the other fixture is a candidate
  expect(result.candidates).toEqual([newRepoConfig(join(FIXTURES, "beta-soc"), false)]);
  expect(state.config).toEqual(before);
  const config = await (await fetch(`${base}/api/config`)).json();
  expect(config.repos.length).toBe(1);
});

test("discover takes roots from the body without saving them", async () => {
  state.config = { ...state.config, scanRoots: [] };
  expect((await (await discover()).json()).candidates).toEqual([]);
  const result = await (await discover({ scanRoots: [FIXTURES] })).json();
  expect(result.candidates.map((r: { name: string }) => r.name)).toEqual(["beta-soc"]);
  expect((await (await fetch(`${base}/api/config`)).json()).scanRoots).toEqual([]);
});

test("discover rejects relative roots and malformed bodies", async () => {
  const res = await discover({ scanRoots: ["relative/path"] });
  expect(res.status).toBe(400);
  expect((await res.json()).issues[0]).toContain("scanRoots.0");
  expect((await fetch(`${base}/api/discover`, { method: "POST", body: "{nope" })).status).toBe(400);
});

test("discover reports a missing root and still scans the others", async () => {
  const missing = join(FIXTURES, "does-not-exist");
  const res = await discover({ scanRoots: [missing, FIXTURES] });
  expect(res.status).toBe(200);
  const result = await res.json();
  expect(result.errors).toEqual([{ root: missing, message: "does not exist" }]);
  expect(result.candidates.map((r: { name: string }) => r.name)).toEqual(["beta-soc"]);
});
