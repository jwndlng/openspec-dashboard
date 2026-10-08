import { afterAll, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { appHome, configuredPortFor, DEFAULT_PORT, portHome } from "../../desktop/src/logic/home.ts";
import { decideStart, listeningPort, probeVersion, waitForServer } from "../../desktop/src/logic/start.ts";
import { configuredPort } from "../../src/server/config.ts";
import { tempDir } from "../helpers.ts";

const dirs: string[] = [];
async function dir(): Promise<string> {
  const d = await tempDir("sc-desktop-");
  dirs.push(d);
  return d;
}
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

const body = (value: unknown) => ({ kind: "answered" as const, status: 200, body: JSON.stringify(value) });

test("a Spec Control answer attaches, naming its version", () => {
  expect(decideStart(body({ name: "spec-control", version: "v0.9.0" }), 4711)).toEqual({ action: "attach", version: "v0.9.0" });
});

test("a refused connection starts the bundled binary", () => {
  expect(decideStart({ kind: "refused" }, 4711)).toEqual({ action: "start" });
});

test("anything else on the port blocks, naming the port", () => {
  for (const probe of [
    body({ name: "something-else", version: "1" }),
    { kind: "answered" as const, status: 200, body: "<html>hello</html>" },
    { kind: "answered" as const, status: 404, body: JSON.stringify({ name: "spec-control", version: "v1" }) },
    { kind: "timeout" as const },
    { kind: "failed" as const, message: "socket hang up" },
  ]) {
    const decision = decideStart(probe, 4711);
    expect(decision.action).toBe("blocked");
    expect(decision).toMatchObject({ port: 4711 });
  }
});

test("probing a real socket: Spec Control, refused, foreign, and silent", async () => {
  const spec = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => Response.json({ name: "spec-control", version: "dev" }) });
  const foreign = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("not us") });
  const silent = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Promise<Response>(() => {}) });
  const closed = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("") });
  const closedPort = closed.port as number;
  closed.stop(true);
  try {
    expect(decideStart(await probeVersion(spec.port as number), 0).action).toBe("attach");
    expect(decideStart(await probeVersion(foreign.port as number), 0).action).toBe("blocked");
    expect(await probeVersion(closedPort)).toEqual({ kind: "refused" });
    expect(await probeVersion(silent.port as number, 100)).toEqual({ kind: "timeout" });
  } finally {
    spec.stop(true);
    foreign.stop(true);
    silent.stop(true);
  }
});

test("the configured port follows the server's own rule, out-of-range values meaning the default", async () => {
  const home = await dir();
  const cases: [unknown, number][] = [
    [5000, 5000],
    [1024, 1024],
    [65535, 65535],
    [1023, DEFAULT_PORT],
    [65536, DEFAULT_PORT],
    [0, DEFAULT_PORT],
    [4711.5, DEFAULT_PORT],
    ["5000", DEFAULT_PORT],
    [undefined, DEFAULT_PORT],
  ];
  for (const [port, expected] of cases) {
    await writeFile(join(home, "config.json"), JSON.stringify({ port }));
    expect(await configuredPortFor(home)).toBe(expected);
    expect(await configuredPort(home)).toBe(expected);
  }
  await writeFile(join(home, "config.json"), "{ not json");
  expect(await configuredPortFor(home)).toBe(DEFAULT_PORT);
  expect(await configuredPortFor(join(home, "missing"))).toBe(DEFAULT_PORT);
});

test("the port is read from the home the server reads it from", async () => {
  const userHome = await dir();
  expect(await portHome({ env: { SPEC_CONTROL_HOME: "/w/explicit" }, userHome })).toBe("/w/explicit");
  expect(await portHome({ env: {}, userHome })).toBe(join(userHome, ".openspec-dashboard"));
  await mkdir(join(userHome, ".spec-control"));
  await writeFile(join(userHome, ".spec-control", "config.json"), "{}");
  expect(await portHome({ env: {}, userHome })).toBe(join(userHome, ".spec-control"));
});

test("the app writes no home of its own while only the pre-rename home exists", async () => {
  const userHome = await dir();
  expect(await appHome({ env: {}, userHome })).toBe(join(userHome, ".spec-control"));
  await mkdir(join(userHome, ".openspec-dashboard"));
  expect(await appHome({ env: {}, userHome })).toBeUndefined();
  expect(await appHome({ env: { SPEC_CONTROL_HOME: "/w/explicit" }, userHome })).toBe("/w/explicit");
  await mkdir(join(userHome, ".spec-control"));
  expect(await appHome({ env: {}, userHome })).toBe(join(userHome, ".spec-control"));
});

test("the listening line names the port", () => {
  expect(listeningPort("migrated\nspec-control listening on http://127.0.0.1:4712\n")).toBe(4712);
  expect(listeningPort("warning: something")).toBeUndefined();
});

test("waiting for the server: ready, exited, timeout", async () => {
  let calls = 0;
  const ready = await waitForServer({
    port: 1,
    exited: () => false,
    intervalMs: 1,
    probe: async () => (++calls < 3 ? { kind: "refused" } : body({ name: "spec-control", version: "dev" })),
  });
  expect(ready).toBe("ready");
  expect(calls).toBe(3);
  expect(await waitForServer({ port: 1, exited: () => true, probe: async () => ({ kind: "refused" }) })).toBe("exited");
  expect(await waitForServer({ port: 1, exited: () => false, timeoutMs: 20, intervalMs: 5, probe: async () => ({ kind: "refused" }) })).toBe("timeout");
});
