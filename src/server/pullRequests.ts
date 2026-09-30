// Pull requests of the tracked repositories, read through the user's own GitHub CLI.
//
// This is the second — and only other — place in the dashboard that reaches a network, next to the pull action
// (openspec/specs/dashboard-api: "never writes"; openspec/specs/pull-requests). It runs `gh pr list` and
// `gh api user` and nothing else, never in a tracked repository's directory (the repository is named with `--repo`,
// the process runs in the dashboard home), and only because the user opened or refreshed a pull-request list.
// It writes nothing to a repository, runs no git command but the read-only `config --get remote.origin.url`
// that discovery already uses, and changes nothing on GitHub.
//
// Everything it keeps is display-only: the cache is never an input to scanning, columns, counts or actions.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { PullRequest, PullRequestsResponse, RepoPullRequests } from "../shared/types.ts";
import { normalizeRemote, originUrl } from "./git.ts";
import { dashboardHome, pullRequestsCachePath, whichOnPath } from "./paths.ts";
import { maskCredentials } from "./pull.ts";

/** A list younger than this is not fetched again unless the user asks for it explicitly. */
export const FRESHNESS_MS = 5 * 60_000;
/** Open pull requests per GitHub repository; one more is asked for, to notice the limit was reached. */
export const OPEN_LIMIT = 100;
export const CLOSED_LIMIT = 50;
/** How far back "recently merged or closed" reaches. */
export const CLOSED_WITHIN_DAYS = 7;
export const GH_TIMEOUT_MS = 30_000;
/** GitHub repositories queried at the same time. */
const CONCURRENCY = 3;
const CACHE_VERSION = 1;

/** Only the documented `--json` fields; anything else is parsed defensively or ignored. */
const FIELDS = "number,title,url,author,headRefName,baseRefName,isDraft,state,createdAt,mergedAt,closedAt,reviewDecision,reviewRequests,statusCheckRollup";

/** A tracked repository as the store sees it: never a path from a request — ids and paths come from the config. */
export interface RepoTarget {
  id: string;
  path: string;
  isGit: boolean;
}

interface Failure {
  /** `unavailable`: cannot be queried at all. `failed`: this attempt did not work. */
  kind: "unavailable" | "failed";
  reason: string;
  /** The machine's `gh`, not this repository: the view says it once rather than per repository. */
  setup?: RepoPullRequests["setup"];
}

interface CacheEntry {
  fetchedAt?: string;
  pullRequests: PullRequest[];
  truncated?: { open: boolean; closed: boolean };
  /** This session's last failure; never persisted — a restart shows the cached list, not an old error. */
  error?: Failure;
}

interface StoredCache {
  version: number;
  viewer?: string;
  repos: Record<string, { fetchedAt?: string; pullRequests: PullRequest[]; truncated?: { open: boolean; closed: boolean } }>;
}

// ---- remotes ----

/** `owner/name` for a github.com remote; undefined for every other host, form or failure. */
export function githubRepoFromRemote(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const normalized = normalizeRemote(url);
  if (!normalized?.startsWith("github.com/")) return undefined;
  const parts = normalized.slice("github.com/".length).split("/").filter(Boolean);
  // Exactly owner and name: a longer path is not a repository we can address.
  if (parts.length !== 2) return undefined;
  return `${parts[0]}/${parts[1]}`;
}

// ---- the gh process ----

interface GhRun {
  ok: boolean;
  out: string;
  err: string;
  timedOut: boolean;
  /** `gh` is not on PATH. */
  missing: boolean;
}

const NOT_INSTALLED: Failure = { kind: "unavailable", reason: "GitHub CLI not installed — install gh to see pull requests", setup: "gh-missing" };
const NOT_SIGNED_IN: Failure = { kind: "unavailable", reason: "gh is not signed in to github.com — run `gh auth login`", setup: "gh-signed-out" };

/** Whether `gh`'s stderr says the problem is authentication rather than this repository. */
function saysNotSignedIn(stderr: string): boolean {
  return /gh auth login|not logged in|authentication|requires authentication|bad credentials/i.test(stderr);
}

/** The line of `gh`'s stderr worth showing, masked and kept short; never a token, never a whole dump. */
export function ghReason(stderr: string): string {
  const lines = stderr
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
  const first = lines.find((l) => !/^(hint|note):/i.test(l)) ?? "gh gave no reason";
  const text = maskCredentials(first.replace(/^gh:\s*/i, ""));
  return text.length > 200 ? `${text.slice(0, 197)}…` : text;
}

/**
 * `gh` without a shell: no stdin, no prompts, no colour, no update notifier, and a timeout after which the process is
 * killed. The working directory is the dashboard home, so `gh` never looks at — let alone runs git in — a tracked
 * repository. Credentials stay entirely with `gh`; the dashboard never sees them.
 */
async function runGh(args: string[], timeoutMs = GH_TIMEOUT_MS): Promise<GhRun> {
  // Looked up explicitly rather than left to the spawn: with no `gh` on PATH some platforms fall back to a default
  // search path and would find another one, and the spec wants "not installed" decided before any process starts.
  if (!whichOnPath("gh")) return { ok: false, out: "", err: "gh is not on PATH", timedOut: false, missing: true };
  const cwd = dashboardHome();
  await mkdir(cwd, { recursive: true }).catch(() => undefined);
  const env = { ...process.env, GH_PROMPT_DISABLED: "1", GH_NO_UPDATE_NOTIFIER: "1", GH_SPINNER_DISABLED: "1", NO_COLOR: "1" };
  let timedOut = false;
  try {
    const proc = Bun.spawn(["gh", ...args], { cwd, stdout: "pipe", stderr: "pipe", stdin: "ignore", env });
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, timeoutMs);
    try {
      const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
      return { ok: code === 0 && !timedOut, out, err: err.trim(), timedOut, missing: false };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    return { ok: false, out: "", err: text, timedOut, missing: /ENOENT|not found|No such file/i.test(text) };
  }
}

/** What went wrong, in the terms the UI shows; `undefined` when nothing did. */
function failureOf(run: GhRun): Failure | undefined {
  if (run.missing) return NOT_INSTALLED;
  if (run.ok) return undefined;
  if (saysNotSignedIn(run.err)) return NOT_SIGNED_IN;
  if (run.timedOut) return { kind: "failed", reason: "gh timed out" };
  return { kind: "failed", reason: ghReason(run.err) };
}

// ---- parsing ----

const str = (value: unknown): string => (typeof value === "string" ? value : "");

const REVIEW: Record<string, PullRequest["review"]> = { APPROVED: "approved", CHANGES_REQUESTED: "changes_requested", REVIEW_REQUIRED: "review_required" };
const STATE: Record<string, PullRequest["state"]> = { OPEN: "open", MERGED: "merged", CLOSED: "closed" };
const FAILING_CONCLUSIONS = new Set(["FAILURE", "ERROR", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE"]);
const FAILING_STATES = new Set(["FAILURE", "ERROR"]);
const PENDING_STATES = new Set(["PENDING", "EXPECTED"]);

/**
 * One summary for a pull request's checks. A single failing check outweighs everything; otherwise anything still
 * running keeps it pending. Unknown values are treated as pending rather than passing, so drift never looks green.
 */
export function summarizeChecks(rollup: unknown): PullRequest["checks"] {
  if (!Array.isArray(rollup) || rollup.length === 0) return "none";
  let pending = false;
  for (const raw of rollup) {
    const entry = (raw ?? {}) as Record<string, unknown>;
    if ("conclusion" in entry || "status" in entry) {
      const conclusion = str(entry.conclusion).toUpperCase();
      const status = str(entry.status).toUpperCase();
      if (FAILING_CONCLUSIONS.has(conclusion)) return "failing";
      if (status !== "COMPLETED" || conclusion === "") pending = true;
      else if (!["SUCCESS", "NEUTRAL", "SKIPPED"].includes(conclusion)) pending = true;
    } else {
      const state = str(entry.state).toUpperCase();
      if (FAILING_STATES.has(state)) return "failing";
      if (PENDING_STATES.has(state) || state === "") pending = true;
      else if (state !== "SUCCESS") pending = true;
    }
  }
  return pending ? "pending" : "passing";
}

/** One entry of `gh pr list --json …`, or undefined when it carries no usable number. */
export function parsePullRequest(raw: unknown, viewer?: string): PullRequest | undefined {
  const entry = (raw ?? {}) as Record<string, unknown>;
  const number = typeof entry.number === "number" ? entry.number : Number.NaN;
  if (!Number.isInteger(number)) return undefined;
  const author = (entry.author ?? {}) as Record<string, unknown>;
  const requests = Array.isArray(entry.reviewRequests) ? entry.reviewRequests : [];
  // Team review requests carry a name rather than a login; resolving team membership would need more calls, so only
  // a direct request counts as "from you" (openspec/specs/pull-requests, and the design's risks).
  const requestedFromViewer =
    viewer !== undefined && requests.some((r) => str((r as Record<string, unknown>)?.login).toLowerCase() === viewer.toLowerCase());
  const mergedAt = str(entry.mergedAt) || undefined;
  const closedAt = str(entry.closedAt) || undefined;
  return {
    number,
    title: str(entry.title),
    url: str(entry.url),
    author: str(author.login),
    head: str(entry.headRefName),
    base: str(entry.baseRefName),
    draft: entry.isDraft === true,
    state: STATE[str(entry.state).toUpperCase()] ?? (mergedAt ? "merged" : closedAt ? "closed" : "open"),
    createdAt: str(entry.createdAt),
    mergedAt,
    closedAt,
    review: REVIEW[str(entry.reviewDecision).toUpperCase()] ?? "none",
    reviewRequestedFromViewer: requestedFromViewer,
    checks: summarizeChecks(entry.statusCheckRollup),
  };
}

/** When a pull request left the open list; undefined while it is open. */
function endedAt(pr: PullRequest): number | undefined {
  const iso = pr.mergedAt ?? pr.closedAt;
  if (!iso) return undefined;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? undefined : t;
}

/** Newest first: open ones by when they were opened, closed ones by when they ended. */
function newestFirst(a: PullRequest, b: PullRequest): number {
  const at = (pr: PullRequest) => {
    const t = endedAt(pr) ?? Date.parse(pr.createdAt);
    return Number.isNaN(t) ? 0 : t;
  };
  return at(b) - at(a) || b.number - a.number;
}

// ---- the store ----

export interface PullRequestsOptions {
  /** Only this repository (and the enabled repositories sharing its GitHub repository). */
  repoId?: string;
  /** Query regardless of how fresh the cached list is. */
  force?: boolean;
}

/**
 * The cache of pull-request lists, keyed by GitHub repository so two clones of one project share one entry, and the
 * coordination around refreshing it. One instance per running dashboard.
 */
export class PullRequests {
  private readonly cache = new Map<string, CacheEntry>();
  private viewer?: string;
  /** `origin` → GitHub repository, per repository path; a repository's remote does not change while it is tracked. */
  private readonly origins = new Map<string, string | undefined>();
  /** One query per GitHub repository at a time; a request arriving during one awaits it instead of starting another. */
  private readonly inFlight = new Map<string, Promise<void>>();
  private viewerFetch?: Promise<void>;
  /** "Not installed" / "not signed in" applies to every repository: once seen, the rest of the round reuses it. */
  private blocked?: Failure;
  /** Refreshes in flight; while one runs the next joins its round rather than starting its own. */
  private rounds = 0;
  private loaded = false;

  private readonly now: () => number;
  private readonly timeoutMs: number;

  /** `timeoutMs` is only lowered by tests, which must not wait half a minute for the real one. */
  constructor(options: { now?: () => number; timeoutMs?: number } = {}) {
    this.now = options.now ?? Date.now;
    this.timeoutMs = options.timeoutMs ?? GH_TIMEOUT_MS;
  }

  /** Reads the cache written by an earlier run. A missing or unreadable file simply means "never fetched". */
  async load(): Promise<void> {
    this.loaded = true;
    try {
      const parsed = JSON.parse(await readFile(pullRequestsCachePath(), "utf8")) as Partial<StoredCache>;
      if (parsed.version !== CACHE_VERSION || !parsed.repos || typeof parsed.repos !== "object") return;
      this.viewer = typeof parsed.viewer === "string" ? parsed.viewer : undefined;
      for (const [repo, entry] of Object.entries(parsed.repos)) {
        if (!Array.isArray(entry?.pullRequests)) continue;
        this.cache.set(repo, { fetchedAt: entry.fetchedAt, pullRequests: entry.pullRequests, truncated: entry.truncated });
      }
    } catch {
      // No cache, or one this version cannot read: nothing has been fetched as far as we are concerned.
    }
  }

  /** The memoised `origin` lookups; call after the configuration changed, so a re-pointed remote is seen. */
  forgetOrigins(): void {
    this.origins.clear();
  }

  private async githubRepoOf(target: RepoTarget): Promise<string | undefined> {
    if (!target.isGit) return undefined;
    if (this.origins.has(target.path)) return this.origins.get(target.path);
    const repo = githubRepoFromRemote(await originUrl(target.path));
    this.origins.set(target.path, repo);
    return repo;
  }

  /** The cached lists, projected per enabled repository. Contacts nothing and starts no `gh`. */
  async list(targets: RepoTarget[]): Promise<PullRequestsResponse> {
    if (!this.loaded) await this.load();
    const repos: RepoPullRequests[] = [];
    for (const target of targets) {
      const github = await this.githubRepoOf(target);
      if (!github) {
        repos.push({ repoId: target.id, status: "unavailable", reason: target.isGit ? "not on GitHub" : "not a git repository", pullRequests: [] });
        continue;
      }
      const entry = this.cache.get(github);
      if (!entry) {
        repos.push({ repoId: target.id, github, status: "never", pullRequests: [] });
        continue;
      }
      repos.push({
        repoId: target.id,
        github,
        status: entry.error ? entry.error.kind : "ok",
        reason: entry.error?.reason,
        setup: entry.error?.setup,
        fetchedAt: entry.fetchedAt,
        truncated: entry.truncated,
        pullRequests: entry.pullRequests,
      });
    }
    return { viewer: this.viewer, repos };
  }

  /**
   * Queries GitHub for the repositories that need it and answers with the same projection as `list`. Repositories
   * whose list is still fresh are left alone unless `force` is set, and a query already running for a GitHub
   * repository is joined rather than started a second time.
   */
  async refresh(targets: RepoTarget[], options: PullRequestsOptions = {}): Promise<PullRequestsResponse> {
    if (!this.loaded) await this.load();
    // The first refresh of a round decides whether `gh` is there and signed in; refreshes joining it reuse that answer.
    const startsRound = this.rounds === 0;
    if (startsRound) this.blocked = undefined;
    this.rounds++;
    try {
      const byGithub = new Map<string, RepoTarget[]>();
      for (const target of targets) {
        const github = await this.githubRepoOf(target);
        if (!github) continue;
        byGithub.set(github, [...(byGithub.get(github) ?? []), target]);
      }

      const wanted = [...byGithub.entries()]
        .filter(([, group]) => options.repoId === undefined || group.some((t) => t.id === options.repoId))
        .filter(([github]) => options.force === true || !this.isFresh(github))
        .map(([github]) => github);

      if (wanted.length > 0) {
        // One `gh api user` per round, for the "review requested from you" marker; a failure only loses the marker.
        if (startsRound || this.viewerFetch) await this.ensureViewer();
        await this.runBounded(wanted.map((github) => () => this.queryOnce(github)));
        await this.persist();
      }
    } finally {
      this.rounds--;
      // The last refresh out ends the round, so the next one queries afresh.
      if (this.rounds === 0) this.inFlight.clear();
    }
    return this.list(targets);
  }

  private isFresh(github: string): boolean {
    const entry = this.cache.get(github);
    if (!entry?.fetchedAt || entry.error) return false;
    const at = Date.parse(entry.fetchedAt);
    return !Number.isNaN(at) && this.now() - at < FRESHNESS_MS;
  }

  private async runBounded(jobs: (() => Promise<void>)[]): Promise<void> {
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < jobs.length) await jobs[next++]();
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  }

  private async ensureViewer(): Promise<void> {
    if (this.viewerFetch) return this.viewerFetch;
    if (this.blocked) return;
    this.viewerFetch = (async () => {
      const run = await runGh(["api", "user", "--jq", ".login"], this.timeoutMs);
      const failure = failureOf(run);
      if (failure?.kind === "unavailable") this.blocked = failure;
      if (run.ok) {
        const login = run.out.trim();
        if (login) this.viewer = login;
      }
    })();
    try {
      await this.viewerFetch;
    } finally {
      this.viewerFetch = undefined;
    }
  }

  /**
   * One GitHub repository, at most once per round. The entry is kept until the round ends rather than dropped when the
   * query settles: a refresh that joins a round whose query has already finished must see that result instead of
   * querying the same repository again, which is what "a second refresh joins the running one" means.
   */
  private queryOnce(github: string): Promise<void> {
    const running = this.inFlight.get(github);
    if (running) return running;
    const done = this.query(github);
    this.inFlight.set(github, done);
    return done;
  }

  private async query(github: string): Promise<void> {
    const previous = this.cache.get(github) ?? { pullRequests: [] };
    if (this.blocked) {
      this.cache.set(github, { ...previous, error: this.blocked });
      return;
    }
    const since = new Date(this.now() - CLOSED_WITHIN_DAYS * 24 * 3600_000);
    const [open, closed] = await Promise.all([
      this.listPrs(github, ["--state", "open", "--limit", String(OPEN_LIMIT + 1)]),
      // A search, not `--state closed`: merged and closed pull requests then come from one call, filtered by date.
      this.listPrs(github, ["--state", "all", "--search", `is:closed closed:>=${since.toISOString().slice(0, 10)}`, "--limit", String(CLOSED_LIMIT + 1)]),
    ]);
    const failure = open.failure ?? closed.failure;
    if (failure) {
      if (failure.kind === "unavailable") this.blocked = failure;
      // The previously fetched list stays, marked with its age; only the reason is new.
      this.cache.set(github, { ...previous, error: failure });
      return;
    }
    const cutoff = since.getTime();
    const openList = (open.items ?? []).filter((pr) => pr.state === "open").sort(newestFirst);
    const closedList = (closed.items ?? [])
      .filter((pr) => pr.state !== "open")
      .filter((pr) => (endedAt(pr) ?? 0) >= cutoff)
      .sort(newestFirst);
    this.cache.set(github, {
      fetchedAt: new Date(this.now()).toISOString(),
      pullRequests: [...openList, ...closedList],
      truncated: { open: open.truncated === true, closed: closed.truncated === true },
    });
  }

  private async listPrs(github: string, args: string[]): Promise<{ items?: PullRequest[]; truncated?: boolean; failure?: Failure }> {
    const limit = Number(args[args.indexOf("--limit") + 1]);
    const run = await runGh(["pr", "list", "--repo", github, ...args, "--json", FIELDS], this.timeoutMs);
    const failure = failureOf(run);
    if (failure) return { failure };
    let raw: unknown;
    try {
      raw = JSON.parse(run.out || "[]");
    } catch {
      return { failure: { kind: "failed", reason: "gh returned output that is not JSON" } };
    }
    if (!Array.isArray(raw)) return { failure: { kind: "failed", reason: "gh returned output that is not a list" } };
    const truncated = raw.length >= limit;
    const items = raw
      .slice(0, limit - 1)
      .map((entry) => parsePullRequest(entry, this.viewer))
      .filter((pr): pr is PullRequest => pr !== undefined);
    return { items, truncated };
  }

  /** Temp file plus rename, as the snapshot cache does: a half-written file is never read back. */
  private async persist(): Promise<void> {
    const stored: StoredCache = { version: CACHE_VERSION, viewer: this.viewer, repos: {} };
    for (const [github, entry] of this.cache) {
      if (!entry.fetchedAt) continue;
      stored.repos[github] = { fetchedAt: entry.fetchedAt, pullRequests: entry.pullRequests, truncated: entry.truncated };
    }
    const path = pullRequestsCachePath();
    try {
      await mkdir(dirname(path), { recursive: true });
      const tmp = `${path}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(stored), "utf8");
      await rename(tmp, path);
    } catch {
      // The cache is a convenience: failing to write it loses nothing but the lists after a restart.
    }
  }
}
