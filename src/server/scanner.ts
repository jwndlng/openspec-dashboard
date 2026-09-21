import { join, sep } from "node:path";
import { deriveStage } from "../shared/columns.ts";
import type { ChangeSnapshot, Config, RepoConfig, RepoSnapshot, SharedConfig, Snapshot, Worktree } from "../shared/types.ts";
import { emptySnapshot, writeSnapshot } from "./cache.ts";
import { type ChangeCopy, mergeChanges } from "./mergeChanges.ts";
import { readChangeArtifacts } from "./openspecAdapter.ts";
import { loadSharedConfig, repoSharedConfig } from "./sharedConfig.ts";
import { changeSpecsSynced } from "./specSync.ts";
import { LocalRepoSource, type ChangeDirEntry, type DirtyFile, type RepoSource } from "./source.ts";
import { parseTaskProgress } from "./tasksParser.ts";

export const DEFAULT_CONCURRENCY = 4;
export const DEFAULT_REPO_TIMEOUT_MS = 30_000;
/** Only the most recent archives get a git lookup; older ones are rarely looked at. */
export const ARCHIVED_ACTIVITY_LIMIT = 25;

// `.openspec.yaml` and `openspec/config.yaml` are flat enough to read without a YAML parser.
const SCHEMA_LINE = /^schema:\s*["']?([A-Za-z0-9._-]+)/m;
const CREATED_LINE = /^created:\s*["']?(\d{4}-\d{2}-\d{2})/m;
const SKIP_SPECS_LINE = /^skip_specs:\s*true\b/m;

interface Marker {
  schema?: string;
  created?: string;
  skipSpecs: boolean;
}

export function parseMarker(text: string | undefined): Marker {
  if (!text) return { skipSpecs: false };
  return { schema: SCHEMA_LINE.exec(text)?.[1], created: CREATED_LINE.exec(text)?.[1], skipSpecs: SKIP_SPECS_LINE.test(text) };
}

function findBranchMatch(name: string, branch: string | undefined, worktrees: Worktree[]): string | undefined {
  if (branch?.includes(name)) return branch;
  return worktrees.find((w) => w.branch?.includes(name))?.branch;
}

/** Latest of several instants. Compared as instants because commit dates carry an offset and mtimes are UTC. */
export function latestIso(...values: (string | undefined)[]): string | undefined {
  let best: string | undefined;
  for (const v of values) {
    if (v && !Number.isNaN(Date.parse(v)) && (!best || Date.parse(v) > Date.parse(best))) best = v;
  }
  return best;
}

function newestDirty(files: DirtyFile[], under: string): string | undefined {
  const prefix = under.endsWith(sep) ? under : under + sep;
  let newest = 0;
  for (const f of files) if (f.path.startsWith(prefix)) newest = Math.max(newest, f.mtimeMs);
  return newest ? new Date(newest).toISOString() : undefined;
}

/** At most this many linked worktrees are read per repository; the most recently touched ones win. */
export const WORKTREE_LIMIT = 12;
const WORKTREE_CONCURRENCY = 3;
const WORKTREE_TIMEOUT_MS = 10_000;

/** One checkout of a repository being scanned: the main working tree or a linked worktree. */
interface RepoContext {
  repo: RepoConfig;
  /** Reads from this checkout. */
  source: RepoSource;
  /** This checkout's directory; changes, specs and git commands are resolved against it. */
  root: string;
  isMain: boolean;
  isGit: boolean;
  /** The branch checked out here. */
  branch?: string;
  worktrees: Worktree[];
  /** Files under `openspec/` that differ from HEAD, with their mtimes. */
  dirty: DirtyFile[];
  /** Schema from `openspec/config.yaml`, used when a change's marker has none. */
  projectSchema?: string;
}

async function scanChange(ctx: RepoContext, entry: ChangeDirEntry, withGit: boolean): Promise<ChangeSnapshot> {
  const warnings: string[] = [];
  const marker = parseMarker(await ctx.source.readText(join(entry.dir, ".openspec.yaml")));
  let schema = marker.schema ?? ctx.projectSchema ?? "unknown";
  let artifacts: ChangeSnapshot["artifacts"] = [];
  let tasksPath: string | undefined;
  try {
    const info = readChangeArtifacts(ctx.root, entry.name, {
      changeDir: entry.dir,
      schemaName: marker.schema ?? ctx.projectSchema,
      skipSpecs: marker.skipSpecs,
    });
    schema = info.schema;
    artifacts = info.artifacts;
    tasksPath = info.tasksPath;
  } catch (err) {
    warnings.push(`could not read artifacts: ${err instanceof Error ? err.message : String(err)}`);
  }

  const tasksMd = tasksPath ? await ctx.source.readText(tasksPath) : undefined;
  const tasks = tasksMd === undefined ? null : parseTaskProgress(tasksMd);
  if (tasks && tasks.total === 0 && artifacts.length > 0 && artifacts.every((a) => a.status === "done")) {
    warnings.push("tasks file has no tasks");
  }

  // Commit date, or an uncommitted edit if newer. Clean files' mtimes are ignored: a checkout rewrites them.
  let lastActivityAt = latestIso(
    withGit && ctx.isGit ? await ctx.source.lastActivity(entry.dir) : undefined,
    newestDirty(ctx.dirty, entry.dir),
  );
  if (!lastActivityAt) lastActivityAt = await ctx.source.newestMtime(entry.dir);

  // Only a finished, unarchived change can be Done or Synced, so only then is it worth reading its delta specs.
  let specsSynced: boolean | undefined;
  if (!entry.archived && tasks && tasks.total > 0 && tasks.done === tasks.total) {
    const sync = await changeSpecsSynced(ctx.source, entry.dir);
    specsSynced = sync.synced;
    warnings.push(...sync.warnings);
  }

  const { stage, column } = deriveStage({ archived: Boolean(entry.archived), schema, artifacts, tasks, specsSynced });
  return {
    repoId: ctx.repo.id,
    name: entry.name,
    schema,
    artifacts,
    tasks,
    created: marker.created,
    archived: entry.archived,
    lastActivityAt,
    specsSynced,
    // In the main checkout the branch is a guess from names; a linked worktree's copy is on that worktree's branch.
    branchMatch: entry.archived ? undefined : ctx.isMain ? findBranchMatch(entry.name, ctx.branch, ctx.worktrees) : ctx.branch,
    stage,
    column,
    warnings: warnings.length ? warnings : undefined,
  };
}

/** `shared` is the dashboard's shared OpenSpec config, when one exists; it only adds the read-only sync state. */
export async function scanRepo(repo: RepoConfig, source: RepoSource = new LocalRepoSource(repo.path), shared?: SharedConfig): Promise<RepoSnapshot> {
  const base = { id: repo.id, name: repo.name, path: repo.path, scannedAt: new Date().toISOString() };
  if (!(await source.exists())) {
    return { ...base, ok: false, error: "repository path or its openspec/ directory does not exist", isGit: false, worktrees: [], changes: [] };
  }
  const isGit = await source.isGit();
  const [branch, worktrees] = isGit ? await Promise.all([source.branch(), source.worktrees()]) : [undefined, []];
  // Archives, specs and progress come from the main checkout; off its default branch they may be outdated.
  const mainBranch = isGit ? await source.defaultBranch().catch(() => undefined) : undefined;
  const onDefaultBranch = mainBranch === undefined ? undefined : branch === mainBranch;
  const configYaml = await source.readText(join(repo.path, "openspec", "config.yaml"));
  const projectSchema = parseMarker(configYaml).schema;
  const sharedConfig = shared && shared.profiles.length > 0 ? repoSharedConfig(configYaml, shared) : undefined;
  const openspecDir = join(repo.path, "openspec");
  const dirty = isGit ? await source.dirtyFiles().catch(() => []) : [];
  const lastUpdatedAt = isGit
    ? latestIso(await source.lastActivity(openspecDir), newestDirty(dirty, openspecDir))
    : await source.newestMtime(openspecDir);
  const ctx: RepoContext = { repo, source, root: repo.path, isMain: true, isGit, branch, worktrees, dirty, projectSchema };

  const listing = await source.listChanges();
  const warnings = [...listing.warnings];
  const mainCheckout = { path: repo.path, branch, isMain: true };
  const copies: ChangeCopy[] = [];
  for (const entry of listing.active) copies.push({ change: await scanChange(ctx, entry, true), checkout: mainCheckout });
  const archived: ChangeSnapshot[] = [];
  for (const [i, entry] of listing.archived.entries()) archived.push(await scanChange(ctx, entry, i < ARCHIVED_ACTIVITY_LIMIT));

  // Newest archive date per name: `listing.archived` is sorted newest first, so the first one seen wins.
  const archivedOnMain = new Map<string, string>();
  for (const change of archived) if (change.archived && !archivedOnMain.has(change.name)) archivedOnMain.set(change.name, change.archived);

  // Work happens in linked worktrees; a board that only read the main checkout would show none of it.
  const fromWorktrees = await scanWorktrees(ctx, archivedOnMain);
  copies.push(...fromWorktrees.copies);
  warnings.push(...fromWorktrees.warnings);

  const active = isGit ? mergeChanges(copies, archivedOnMain, fromWorktrees.pending) : copies.map((c) => c.change);
  const changes = [...active, ...archived];

  return {
    ...base,
    ok: true,
    warnings: warnings.length ? warnings : undefined,
    isGit,
    currentBranch: branch,
    defaultBranch: mainBranch,
    onDefaultBranch,
    worktrees,
    // A repository whose only activity is in a worktree is still an active repository.
    lastUpdatedAt: latestIso(lastUpdatedAt, ...active.map((c) => c.lastActivityAt)),
    sharedConfig,
    changes,
  };
}

const worktreeLabel = (w: Worktree) => w.branch ?? w.path;

interface WorktreeCopies {
  copies: ChangeCopy[];
  /** Archives this worktree has and the main checkout does not (yet): agents archive on a branch, in a worktree. */
  pending: ChangeCopy[];
}

/** Changes of every readable linked worktree. A worktree that cannot be read becomes a warning, never an error. */
async function scanWorktrees(main: RepoContext, archivedOnMain: Map<string, string>): Promise<WorktreeCopies & { warnings: string[] }> {
  const warnings: string[] = [];
  const candidates: { worktree: Worktree; source: RepoSource; mtime: number }[] = [];
  // A project in a subdirectory of its repository is in that same subdirectory of every worktree; a worktree's top
  // level would be some other project's `openspec/` (or none).
  const subdir = await main.source.subdirectory().catch(() => "");
  for (const listed of main.worktrees) {
    if (listed.isMain || listed.prunable || listed.bare) continue;
    const worktree = subdir ? { ...listed, path: join(listed.path, subdir) } : listed;
    if (worktree.path === main.root) continue;
    const source = main.source.forCheckout(worktree.path);
    const mtime = await source.mtimeMs(join(worktree.path, "openspec", "changes")).catch(() => undefined);
    if (mtime !== undefined) candidates.push({ worktree, source, mtime });
  }
  candidates.sort((a, b) => b.mtime - a.mtime || a.worktree.path.localeCompare(b.worktree.path));
  const selected = candidates.slice(0, WORKTREE_LIMIT);
  if (candidates.length > selected.length) warnings.push(`${candidates.length - selected.length} of ${candidates.length} worktrees were not read (limit ${WORKTREE_LIMIT}; the most recently changed ones are)`);

  const results: WorktreeCopies[] = new Array(selected.length).fill({ copies: [], pending: [] });
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < selected.length) {
      const index = next++;
      const { worktree, source } = selected[index];
      try {
        results[index] = await withTimeout(scanWorktree(main, worktree, source, archivedOnMain), WORKTREE_TIMEOUT_MS, `worktree ${worktreeLabel(worktree)}`);
      } catch (err) {
        warnings.push(`worktree ${worktreeLabel(worktree)}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(WORKTREE_CONCURRENCY, selected.length) }, worker));
  return { copies: results.flatMap((r) => r.copies), pending: results.flatMap((r) => r.pending), warnings };
}

async function scanWorktree(main: RepoContext, worktree: Worktree, source: RepoSource, archivedOnMain: Map<string, string>): Promise<WorktreeCopies> {
  const listing = await source.listChanges();
  // Every branch carries main's archives along; only what main lacks (by name, as of that date) is news worth reading.
  const pendingEntries = listing.archived.filter((entry) => !((archivedOnMain.get(entry.name) ?? "") >= (entry.archived ?? "")));
  if (listing.active.length === 0 && pendingEntries.length === 0) return { copies: [], pending: [] };
  // A branch may carry its own config; it is that checkout's changes it applies to.
  const projectSchema = parseMarker(await source.readText(join(worktree.path, "openspec", "config.yaml"))).schema ?? main.projectSchema;
  const dirty = await source.dirtyFiles().catch(() => []);
  const ctx: RepoContext = { ...main, source, root: worktree.path, isMain: false, branch: worktree.branch, dirty, projectSchema };
  const checkout = { path: worktree.path, branch: worktree.branch, isMain: false };
  const copies: ChangeCopy[] = [];
  for (const entry of listing.active) copies.push({ change: await scanChange(ctx, entry, true), checkout });
  const pending: ChangeCopy[] = [];
  for (const entry of pendingEntries) pending.push({ change: await scanChange(ctx, entry, true), checkout });
  return { copies, pending };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export interface ScannerOptions {
  concurrency?: number;
  repoTimeoutMs?: number;
  /** Test seam; defaults to the local filesystem source. */
  sourceFor?: (repo: RepoConfig) => RepoSource;
  /** Test seam; defaults to the shared config stored in the dashboard home. */
  sharedConfig?: () => Promise<SharedConfig | undefined>;
  persist?: boolean;
}

/** Owns the current snapshot and the polling schedule (design.md D4). */
export class Scanner {
  private timer: ReturnType<typeof setInterval> | undefined;
  private inFlight: Promise<Snapshot> | undefined;
  snapshot: Snapshot;

  constructor(
    private readonly getConfig: () => Config,
    private readonly options: ScannerOptions = {},
    initial: Snapshot = emptySnapshot(),
  ) {
    this.snapshot = initial;
  }

  get scanning(): boolean {
    return this.inFlight !== undefined;
  }

  start(): void {
    this.stop();
    const seconds = this.getConfig().pollIntervalSeconds;
    this.timer = setInterval(() => void this.trigger(), seconds * 1000);
    void this.trigger();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Starts a scan unless one is running. Returns whether a new scan started. */
  trigger(): { started: boolean; done: Promise<Snapshot> } {
    if (this.inFlight) return { started: false, done: this.inFlight };
    this.inFlight = this.scanAll().finally(() => {
      this.inFlight = undefined;
    });
    return { started: true, done: this.inFlight };
  }

  private async scanAll(): Promise<Snapshot> {
    const config = this.getConfig();
    const repos = config.repos.filter((r) => r.enabled);
    const previous = new Map(this.snapshot.repos.map((r) => [r.id, r]));
    const shared = await (this.options.sharedConfig ?? loadSharedConfig)();
    const results: RepoSnapshot[] = new Array(repos.length);
    const concurrency = this.options.concurrency ?? DEFAULT_CONCURRENCY;
    const timeoutMs = this.options.repoTimeoutMs ?? DEFAULT_REPO_TIMEOUT_MS;
    let next = 0;

    const worker = async (): Promise<void> => {
      while (next < repos.length) {
        const index = next++;
        const repo = repos[index];
        const source = this.options.sourceFor?.(repo) ?? new LocalRepoSource(repo.path);
        try {
          results[index] = await withTimeout(scanRepo(repo, source, shared), timeoutMs, repo.name);
        } catch (err) {
          // Keep the last good changes so the board never blanks out on a transient failure.
          const prev = previous.get(repo.id);
          results[index] = {
            id: repo.id,
            name: repo.name,
            path: repo.path,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            scannedAt: new Date().toISOString(),
            isGit: prev?.isGit ?? false,
            currentBranch: prev?.currentBranch,
            defaultBranch: prev?.defaultBranch,
            onDefaultBranch: prev?.onDefaultBranch,
            worktrees: prev?.worktrees ?? [],
            lastUpdatedAt: prev?.lastUpdatedAt,
            sharedConfig: shared && shared.profiles.length > 0 ? prev?.sharedConfig : undefined,
            changes: prev?.changes ?? [],
          };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, repos.length) }, worker));

    this.snapshot = { generatedAt: new Date().toISOString(), repos: results };
    if (this.options.persist !== false) {
      await writeSnapshot(this.snapshot).catch((err) => console.warn("could not write snapshot cache:", err));
    }
    return this.snapshot;
  }
}
