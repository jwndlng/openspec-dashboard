import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { realpathSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type AppState, createFetchHandler } from "../src/server/api.ts";
import { defaultConfig, newRepoConfig, repoId, saveConfig } from "../src/server/config.ts";
import { configPath } from "../src/server/paths.ts";
import type { Config } from "../src/shared/types.ts";
import { tempDir, useTempHome } from "./helpers.ts";

let cleanup: () => Promise<void>;
let server: ReturnType<typeof Bun.serve>;
let base: string;
let state: AppState;
let work: string;
let triggered = 0;

/** A workspace root: two OpenSpec projects, one git repository without OpenSpec, and a mirror below an ignore path. */
const paths = () => ({
  alpha: join(work, "acme", "alpha-infra"),
  beta: join(work, "acme", "beta-soc"),
  plain: join(work, "acme", "chat-groups"),
  mirrored: join(work, "mirror", "beta-soc"),
});

const send = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
const saved = async (): Promise<Config> => JSON.parse(await readFile(configPath(), "utf8"));

beforeAll(async () => {
  ({ cleanup } = await useTempHome());
  work = realpathSync.native(await tempDir());
  const { alpha, beta, plain, mirrored } = paths();
  for (const dir of [alpha, beta, mirrored]) {
    await mkdir(join(dir, "openspec"), { recursive: true });
    await writeFile(join(dir, "openspec", "config.yaml"), "schema: spec-driven\n");
  }
  await mkdir(join(plain, ".git"), { recursive: true });
  state = {
    config: defaultConfig(),
    scanner: {
      trigger: () => {
        triggered++;
        return { started: true, done: Promise.resolve() };
      },
      start: () => undefined,
    } as unknown as AppState["scanner"],
  };
  server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: createFetchHandler({ state, indexHtml: "" }) });
  base = `http://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  server.stop(true);
  await rm(work, { recursive: true, force: true });
  await cleanup();
});
beforeEach(async () => {
  // alpha-infra is tracked, renamed and disabled; the mirror is ignored.
  const alpha = { ...newRepoConfig(paths().alpha, false), name: "Alpha" };
  state.config = await saveConfig({ ...defaultConfig(), scanRoots: [work], ignorePaths: [join(work, "mirror")], repos: [alpha] });
  triggered = 0;
});

test("tracking a candidate adds it enabled with its default name and starts a scan", async () => {
  const res = await send("/api/repos/track", { path: paths().beta });
  expect(res.status).toBe(200);
  const config: Config = await res.json();
  expect(config.repos.find((r) => r.path === paths().beta)).toEqual(newRepoConfig(paths().beta, true));
  expect(await saved()).toEqual(config);
  expect(triggered).toBe(1);
});

test("tracking a configured repository re-enables it and keeps its name", async () => {
  const res = await send("/api/repos/track", { path: paths().alpha });
  expect(res.status).toBe(200);
  expect((await saved()).repos).toEqual([{ ...newRepoConfig(paths().alpha, true), name: "Alpha" }]);
  expect(triggered).toBe(1);
});

test("a colliding default name is disambiguated, as for any enabled candidate", async () => {
  state.config = await saveConfig({ ...state.config, ignorePaths: [], repos: [{ ...newRepoConfig(paths().beta, true) }] });
  expect((await send("/api/repos/track", { path: paths().mirrored })).status).toBe(200);
  expect((await saved()).repos.find((r) => r.path === paths().mirrored)?.name).toBe("beta-soc (mirror)");
});

test("only a path discovery offers can be tracked", async () => {
  const before = await saved();
  for (const path of [paths().plain, paths().mirrored, join(work, "nowhere"), "/"]) {
    const res = await send("/api/repos/track", { path });
    expect([path, res.status]).toEqual([path, 404]);
  }
  expect((await send("/api/repos/track", { path: "acme/beta-soc" })).status).toBe(400);
  expect((await send("/api/repos/track", "{nope")).status).toBe(400);
  expect(await saved()).toEqual(before);
  expect(triggered).toBe(0);
});

test("a repository is disabled and enabled by id, keeping its name", async () => {
  const id = repoId(paths().alpha);
  expect((await send(`/api/repos/${id}/enabled`, { enabled: true })).status).toBe(200);
  expect((await saved()).repos[0]).toMatchObject({ enabled: true, name: "Alpha" });
  expect((await send(`/api/repos/${id}/enabled`, { enabled: false })).status).toBe(200);
  expect((await saved()).repos[0]).toMatchObject({ enabled: false, name: "Alpha" });
  expect(triggered).toBe(2);
});

test("an unknown id or a non-boolean is refused and changes nothing", async () => {
  const before = await saved();
  expect((await send("/api/repos/000000000000/enabled", { enabled: true })).status).toBe(404);
  expect((await send(`/api/repos/${repoId(paths().alpha)}/enabled`, { enabled: "yes" })).status).toBe(400);
  expect(await saved()).toEqual(before);
});

test("an ignore path is stored canonically, once, and leaves configured repositories alone", async () => {
  const res = await send("/api/ignore-paths", { path: `${join(work, "acme")}/` });
  expect(res.status).toBe(200);
  expect((await saved()).ignorePaths).toEqual([join(work, "mirror"), join(work, "acme")]);
  expect((await send("/api/ignore-paths", { path: join(work, "acme") })).status).toBe(200);
  const config = await saved();
  expect(config.ignorePaths).toEqual([join(work, "mirror"), join(work, "acme")]);
  expect(config.repos.map((r) => r.path)).toEqual([paths().alpha]);
  expect(triggered).toBe(0);
});

test("a relative ignore path is refused", async () => {
  const before = await saved();
  expect((await send("/api/ignore-paths", { path: "mirror" })).status).toBe(400);
  expect((await send("/api/ignore-paths", {})).status).toBe(400);
  expect(await saved()).toEqual(before);
});

test("a track and a disable arriving together both persist", async () => {
  state.config = await saveConfig({ ...state.config, repos: [{ ...newRepoConfig(paths().alpha, true), name: "Alpha" }] });
  const [track, disable] = await Promise.all([
    send("/api/repos/track", { path: paths().beta }),
    send(`/api/repos/${repoId(paths().alpha)}/enabled`, { enabled: false }),
  ]);
  expect([track.status, disable.status]).toEqual([200, 200]);
  const config = await saved();
  expect(config.repos.map((r) => [r.path, r.enabled])).toEqual([
    [paths().alpha, false],
    [paths().beta, true],
  ]);
  expect(state.config).toEqual(config);
});

test("the tracking routes are refused cross-site and change nothing", async () => {
  const before = await saved();
  const routes: [string, unknown][] = [
    ["/api/repos/track", { path: paths().beta }],
    [`/api/repos/${repoId(paths().alpha)}/enabled`, { enabled: true }],
    ["/api/ignore-paths", { path: join(work, "acme") }],
  ];
  for (const [path, body] of routes) {
    expect((await send(path, body, { origin: "https://example.com" })).status).toBe(403);
    expect((await fetch(`${base}${path}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "text/plain" } })).status).toBe(403);
  }
  expect(await saved()).toEqual(before);
  expect(triggered).toBe(0);
});
