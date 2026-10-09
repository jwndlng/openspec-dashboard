import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { type AppState, createFetchHandler } from "../src/server/api.ts";
import { defaultConfig } from "../src/server/config.ts";
import { configPath } from "../src/server/paths.ts";
import { Scanner } from "../src/server/scanner.ts";
import type { Config, SetupState } from "../src/shared/types.ts";
import { useTempHome } from "./helpers.ts";

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
