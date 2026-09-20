import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";
import { createFetchHandler, type AppState } from "../src/server/api.ts";
import { Scanner } from "../src/server/scanner.ts";
import type { Session, SessionEvent } from "../src/shared/types.ts";
import { useTempHome } from "./helpers.ts";
import { harness, recorded, waitFor, type Harness } from "./sessionHelpers.ts";

const UI = { "content-type": "application/json", "x-openspec-dashboard": "1" };
let cleanup: () => Promise<void>;
let home: string;
const servers: { stop: () => Promise<void> }[] = [];

beforeAll(async () => {
  ({ cleanup, home } = await useTempHome());
});
afterEach(async () => {
  delete process.env.FAKE_CLAUDE_MODE;
  delete process.env.FAKE_CLAUDE_RECORD;
  for (const s of servers.splice(0)) await s.stop();
});
afterAll(() => cleanup());

async function serve(h: Harness): Promise<string> {
  const scanner = new Scanner(() => h.config, { persist: false }, h.snapshot);
  const state: AppState = { config: h.config, scanner, sessions: h.manager };
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, idleTimeout: 0, fetch: createFetchHandler({ state, indexHtml: "<title>stub</title>" }) });
  servers.push({ stop: async () => { await h.manager.shutdown(); server.stop(true); } });
  return `http://127.0.0.1:${server.port}`;
}

const post = (url: string, body?: unknown, headers: Record<string, string> = UI) => fetch(url, { method: "POST", headers, body: body === undefined ? undefined : JSON.stringify(body) });

/** Reads Server-Sent Events until `done` says stop, then closes the stream. */
async function readEvents(url: string, done: (events: SessionEvent[]) => boolean, headers: Record<string, string> = {}): Promise<SessionEvent[]> {
  const controller = new AbortController();
  const res = await fetch(url, { headers, signal: controller.signal });
  expect(res.headers.get("content-type")).toContain("text/event-stream");
  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  const events: SessionEvent[] = [];
  let buffer = "";
  const deadline = Date.now() + 8000;
  while (!done(events) && Date.now() < deadline) {
    const { value, done: closed } = await reader.read();
    if (closed) break;
    buffer += decoder.decode(value, { stream: true });
    let sep = buffer.indexOf("\n\n");
    while (sep >= 0) {
      const data = buffer.slice(0, sep).split("\n").find((l) => l.startsWith("data: "));
      if (data) events.push(JSON.parse(data.slice(6)));
      buffer = buffer.slice(sep + 2);
      sep = buffer.indexOf("\n\n");
    }
  }
  controller.abort();
  return events;
}

test("cross-site protection covers every mutating route, old and new", async () => {
  const base = await serve(await harness());
  const body = { repoId: "x", change: "y", action: "implement" };
  for (const [method, path] of [["PUT", "/api/config"], ["POST", "/api/scan"], ["POST", "/api/discover"], ["POST", "/api/sessions"], ["DELETE", "/api/sessions/abc"]] as const) {
    const send = (headers: Record<string, string>) => fetch(base + path, { method, headers, body: method === "DELETE" ? undefined : JSON.stringify(body) });
    expect((await send({ ...UI, origin: "https://example.com" })).status).toBe(403);
    expect((await send({ "content-type": "application/json" })).status).toBe(403);
    expect((await send({ "x-openspec-dashboard": "1", "content-type": "text/plain" })).status).toBe(403);
    expect((await send({ ...UI, origin: base })).status).not.toBe(403);
  }
  expect((await fetch(`${base}/api/state`, { headers: { origin: "https://example.com" } })).status).toBe(200); // reads stay open
});

test("feature disabled: sessions cannot be opened and no process starts", async () => {
  const h = await harness({ enabled: false });
  process.env.FAKE_CLAUDE_RECORD = join(home, "rec-api-off.ndjson");
  const base = await serve(h);
  const res = await post(`${base}/api/sessions`, { repoId: h.repoId, change: "upgrade-runtime", action: "implement" });
  expect(res.status).toBe(403);
  expect((await res.json()).error).toContain("disabled");
  expect(await recorded(process.env.FAKE_CLAUDE_RECORD)).toEqual([]);
  const listing = await (await fetch(`${base}/api/sessions`)).json();
  expect(listing.sessions).toEqual([]);
  expect(listing.agent).toMatchObject({ available: true, version: "9.9.9 (Fake Claude)" });
});

test("refusal status codes", async () => {
  const h = await harness();
  const base = await serve(h);
  const open = (patch: object) => post(`${base}/api/sessions`, { repoId: h.repoId, change: "upgrade-runtime", action: "implement", ...patch });
  expect((await open({ repoId: "000000000000" })).status).toBe(404);
  expect((await open({ change: "no-such-change" })).status).toBe(404);
  expect((await open({ change: "../../etc" })).status).toBe(400);
  expect((await open({ action: "deploy" })).status).toBe(400);
  expect((await open({ change: "add-health-endpoint" })).status).toBe(400);
  expect((await post(`${base}/api/sessions`, undefined)).status).toBe(400);
  expect((await fetch(`${base}/api/sessions/00000000-0000-4000-8000-000000000000`)).status).toBe(404);
  h.config.agentSessions.claudePath = "/nonexistent/claude";
  expect((await open({})).status).toBe(503);
});

test("open, stream, follow up, reconnect without loss, close; state endpoint unchanged", async () => {
  const h = await harness();
  const base = await serve(h);
  const opened = await post(`${base}/api/sessions`, { repoId: h.repoId, change: "upgrade-runtime", action: "implement" });
  expect(opened.status).toBe(201);
  const session = (await opened.json()) as Session;
  const again = (await (await post(`${base}/api/sessions`, { repoId: h.repoId, change: "upgrade-runtime", action: "implement" })).json()) as Session;
  expect(again.id).toBe(session.id);

  const first = await readEvents(`${base}/api/sessions/${session.id}/events`, (e) => e.some((x) => x.kind === "state" && x.state === "waiting"));
  expect(first[0]).toMatchObject({ seq: 1, kind: "user", text: "/opsx:apply upgrade-runtime" });
  expect(first.map((e) => e.seq)).toEqual(first.map((_, i) => i + 1));
  const lastSeq = first.at(-1)?.seq as number;

  expect((await post(`${base}/api/sessions/${session.id}/messages`, { text: "also update the README" })).status).toBe(200);
  expect((await post(`${base}/api/sessions/${session.id}/messages`, { text: "  " })).status).toBe(400);
  const rest = await readEvents(`${base}/api/sessions/${session.id}/events`, (e) => e.some((x) => x.kind === "result"), { "last-event-id": String(lastSeq) });
  expect(rest[0].seq).toBe(lastSeq + 1);
  expect(rest.find((e) => e.kind === "assistant")?.text).toBe("echo: also update the README");
  const viaQuery = await readEvents(`${base}/api/sessions/${session.id}/events?after=${lastSeq}`, (e) => e.length > 0);
  expect(viaQuery[0].seq).toBe(lastSeq + 1);

  await waitFor(async () => ((await (await fetch(`${base}/api/sessions/${session.id}`)).json()) as Session).state === "waiting", "waiting again");
  expect((await fetch(`${base}/api/sessions/${session.id}`, { method: "DELETE", headers: UI })).status).toBe(409); // still open
  const closed = await (await post(`${base}/api/sessions/${session.id}/close`, {})).json();
  expect(closed.session.state).toBe("closed");
  expect((await post(`${base}/api/sessions/${session.id}/messages`, { text: "hello?" })).status).toBe(409);
  expect((await post(`${base}/api/sessions/${session.id}/stop`)).status).toBe(409);
  expect((await fetch(`${base}/api/sessions/${session.id}`, { method: "DELETE", headers: UI })).status).toBe(200);
  expect((await fetch(`${base}/api/sessions/${session.id}`)).status).toBe(404);

  const snapshot = await (await fetch(`${base}/api/state`)).json();
  expect(Object.keys(snapshot).sort()).toEqual(["generatedAt", "repos"]);
});
