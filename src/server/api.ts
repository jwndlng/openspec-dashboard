import type { Config, DiscoverResult, RepoConfig, ScanTriggerResult, SessionEvent, SharedConfigApplyResult, SharedConfigAssignment, SharedConfigPreview } from "../shared/types.ts";
import { changeDirFor, listArtifactFiles, readArtifactFile } from "./artifacts.ts";
import { ConfigValidationError, saveConfig, validateConfig, validateScanRoots } from "./config.ts";
import { discoverRepos } from "./discover.ts";
import type { Scanner } from "./scanner.ts";
import { applyTo, EMPTY_SHARED_CONFIG, loadSharedConfig, previewFor, SharedConfigValidationError, saveSharedConfig } from "./sharedConfig.ts";
import { SessionError, type SessionManager } from "./sessions/manager.ts";
import { LocalRepoSource } from "./source.ts";

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

const ARTIFACT_ROUTE = /^\/api\/repos\/([^/]+)\/changes\/([^/]+)\/(artifacts|file)$/;
const FILE_ERROR_STATUS = { "bad-path": 400, "not-found": 404, "too-large": 413 } as const;

/**
 * Read-only artifact list and single-file read for the change detail view. The request names a repository id, a
 * change name and a relative path; the directory always comes from the config and `listChanges()`.
 */
async function artifactRoutes(state: AppState, url: URL, match: RegExpExecArray): Promise<Response> {
  let repoId: string;
  let changeName: string;
  try {
    repoId = decodeURIComponent(match[1]);
    changeName = decodeURIComponent(match[2]);
  } catch {
    return json({ error: "malformed URL encoding" }, 400);
  }
  const repo = state.config.repos.find((r) => r.enabled && r.id === repoId);
  if (!repo) return json({ error: NOT_TRACKED }, 404);
  const source = new LocalRepoSource(repo.path);
  const found = await changeDirFor(source, changeName);
  if (!found.ok) return found.reason === "invalid-name" ? json({ error: "invalid change name" }, 400) : json({ error: "unknown change" }, 404);
  if (match[3] === "artifacts") return json(await listArtifactFiles(source, repo.id, found.entry));
  const result = await readArtifactFile(source, found.entry.dir, url.searchParams.get("path"));
  return result.ok ? json(result.file) : json({ error: result.message }, FILE_ERROR_STATUS[result.reason]);
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
      const artifactMatch = req.method === "GET" ? ARTIFACT_ROUTE.exec(pathname) : null;
      if (artifactMatch) return artifactRoutes(state, url, artifactMatch);
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
