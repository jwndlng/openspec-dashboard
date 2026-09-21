import type { Config, DiscoverResult, RepoConfig, ScanTriggerResult, SharedConfigApplyResult, SharedConfigAssignment, SharedConfigPreview } from "../shared/types.ts";
import { ConfigValidationError, saveConfig, validateConfig, validateScanRoots } from "./config.ts";
import { discoverRepos } from "./discover.ts";
import type { Scanner } from "./scanner.ts";
import { applyTo, EMPTY_SHARED_CONFIG, loadSharedConfig, previewFor, SharedConfigValidationError, saveSharedConfig } from "./sharedConfig.ts";
import { SessionError, type SessionManager } from "./sessions/manager.ts";

export interface AppState {
  config: Config;
  scanner: Scanner;
  /** Absent in contexts that never run agent sessions (some tests); the routes then answer 403. */
  sessions?: SessionManager;
}

/** The part of Bun's server object the handler needs: upgrading the terminal request to a WebSocket. */
export interface ServerLike {
  upgrade(req: Request, options: { data: unknown }): boolean;
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

/**
 * The terminal WebSocket is the most sensitive endpoint: whoever holds it types into an agent on this machine.
 * A WebSocket handshake is a GET that browsers allow cross-origin and that carries no preflight, so the JSON guard
 * does not apply; instead the handshake must carry the dashboard's own Origin (browsers always send one and pages
 * cannot forge it) and address a loopback host name (DNS rebinding).
 */
export function webSocketRefusal(req: Request): string | undefined {
  const url = new URL(req.url);
  if (!LOOPBACK_HOSTS.has(url.hostname)) return "request must be addressed to a loopback host name";
  if (req.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") return "cross-site requests are not allowed";
  const origin = req.headers.get("origin");
  const from = origin && URL.canParse(origin) ? new URL(origin) : undefined;
  if (!(from?.protocol === "http:" && LOOPBACK_HOSTS.has(from.hostname) && from.port === url.port)) return "origin is not the dashboard";
  return undefined;
}

export interface TerminalSocketData {
  sessionId: string;
  detach?: () => void;
}

/** Minimal shape of Bun's ServerWebSocket that the handlers use. */
interface TerminalSocket {
  data: TerminalSocketData;
  send(data: string | Uint8Array): unknown;
  close(code?: number, reason?: string): void;
}

/**
 * Wire format: server → client binary frames are raw terminal output (first the scrollback), and one text frame
 * `{"type":"exit"}` when the process ends; client → server text frames are `{"type":"input","data":…}` (keystrokes,
 * passed on unobserved), `{"type":"resize","cols":…,"rows":…}` and `{"type":"submit","data":…}` — text sent on the
 * user's behalf, answered to that socket with `{"type":"submitted","ok":…}` (`false`: typed, but Enter was withheld).
 */
export function createWebSocketHandlers(state: AppState) {
  return {
    async open(ws: TerminalSocket) {
      const sessions = state.sessions;
      if (!sessions) return ws.close(1011, "agent sessions are not available");
      try {
        const { scrollback, detach } = await sessions.attach(ws.data.sessionId, (chunk) => {
          if (chunk.length === 0) ws.send(JSON.stringify({ type: "exit" }));
          else ws.send(chunk);
        });
        ws.data.detach = detach;
        if (scrollback.length > 0) ws.send(scrollback);
        if (sessions.get(ws.data.sessionId).state !== "running") ws.send(JSON.stringify({ type: "exit" }));
      } catch {
        ws.close(1008, "unknown session");
      }
    },
    message(ws: TerminalSocket, message: string | Uint8Array) {
      if (typeof message !== "string" || !state.sessions) return;
      let parsed: { type?: unknown; data?: unknown; cols?: unknown; rows?: unknown };
      try {
        parsed = JSON.parse(message);
      } catch {
        return;
      }
      if (parsed.type === "input" && typeof parsed.data === "string") state.sessions.write(ws.data.sessionId, parsed.data);
      else if (parsed.type === "submit") {
        const answer = (ok: boolean) => ws.send(JSON.stringify({ type: "submitted", ok }));
        try {
          state.sessions.submit(ws.data.sessionId, parsed.data).then(
            (result) => answer(result.submitted),
            () => answer(false),
          );
        } catch {
          answer(false); // not running, or not plain text
        }
      }
      else if (parsed.type === "resize" && typeof parsed.cols === "number" && typeof parsed.rows === "number") state.sessions.resize(ws.data.sessionId, parsed.cols, parsed.rows);
    },
    close(ws: TerminalSocket) {
      ws.data.detach?.();
    },
  };
}

async function sessionRoutes(state: AppState, req: Request, url: URL, server?: ServerLike): Promise<Response> {
  const sessions = state.sessions;
  if (!sessions) return json({ error: "agent sessions are not available" }, 403);
  const [, , , id, sub] = url.pathname.split("/"); // /api/sessions/<id>/<sub>
  try {
    if (!id) {
      if (req.method === "GET") return json({ sessions: sessions.list(), agents: sessions.agents(), worktrees: await sessions.worktrees() });
      if (req.method === "POST") return json(await sessions.open(await readJson(req)), 201);
    } else if (!sub) {
      if (req.method === "GET") return json(sessions.get(id));
      if (req.method === "DELETE") {
        await sessions.remove(id);
        return json({ deleted: true });
      }
    } else if (req.method === "GET" && sub === "terminal") {
      sessions.get(id); // 404 before upgrading
      const refusal = webSocketRefusal(req);
      if (refusal) return json({ error: refusal }, 403);
      // After a successful upgrade Bun expects no response at all; the signature stays `Response` for every other caller.
      if (server?.upgrade(req, { data: { sessionId: id } satisfies TerminalSocketData })) return undefined as unknown as Response;
      return json({ error: "expected a WebSocket upgrade" }, 426);
    } else if (req.method === "GET" && sub === "worktree") {
      return json(await sessions.worktreeStatus(id));
    } else if (req.method === "POST") {
      if (sub === "resume") return json(await sessions.resume(id));
      if (sub === "ship") return json(await sessions.ship(id));
      if (sub === "prompt") return json(sessions.prompt(id, await readJson(req)));
      if (sub === "close") return json(await sessions.close(id, { removeWorktree: (await readJson(req)).removeWorktree === true }));
    }
  } catch (err) {
    if (err instanceof SessionError) return json({ error: err.message }, err.status);
    throw err;
  }
  return json({ error: "not found" }, 404);
}

async function getSharedConfig(): Promise<Response> {
  return json((await loadSharedConfig()) ?? EMPTY_SHARED_CONFIG);
}

/** Saving never writes to a repository; it only makes the next scan report which repositories are out of date. */
async function putSharedConfig(state: AppState, req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "body must be JSON" }, 400);
  }
  try {
    const saved = await saveSharedConfig(body);
    state.scanner.trigger();
    return json(saved);
  } catch (err) {
    if (err instanceof SharedConfigValidationError) return json({ error: err.message, issues: err.issues }, 400);
    throw err;
  }
}

interface Selection {
  repoId: string;
  /** Undefined when the id is not an enabled repository of the dashboard config. */
  repo?: RepoConfig;
  profileIds: string[];
}

/**
 * Resolves the requested assignments against the enabled repositories of the dashboard config. A request only ever
 * names ids; the path that preview and apply touch always comes from the config.
 */
async function selection(state: AppState, req: Request): Promise<Selection[] | Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "body must be JSON" }, 400);
  }
  const assignments = (body as { assignments?: unknown } | null)?.assignments;
  const valid = (a: unknown): a is SharedConfigAssignment =>
    typeof a === "object" && a !== null && typeof (a as SharedConfigAssignment).repoId === "string" && Array.isArray((a as SharedConfigAssignment).profileIds) && (a as SharedConfigAssignment).profileIds.every((id) => typeof id === "string");
  if (!Array.isArray(assignments) || !assignments.every(valid)) return json({ error: "assignments must be a list of { repoId, profileIds }" }, 400);
  const enabled = new Map(state.config.repos.filter((r) => r.enabled).map((r) => [r.id, r]));
  const byRepo = new Map(assignments.map((a) => [a.repoId, a])); // last one wins for a repeated repository
  return [...byRepo.values()].map((a) => ({ repoId: a.repoId, repo: enabled.get(a.repoId), profileIds: a.profileIds }));
}

const NOT_TRACKED = "not an enabled repository in the dashboard config";

async function postSharedConfigPreview(state: AppState, req: Request): Promise<Response> {
  const selected = await selection(state, req);
  if (selected instanceof Response) return selected;
  const shared = (await loadSharedConfig()) ?? EMPTY_SHARED_CONFIG;
  const previews: SharedConfigPreview[] = [];
  for (const { repoId, repo, profileIds } of selected) {
    previews.push(repo ? await previewFor(repo, shared, profileIds) : { repoId, current: { unreadable: true, applied: [] }, before: "", after: "", refusal: NOT_TRACKED });
  }
  return json({ previews });
}

/** The one API route that writes to tracked repositories: only `openspec/config.yaml`, only its managed sections. */
async function postSharedConfigApply(state: AppState, req: Request): Promise<Response> {
  const selected = await selection(state, req);
  if (selected instanceof Response) return selected;
  const shared = (await loadSharedConfig()) ?? EMPTY_SHARED_CONFIG;
  const results: SharedConfigApplyResult[] = [];
  for (const { repoId, repo, profileIds } of selected) {
    results.push(repo ? await applyTo(repo, shared, profileIds) : { repoId, result: "refused", reason: NOT_TRACKED });
  }
  state.scanner.trigger();
  return json({ results });
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * Loopback binding does not stop a web page open in the same browser from posting to us, so every non-GET API
 * request must look like it came from our own UI (or a deliberate command-line client):
 * - JSON content type: anything else is sendable by a plain form or a no-preflight `fetch`; JSON forces a CORS
 *   preflight, which we never approve.
 * - Addressed to a loopback name: defeats DNS rebinding, where an attacker's hostname resolves to 127.0.0.1 and
 *   `Origin` and `Host` would otherwise agree with each other.
 * - `Origin`, when the browser sends one, is that same loopback origin.
 * Returns the reason for a refusal, or undefined when the request may proceed.
 */
export function crossSiteRefusal(req: Request): string | undefined {
  const url = new URL(req.url);
  if (!LOOPBACK_HOSTS.has(url.hostname)) return "request must be addressed to a loopback host name";
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") return "content-type must be application/json";
  if (req.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") return "cross-site requests are not allowed";
  const origin = req.headers.get("origin");
  if (origin !== null) {
    // "null" (sandboxed frames, file://) and junk do not parse and are refused like any foreign origin
    const from = URL.canParse(origin) ? new URL(origin) : undefined;
    const own = from?.protocol === "http:" && LOOPBACK_HOSTS.has(from.hostname) && from.port === url.port;
    if (!own) return "origin is not the dashboard";
  }
  return undefined;
}

/** Builds the `fetch` handler for Bun.serve (design.md D8). */
async function postWorktreeRemove(state: AppState, req: Request): Promise<Response> {
  if (!state.sessions) return json({ error: "agent sessions are not available" }, 403);
  try {
    return json(await state.sessions.removeWorktreeByName(await readJson(req)));
  } catch (err) {
    if (err instanceof SessionError) return json({ error: err.message }, err.status);
    throw err;
  }
}

export function createFetchHandler({ state, indexHtml }: AppOptions): (req: Request, server?: ServerLike) => Promise<Response> {
  return async (req, server) => {
    const url = new URL(req.url);
    const { pathname } = url;

    if (pathname.startsWith("/api/")) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        const refusal = crossSiteRefusal(req);
        if (refusal) return json({ error: refusal }, 403);
      }
      if (pathname === "/api/sessions" || pathname.startsWith("/api/sessions/")) return sessionRoutes(state, req, url, server);
      if (req.method === "POST" && pathname === "/api/worktrees/remove") return postWorktreeRemove(state, req);
      if (req.method === "GET" && pathname === "/api/state") return json(state.scanner.snapshot);
      if (req.method === "GET" && pathname === "/api/config") return json(state.config);
      if (req.method === "PUT" && pathname === "/api/config") return putConfig(state, req);
      if (req.method === "POST" && pathname === "/api/discover") return postDiscover(state, req);
      if (req.method === "GET" && pathname === "/api/shared-config") return getSharedConfig();
      if (req.method === "PUT" && pathname === "/api/shared-config") return putSharedConfig(state, req);
      if (req.method === "POST" && pathname === "/api/shared-config/preview") return postSharedConfigPreview(state, req);
      if (req.method === "POST" && pathname === "/api/shared-config/apply") return postSharedConfigApply(state, req);
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
