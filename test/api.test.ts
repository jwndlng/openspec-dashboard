import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { type AppState, createFetchHandler, crossSiteRefusal } from "../src/server/api.ts";
import { readSnapshot } from "../src/server/cache.ts";
import { defaultConfig, newRepoConfig } from "../src/server/config.ts";
import { cachePath } from "../src/server/paths.ts";
import { Scanner } from "../src/server/scanner.ts";
import { overviewRows, wipIndicator } from "../src/ui/overviewState.ts";
import { FIXTURES, useTempHome } from "./helpers.ts";

let cleanup: () => Promise<void>;
let server: ReturnType<typeof Bun.serve>;
let base: string;
let state: AppState;

/** A mutating request the way the UI sends it: JSON content type, string body as given. */
const send = (path: string, method: string, body?: string, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, { method, body, headers: { "content-type": "application/json", ...headers } });

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
  const res = await send("/api/config", "PUT", JSON.stringify({ ...defaultConfig(), pollIntervalSeconds: 1 }));
  expect(res.status).toBe(400);
  expect((await res.json()).issues[0]).toContain("pollIntervalSeconds");
  expect(state.config.pollIntervalSeconds).toBe(60);
});

test("enabling a repo persists and triggers a scan that populates state", async () => {
  const repo = newRepoConfig(join(FIXTURES, "demo-ops"), true);
  const res = await send("/api/config", "PUT", JSON.stringify({ ...defaultConfig(), repos: [repo] }));
  expect(res.status).toBe(200);
  expect(state.scanner.scanning).toBe(true);
  expect((await (await send("/api/scan", "POST")).json()).started).toBe(false);
  await state.scanner.trigger().done;
  const snap = await (await fetch(`${base}/api/state`)).json();
  expect(snap.repos[0].name).toBe("demo-ops");
  expect(snap.repos[0].changes.length).toBeGreaterThan(8);
  expect((await (await send("/api/scan", "POST")).json()).started).toBe(true);
  await state.scanner.trigger().done;
});

const discover = (body?: unknown) =>
  send("/api/discover", "POST", body === undefined ? undefined : JSON.stringify(body));

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
  expect((await send("/api/discover", "POST", "{nope")).status).toBe(400);
});

test("discover reports a missing root and still scans the others", async () => {
  const missing = join(FIXTURES, "does-not-exist");
  const res = await discover({ scanRoots: [missing, FIXTURES] });
  expect(res.status).toBe(200);
  const result = await res.json();
  expect(result.errors).toEqual([{ root: missing, message: "does not exist" }]);
  expect(result.candidates.map((r: { name: string }) => r.name)).toEqual(["beta-soc"]);
});

test("mutating requests must come from the dashboard itself", async () => {
  const port = new URL(base).port;
  const before = JSON.stringify(state.config);
  const body = JSON.stringify({ ...defaultConfig(), pollIntervalSeconds: 999 });

  // another web page, a sandboxed frame, a rebinding-style origin on the right port, and the wrong port
  for (const origin of ["https://example.com", "null", `http://evil.example:${port}`, "http://127.0.0.1:1"]) {
    const res = await send("/api/config", "PUT", body, { origin });
    expect([origin, res.status]).toEqual([origin, 403]);
  }
  expect((await send("/api/config", "PUT", body, { "sec-fetch-site": "cross-site" })).status).toBe(403);
  // what a plain HTML form or a no-preflight fetch can send
  for (const type of ["application/x-www-form-urlencoded", "text/plain", "multipart/form-data; boundary=x"]) {
    expect((await fetch(`${base}/api/config`, { method: "PUT", body, headers: { "content-type": type } })).status).toBe(403);
  }
  expect((await fetch(`${base}/api/scan`, { method: "POST" })).status).toBe(403);
  expect(JSON.stringify(state.config)).toBe(before); // refused requests had no effect

  // the UI (either loopback name), and a command-line client that sends no Origin at all
  expect((await send("/api/scan", "POST", undefined, { origin: base })).status).toBe(200);
  expect((await send("/api/scan", "POST", undefined, { origin: `http://localhost:${port}`, "sec-fetch-site": "same-origin" })).status).toBe(200);
  expect((await send("/api/scan", "POST")).status).toBe(200);
  expect((await fetch(`${base}/api/state`, { headers: { origin: "https://example.com" } })).status).toBe(200); // reads stay open
  await state.scanner.trigger().done;
});

test("a request addressed to a non-loopback host name is refused (DNS rebinding)", () => {
  const req = (url: string, headers: Record<string, string>) => new Request(url, { method: "POST", headers: { "content-type": "application/json", ...headers } });
  expect(crossSiteRefusal(req("http://evil.example:4711/api/scan", { origin: "http://evil.example:4711" }))).toContain("loopback");
  expect(crossSiteRefusal(req("http://127.0.0.1:4711/api/scan", { origin: "http://127.0.0.1:4711" }))).toBeUndefined();
  expect(crossSiteRefusal(req("http://localhost:4711/api/scan", {}))).toBeUndefined();
});

test("a snapshot cached before working-tree status existed is served on startup", async () => {
  // What an older version wrote: worktrees as path/branch pairs, the main checkout among them, and no summary.
  const old = {
    generatedAt: "2026-09-01T00:00:00Z",
    repos: [
      {
        id: "abc123",
        name: "alpha-infra",
        path: "/w/acme/alpha-infra",
        ok: true,
        scannedAt: "2026-09-01T00:00:00Z",
        isGit: true,
        currentBranch: "main",
        worktrees: [
          { path: "/w/acme/alpha-infra", branch: "main" },
          { path: "/w/acme/wt/report", branch: "feat/report" },
        ],
        changes: [],
      },
    ],
  };
  await mkdir(dirname(cachePath()), { recursive: true });
  await writeFile(cachePath(), JSON.stringify(old));
  const cached = await readSnapshot();
  const app: AppState = { config: defaultConfig(), scanner: new Scanner(() => defaultConfig(), { persist: false }, cached ?? undefined) };
  const res = await createFetchHandler({ state: app, indexHtml: "" })(new Request("http://127.0.0.1:4711/api/state"));
  expect(res.status).toBe(200);
  const served = await res.json();
  expect(served).toEqual(old);
  expect(served.repos[0].workInProgress).toBeUndefined();
  // …and the overview derives rows from it, without an indicator until the first scan.
  const [row] = overviewRows(served);
  expect(row.workInProgress).toBeUndefined();
  expect(wipIndicator(row.workInProgress)).toBeUndefined();
});
