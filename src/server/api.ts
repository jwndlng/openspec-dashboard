import { ACTIVITY_KINDS, type ActivityKind } from "../shared/types.ts";
import { MAX_PAGE, type ActivityLog, type PageQuery } from "./activity/log.ts";
import type { CleanupSelection, Config, DiscoverResult, RepoConfig, ScanTriggerResult, SharedConfigApplyResult, SharedConfigAssignment, SharedConfigPreview } from "../shared/types.ts";
import { applyCleanup, CleanupBusyError, previewCleanup } from "./cleanup.ts";
import { changeDirFor, listArtifactFiles, readArtifactFile } from "./artifacts.ts";
import { consoleFolderProblem } from "./sessions/consoleFolder.ts";
import { ConfigValidationError, saveConfig, validateConfig, validateIgnorePaths, validateScanRoots } from "./config.ts";
import { createChange } from "./createChange.ts";
import { discoverRepos } from "./discover.ts";
import { PullBusyError, pullAll, pullRepository } from "./pull.ts";
import type { Scanner } from "./scanner.ts";
import { applyTo, EMPTY_SHARED_CONFIG, loadSharedConfig, previewFor, SharedConfigValidationError, saveSharedConfig } from "./sharedConfig.ts";
import { SessionError, type SessionManager } from "./sessions/manager.ts";
import { LocalRepoSource } from "./source.ts";

export interface AppState {
  config: Config;
  scanner: Scanner;
  /** Absent in contexts that never run agent sessions (some tests); the routes then answer 403. */
  sessions?: SessionManager;
  /** History for the Activity view. Absent in contexts that record none; the endpoint then answers with an empty feed. */
  activity?: ActivityLog;
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
  // Checked on save only (loading must survive a folder deleted since); opening the console checks it again.
  const consoleProblem = next.agentSessions.consoleDir ? consoleFolderProblem(next.agentSessions.consoleDir, next) : undefined;
  if (consoleProblem) return json({ error: `invalid config: agentSessions.consoleDir: ${consoleProblem}`, issues: [`agentSessions.consoleDir: ${consoleProblem}`] }, 400);
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
 * Read-only: walks the roots and honours the ignore paths from the body (the UI's unsaved draft) or, where the body
 * has none, the saved ones. Never touches `state.config`.
 */
async function postDiscover(state: AppState, req: Request): Promise<Response> {
  let roots = state.config.scanRoots;
  let ignorePaths = state.config.ignorePaths;
  const text = await req.text();
  if (text.trim()) {
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: "body must be JSON" }, 400);
    }
    const draft = body as { scanRoots?: unknown; ignorePaths?: unknown } | null;
    try {
      if (draft?.scanRoots !== undefined) roots = validateScanRoots(draft.scanRoots);
      if (draft?.ignorePaths !== undefined) ignorePaths = validateIgnorePaths(draft.ignorePaths);
    } catch (err) {
      if (err instanceof ConfigValidationError) return json({ error: err.message, issues: err.issues }, 400);
      throw err;
    }
  }
  const result: DiscoverResult = await discoverRepos(state.config.repos, roots, ignorePaths);
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

/** Opens the main console, or returns the one that is running. Mutating, so the same-origin guard has run already. */
async function consoleRoute(state: AppState): Promise<Response> {
  if (!state.sessions) return json({ error: "agent sessions are not available" }, 403);
  try {
    const { session, created } = await state.sessions.openConsole();
    return json(session, created ? 201 : 200);
  } catch (err) {
    if (err instanceof SessionError) return json({ error: err.message }, err.status);
    throw err;
  }
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
      if (sub === "prompt") return json(await sessions.prompt(id, await readJson(req)));
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
  // The board shows a change's leading copy, which may live in a linked worktree: read where the scanner read. The
  // checkout path is the scanner's (from `git worktree list`), never the request's.
  const checkout = state.scanner.snapshot.repos.find((r) => r.id === repo.id)?.changes.find((c) => c.name === changeName)?.checkout;
  const source = new LocalRepoSource(checkout && !checkout.isMain ? checkout.path : repo.path);
  const found = await changeDirFor(source, changeName);
  if (!found.ok) return found.reason === "invalid-name" ? json({ error: "invalid change name" }, 400) : json({ error: "unknown change" }, 404);
  if (match[3] === "artifacts") return json(await listArtifactFiles(source, repo.id, found.entry));
  const result = await readArtifactFile(source, found.entry.dir, url.searchParams.get("path"));
  return result.ok ? json(result.file) : json({ error: result.message }, FILE_ERROR_STATUS[result.reason]);
}

/**
 * The one API route that writes into a tracked repository outside `openspec/config.yaml`: creates
 * `openspec/changes/<name>/` with its schema marker and, if given, `prompt.md`, then stages that directory. Refused
 * for any reason means nothing was written and no git was run; the create itself is atomic (exclusive-create), so
 * two concurrent requests cannot both succeed. A staging failure is reported (`staged: false`), never a failure.
 */
async function postCreateChange(state: AppState, req: Request, repoId: string): Promise<Response> {
  const repo = state.config.repos.find((r) => r.id === repoId);
  if (!repo) return json({ error: "unknown repository" }, 404);
  if (!repo.enabled) return json({ error: "repository is disabled" }, 409);
  const scanned = state.scanner.snapshot.repos.find((r) => r.id === repoId);
  if (!scanned || !scanned.ok) return json({ error: "repository has not been successfully scanned" }, 409);
  let body: Record<string, unknown>;
  try {
    body = await readJson(req);
  } catch (err) {
    if (err instanceof SessionError) return json({ error: err.message }, err.status);
    throw err;
  }
  const name = body.name;
  const prompt = body.prompt;
  if (typeof name !== "string") return json({ error: "name must be a string" }, 400);
  if (prompt !== undefined && prompt !== null && typeof prompt !== "string") return json({ error: "prompt must be a string" }, 400);
  const result = await createChange(repo.path, name, typeof prompt === "string" ? prompt : undefined);
  if (!result.ok) {
    const status = result.reason === "invalid-name" || result.reason === "invalid-prompt" ? 400 : result.reason === "no-openspec-dir" || result.reason === "duplicate-active" || result.reason === "duplicate-archived" ? 409 : 500;
    return json({ error: result.message }, status);
  }
  state.scanner.trigger();
  return json({ name: result.name, staged: result.staged }, 201);
}

/**
 * Repositories the pull action may run in: tracked, scanned without error, and git. The path comes from the config —
 * a request only ever names an id.
 */
function pullable(state: AppState): RepoConfig[] {
  const scanned = new Map(state.scanner.snapshot.repos.map((r) => [r.id, r]));
  return state.config.repos.filter((r) => r.enabled && scanned.get(r.id)?.ok === true && scanned.get(r.id)?.isGit === true);
}

/** The one route that contacts a remote and updates a main checkout — and only because the user asked for it. */
async function postPull(state: AppState, repoId: string): Promise<Response> {
  const repo = pullable(state).find((r) => r.id === repoId);
  if (!repo) return json({ error: "not a tracked, successfully scanned git repository" }, 404);
  try {
    const result = await pullRepository(repo);
    state.scanner.trigger();
    return json(result);
  } catch (err) {
    if (err instanceof PullBusyError) return json({ error: err.message }, 409);
    throw err;
  }
}

async function postPullAll(state: AppState): Promise<Response> {
  const results = await pullAll(pullable(state));
  state.scanner.trigger();
  return json({ results });
}

/** The repository cleanup is offered for, or the response refusing it — decided before any git runs. */
function cleanupTarget(state: AppState, repoId: string): RepoConfig | Response {
  const repo = state.config.repos.find((r) => r.id === repoId);
  if (!repo) return json({ error: "unknown repository" }, 404);
  if (!pullable(state).includes(repo)) return json({ error: "not a tracked, successfully scanned git repository" }, 409);
  return repo;
}

const MAX_CLEANUP_ITEMS = 1000;

/** Shape only: whether each item is the repository's own and still safe is decided by the cleanup itself. */
function cleanupSelection(body: Record<string, unknown>): CleanupSelection | undefined {
  const { worktrees, prune, branches } = body;
  if (!Array.isArray(worktrees) || !worktrees.every((w) => typeof w === "string")) return undefined;
  if (typeof prune !== "boolean") return undefined;
  if (!Array.isArray(branches) || !branches.every((b) => typeof b?.name === "string" && typeof b.commit === "string" && /^[0-9a-f]{40,64}$/.test(b.commit))) return undefined;
  if (worktrees.length + branches.length > MAX_CLEANUP_ITEMS) return undefined;
  return { worktrees, prune, branches: branches.map((b) => ({ name: b.name, commit: b.commit })) };
}

async function getCleanup(state: AppState, repoId: string): Promise<Response> {
  const repo = cleanupTarget(state, repoId);
  if (repo instanceof Response) return repo;
  return json(await previewCleanup(repo, (await state.sessions?.runningWorktreePaths()) ?? new Set()));
}

/** Removes worktrees and deletes branches the user selected and confirmed; the only route that deletes a branch. */
async function postCleanup(state: AppState, req: Request, repoId: string): Promise<Response> {
  const repo = cleanupTarget(state, repoId);
  if (repo instanceof Response) return repo;
  try {
    const selection = cleanupSelection(await readJson(req));
    if (!selection) return json({ error: "expected { worktrees: string[], prune: boolean, branches: { name, commit }[] }" }, 400);
    const result = await applyCleanup(repo, selection, (await state.sessions?.runningWorktreePaths()) ?? new Set());
    state.sessions?.forgetWorktrees();
    state.scanner.trigger();
    return json(result);
  } catch (err) {
    if (err instanceof CleanupBusyError) return json({ error: err.message }, 409);
    if (err instanceof SessionError) return json({ error: err.message }, err.status);
    throw err;
  }
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

/** Read-only; the feed is history and never an input to anything else. */
function getActivity(state: AppState, url: URL): Response {
  const params = url.searchParams;
  const list = (name: string) => (params.get(name) ?? "").split(",").filter(Boolean);
  const query: PageQuery = {};
  if (params.has("limit")) {
    const limit = Number(params.get("limit"));
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE) return json({ error: `limit must be an integer between 1 and ${MAX_PAGE}` }, 400);
    query.limit = limit;
  }
  const kinds = list("kinds");
  const unknown = kinds.filter((k) => !ACTIVITY_KINDS.includes(k as ActivityKind));
  if (unknown.length > 0) return json({ error: `unknown kind: ${unknown.join(", ")}` }, 400);
  query.kinds = kinds as ActivityKind[];
  query.repos = list("repos");
  if (params.has("before")) query.before = params.get("before") ?? undefined;
  if (params.has("since")) query.since = params.get("since") ?? "";
  return json(state.activity?.page(query) ?? { events: [] });
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
      if (pathname === "/api/console" && req.method === "POST") return consoleRoute(state);
      const artifactMatch = req.method === "GET" ? ARTIFACT_ROUTE.exec(pathname) : null;
      if (artifactMatch) return artifactRoutes(state, url, artifactMatch);
      if (req.method === "POST" && pathname === "/api/worktrees/remove") return postWorktreeRemove(state, req);
      if (req.method === "GET" && pathname === "/api/state") return json(state.scanner.snapshot);
      if (req.method === "GET" && pathname === "/api/activity") return getActivity(state, url);
      if (req.method === "GET" && pathname === "/api/config") return json(state.config);
      if (req.method === "PUT" && pathname === "/api/config") return putConfig(state, req);
      if (req.method === "POST" && pathname === "/api/discover") return postDiscover(state, req);
      if (req.method === "GET" && pathname === "/api/shared-config") return getSharedConfig();
      if (req.method === "PUT" && pathname === "/api/shared-config") return putSharedConfig(state, req);
      if (req.method === "POST" && pathname === "/api/shared-config/preview") return postSharedConfigPreview(state, req);
      if (req.method === "POST" && pathname === "/api/shared-config/apply") return postSharedConfigApply(state, req);
      if (req.method === "POST" && pathname === "/api/pull") return postPullAll(state);
      const pullOne = /^\/api\/repos\/([^/]+)\/pull$/.exec(pathname);
      if (req.method === "POST" && pullOne) return postPull(state, decodeURIComponent(pullOne[1]));
      const cleanupMatch = /^\/api\/repos\/([^/]+)\/cleanup$/.exec(pathname);
      if (cleanupMatch && req.method === "GET") return getCleanup(state, decodeURIComponent(cleanupMatch[1]));
      if (cleanupMatch && req.method === "POST") return postCleanup(state, req, decodeURIComponent(cleanupMatch[1]));
      const createChangeMatch = /^\/api\/repos\/([^/]+)\/changes$/.exec(pathname);
      if (req.method === "POST" && createChangeMatch) return postCreateChange(state, req, decodeURIComponent(createChangeMatch[1]));
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
