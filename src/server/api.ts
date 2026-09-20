import type { Config, DiscoverResult, ScanTriggerResult, SessionEvent } from "../shared/types.ts";
import { ConfigValidationError, saveConfig, validateConfig, validateScanRoots } from "./config.ts";
import { discoverRepos } from "./discover.ts";
import type { Scanner } from "./scanner.ts";
import { SessionError, type SessionManager } from "./sessions/manager.ts";

export interface AppState {
  config: Config;
  scanner: Scanner;
  /** Absent in contexts that never run agent sessions (some tests); the routes then answer 403. */
  sessions?: SessionManager;
}

/** The part of Bun's server object the handler needs: lifting the idle timeout for long-lived event streams. */
export interface ServerLike {
  timeout(req: Request, seconds: number): void;
}

export interface AppOptions {
  state: AppState;
  /** The built single-page UI; served for every non-API path. */
  indexHtml: string;
}

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
export const GUARD_HEADER = "x-openspec-dashboard";

/**
 * Cross-site request protection (design.md D11). Any web page the user visits can send requests to 127.0.0.1, so a
 * mutating request must prove it comes from the dashboard's own UI: a JSON content type and a custom header (neither
 * can be sent cross-origin without a preflight we never approve), a loopback Host (DNS rebinding), and a matching Origin.
 */
export function rejectCrossSite(req: Request, url: URL): Response | undefined {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const deny = (why: string) => json({ error: `request refused: ${why}` }, 403);
  if (!LOOPBACK_HOSTS.has(url.hostname)) return deny("unexpected host");
  const origin = req.headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return deny("malformed origin");
    }
    if (originHost !== url.host) return deny("cross-origin");
  }
  if (req.headers.get(GUARD_HEADER) !== "1") return deny("missing dashboard header");
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return deny("content type must be application/json");
  return undefined;
}

function enabledIds(config: Config): string {
  return config.repos.filter((r) => r.enabled).map((r) => r.id).sort().join(",");
}

async function putConfig(state: AppState, req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "body must be JSON" }, 400);
  }
  let next: Config;
  try {
    next = validateConfig(body);
  } catch (err) {
    if (err instanceof ConfigValidationError) return json({ error: err.message, issues: err.issues }, 400);
    throw err;
  }
  const previous = state.config;
  state.config = await saveConfig(next);
  if (state.config.pollIntervalSeconds !== previous.pollIntervalSeconds) {
    state.scanner.start(); // reschedules and kicks off a scan
  } else if (enabledIds(state.config) !== enabledIds(previous)) {
    state.scanner.trigger();
  }
  return json(state.config);
}

/**
 * Read-only: walks the roots from the body (the UI's unsaved draft) or, without
 * a body, the saved ones. Never touches `state.config`.
 */
async function postDiscover(state: AppState, req: Request): Promise<Response> {
  let roots = state.config.scanRoots;
  const text = await req.text();
  if (text.trim()) {
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: "body must be JSON" }, 400);
    }
    const scanRoots = (body as { scanRoots?: unknown } | null)?.scanRoots;
    if (scanRoots !== undefined) {
      try {
        roots = validateScanRoots(scanRoots);
      } catch (err) {
        if (err instanceof ConfigValidationError) return json({ error: err.message, issues: err.issues }, 400);
        throw err;
      }
    }
  }
  const result: DiscoverResult = await discoverRepos(state.config.repos, roots);
  return json(result);
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    const body = JSON.parse(text);
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    throw new SessionError(400, "body must be JSON");
  }
}

/** Transcript as Server-Sent Events: backlog after `after`/`Last-Event-ID`, then live events, with keep-alives. */
function eventStream(sessions: SessionManager, id: string, afterSeq: number): Response {
  sessions.get(id); // 404 before the stream starts
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let keepAlive: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let last = afterSeq;
      const buffered: SessionEvent[] = [];
      let replaying = true;
      const write = (event: SessionEvent) => {
        if (event.seq <= last) return;
        last = event.seq;
        controller.enqueue(encoder.encode(`id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`));
      };
      unsubscribe = sessions.subscribe(id, (event) => (replaying ? buffered.push(event) : write(event)));
      for (const event of await sessions.events(id, afterSeq)) write(event);
      replaying = false;
      for (const event of buffered) write(event);
      keepAlive = setInterval(() => controller.enqueue(encoder.encode(": keep-alive\n\n")), 15_000);
    },
    cancel() {
      unsubscribe();
      clearInterval(keepAlive);
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" } });
}

async function sessionRoutes(state: AppState, req: Request, url: URL, server?: ServerLike): Promise<Response> {
  const sessions = state.sessions;
  if (!sessions) return json({ error: "agent sessions are not available" }, 403);
  const [, , , id, sub] = url.pathname.split("/"); // /api/sessions/<id>/<sub>
  try {
    if (!id) {
      if (req.method === "GET") return json({ sessions: sessions.list(), agent: await sessions.agentAvailability() });
      if (req.method === "POST") return json(await sessions.open(await readJson(req)), 201);
    } else if (!sub) {
      if (req.method === "GET") return json(sessions.get(id));
      if (req.method === "DELETE") {
        await sessions.remove(id);
        return json({ deleted: true });
      }
    } else if (req.method === "GET" && sub === "events") {
      const after = Number(req.headers.get("last-event-id") ?? url.searchParams.get("after") ?? 0);
      server?.timeout(req, 0); // the default idle timeout would cut a quiet stream
      return eventStream(sessions, id, Number.isFinite(after) ? after : 0);
    } else if (req.method === "GET" && sub === "worktree") {
      return json(await sessions.worktreeStatus(id));
    } else if (req.method === "POST") {
      if (sub === "messages") return json(await sessions.send(id, (await readJson(req)).text));
      if (sub === "stop") return json(await sessions.stop(id));
      if (sub === "cancel") return json(await sessions.cancel(id));
      if (sub === "close") return json(await sessions.close(id, { removeWorktree: (await readJson(req)).removeWorktree === true }));
    }
  } catch (err) {
    if (err instanceof SessionError) return json({ error: err.message }, err.status);
    throw err;
  }
  return json({ error: "not found" }, 404);
}

/** Builds the `fetch` handler for Bun.serve (design.md D8). */
export function createFetchHandler({ state, indexHtml }: AppOptions): (req: Request, server?: ServerLike) => Promise<Response> {
  return async (req, server) => {
    const url = new URL(req.url);
    const { pathname } = url;

    if (pathname.startsWith("/api/")) {
      const refused = rejectCrossSite(req, url);
      if (refused) return refused;
      if (pathname === "/api/sessions" || pathname.startsWith("/api/sessions/")) return sessionRoutes(state, req, url, server);
      if (req.method === "GET" && pathname === "/api/state") return json(state.scanner.snapshot);
      if (req.method === "GET" && pathname === "/api/config") return json(state.config);
      if (req.method === "PUT" && pathname === "/api/config") return putConfig(state, req);
      if (req.method === "POST" && pathname === "/api/discover") return postDiscover(state, req);
      if (req.method === "POST" && pathname === "/api/scan") {
        const result: ScanTriggerResult = { started: state.scanner.trigger().started };
        return json(result);
      }
      return json({ error: "not found" }, 404);
    }

    if (req.method !== "GET" && req.method !== "HEAD") return new Response("method not allowed", { status: 405 });
    return new Response(indexHtml, { headers: { "content-type": "text/html; charset=utf-8" } });
  };
}
