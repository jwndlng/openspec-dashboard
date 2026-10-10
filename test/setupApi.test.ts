import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type AppState, createFetchHandler } from "../src/server/api.ts";
import { defaultConfig, newRepoConfig } from "../src/server/config.ts";
import { configPath, dashboardHome } from "../src/server/paths.ts";
import { Scanner } from "../src/server/scanner.ts";
import type { Config, SetupState } from "../src/shared/types.ts";
import { tempDir, useTempHome } from "./helpers.ts";

let cleanup: () => Promise<void>;
let server: ReturnType<typeof Bun.serve>;
let base: string;
let state: AppState;

/** A mutating request the way the UI sends it: JSON content type, string body as given. */
const send = (path: string, method: string, body?: string, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, { method, body, headers: { "content-type": "application/json", ...headers } });

beforeAll(async () => {
  ({ cleanup } = await useTempHome());
  state = { config: { ...defaultConfig(), setup: "pending" }, scanner: undefined as unknown as Scanner };
  state.scanner = new Scanner(() => state.config, { persist: false });
  server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: createFetchHandler({ state, indexHtml: "<title>stub</title>" }) });
  base = `http://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  state.scanner.stop();
  server.stop(true);
  await cleanup();
});

test("GET /api/setup reports pending, the home directory and suggestions", async () => {
  const res = await fetch(`${base}/api/setup`);
  expect(res.status).toBe(200);
  const body = (await res.json()) as SetupState;
  expect(body.pending).toBe(true);
  expect(typeof body.home).toBe("string");
  expect(Array.isArray(body.suggestedRoots)).toBe(true);
});

test("saving the config does not end setup", async () => {
  const { setup: _, ...withoutFlag } = state.config;
  const res = await send("/api/config", "PUT", JSON.stringify({ ...withoutFlag, pollIntervalSeconds: 30 }));
  expect(res.status).toBe(200);
  expect(((await res.json()) as Config).setup).toBe("pending");
  expect(state.config.pollIntervalSeconds).toBe(30);
});

test("a cross-site request cannot end setup", async () => {
  const res = await send("/api/setup/done", "POST", "{}", { origin: "https://example.com" });
  expect(res.status).toBe(403);
  expect(state.config.setup).toBe("pending");
});

test("POST /api/setup/done clears the flag and keeps the rest", async () => {
  const res = await send("/api/setup/done", "POST", "{}");
  expect(res.status).toBe(200);
  const saved = (await res.json()) as Config;
  expect(saved.setup).toBeUndefined();
  expect(saved.pollIntervalSeconds).toBe(30);
  expect(JSON.parse(await readFile(configPath(), "utf8")).setup).toBeUndefined();
  expect(((await (await fetch(`${base}/api/setup`)).json()) as SetupState).pending).toBe(false);
  // Done twice is fine.
  expect((await send("/api/setup/done", "POST", "{}")).status).toBe(200);
});

test("an old copy cannot restart setup", async () => {
  const res = await send("/api/config", "PUT", JSON.stringify({ ...state.config, setup: "pending" }));
  expect(res.status).toBe(200);
  expect(((await res.json()) as Config).setup).toBeUndefined();
});

test("GET /api/setup names the platform its instructions are for", async () => {
  const body = (await (await fetch(`${base}/api/setup`)).json()) as SetupState;
  expect(["darwin", "linux", "win32"]).toContain(body.platform);
});

describe("POST /api/setup/workspace-folder", () => {
  const create = (path: unknown, headers: Record<string, string> = {}) => send("/api/setup/workspace-folder", "POST", JSON.stringify({ path }), headers);

  test("creates one empty folder and leaves the configuration alone", async () => {
    const parent = await tempDir("osd-wsparent-");
    const before = JSON.stringify(state.config);
    const res = await create(join(parent, "Workspace"));
    expect(res.status).toBe(201);
    expect(((await res.json()) as { path: string }).path).toBe(join(parent, "Workspace"));
    expect(await readdir(join(parent, "Workspace"))).toEqual([]);
    expect(JSON.stringify(state.config)).toBe(before);
    expect(JSON.stringify(await (await fetch(`${base}/api/config`)).json())).toBe(before);
    // Already there: refused, unchanged.
    await writeFile(join(parent, "Workspace", "keep.txt"), "x");
    expect((await create(join(parent, "Workspace"))).status).toBe(409);
    expect(await readdir(join(parent, "Workspace"))).toEqual(["keep.txt"]);
  });

  test("refuses a relative path, a missing parent, a tracked repository, an ignore path and the home", async () => {
    const parent = await tempDir("osd-wsparent-");
    expect((await create("relative/Workspace")).status).toBe(400);
    expect((await create(42)).status).toBe(400);
    const missing = await create(join(parent, "missing-parent", "Workspace"));
    expect(missing.status).toBe(404);
    expect(((await missing.json()) as { error: string }).error).toContain("parent folder");
    expect(existsSync(join(parent, "missing-parent"))).toBe(false);

    const saved = state.config;
    state.config = { ...saved, repos: [{ ...newRepoConfig(parent, true), name: "demo-ops" }], ignorePaths: [] };
    const inRepo = await create(join(parent, "projects"));
    expect(inRepo.status).toBe(409);
    expect(((await inRepo.json()) as { error: string }).error).toContain("demo-ops");
    state.config = { ...saved, ignorePaths: [parent] };
    expect((await create(join(parent, "projects"))).status).toBe(409);
    state.config = saved;
    await mkdir(dashboardHome(), { recursive: true });
    expect((await create(join(dashboardHome(), "Workspace"))).status).toBe(409);
    expect(existsSync(join(parent, "projects"))).toBe(false);
    expect(existsSync(join(dashboardHome(), "Workspace"))).toBe(false);
  });

  test("a cross-site request creates nothing", async () => {
    const parent = await tempDir("osd-wsparent-");
    expect((await create(join(parent, "Workspace"), { origin: "https://example.com" })).status).toBe(403);
    expect(existsSync(join(parent, "Workspace"))).toBe(false);
  });
});
