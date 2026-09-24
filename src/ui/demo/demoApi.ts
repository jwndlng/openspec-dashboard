// In-memory stand-in for the dashboard server. Nothing is read from or written to anywhere: a reload starts over.
import { pageEvents } from "../../shared/activity.ts";
import { summarizeWorkInProgress } from "../../shared/workInProgress.ts";
import type { ChangeSnapshot, Config, DismissFile, DismissPreview, PullResult, RepoSharedConfig, RepoSnapshot, SharedConfigApplyResult, SharedConfigPreview, SharedProfile, Snapshot } from "../../shared/types.ts";
import { ApiError, type Api } from "../api.ts";
import { demoApply, demoPreview, newCleanupState, remainingWorktrees } from "./demoCleanup.ts";
import { createDemoSessions } from "./demoSessions.ts";
import { sampleArtifactFiles } from "./sampleArtifacts.ts";
import { buildActivity, buildSample, DEMO_CARRIED, DEMO_PROFILES, DEMO_ROOT } from "./sampleData.ts";
import type { Clock } from "./transcripts.ts";


export interface DemoApiOptions {
  now?: () => number;
  /** Simulated round trip, long enough for loading states to show. */
  latencyMs?: number;
  /** Drives the scripted terminals; tests pass one they advance by hand. */
  clock?: Clock;
}

export function createDemoApi({ now = Date.now, latencyMs = 150, clock }: DemoApiOptions = {}): Api {
  const sample = buildSample(now());
  let config: Config = sample.config;
  let generatedAt = sample.snapshot.generatedAt;

  const reply = <T>(value: T): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), latencyMs));

  /** Like `reply`, for operations that can refuse: the refusal arrives as a rejected promise, as over HTTP. */
  const attempt = <T>(operation: () => T): Promise<T> => {
    try {
      return reply(operation());
    } catch (err) {
      return new Promise((_, reject) => setTimeout(() => reject(err), latencyMs));
    }
  };

  // A repository enabled from the discovered list has never been scanned: it shows up empty, like a fresh one would.
  const emptyRepo = (id: string, name: string, path: string): RepoSnapshot => ({
    id,
    name,
    path,
    ok: true,
    scannedAt: generatedAt,
    isGit: true,
    currentBranch: "main",
    worktrees: [],
    changes: [],
  });

  // Shared config, simulated: the demo has no files, so it remembers which profile (and which version of it) each
  // sample repository "carries" and renders a stand-in config.yaml for the preview.
  // Seeded, so Projects shows carried profiles at first sight. A `stale` entry carries an older wording of its profile,
  // which is exactly what "outdated" means.
  let profiles: SharedProfile[] = structuredClone(DEMO_PROFILES);
  const carried = new Map<string, SharedProfile[]>(
    sample.snapshot.repos.flatMap((r) => {
      const entries = DEMO_CARRIED[r.name];
      if (!entries) return [];
      const applied = entries.flatMap(({ id, stale }) => {
        const profile = DEMO_PROFILES.find((p) => p.id === id);
        return profile ? [stale ? { ...profile, context: profile.context.split("\n")[0] } : structuredClone(profile)] : [];
      });
      return [[r.id, applied] as [string, SharedProfile[]]];
    }),
  );
  const same = (a: SharedProfile, b: SharedProfile) => a.context === b.context && JSON.stringify(a.rules) === JSON.stringify(b.rules);

  const sharedState = (repoId: string): RepoSharedConfig => ({
    unreadable: false,
    applied: (carried.get(repoId) ?? []).map((was) => {
      const now_ = profiles.find((p) => p.id === was.id);
      return { id: was.id, state: !now_ ? "orphaned" : same(was, now_) ? "in-sync" : "outdated" };
    }),
  });

  const MARK = "openspec-dashboard:shared";
  const renderConfig = (applied: SharedProfile[]): string => {
    const blocks = applied.filter((p) => p.context.trim()).map((p) => [`<!-- ${MARK}:begin ${p.id} — managed by openspec-dashboard, edits here are overwritten -->`, ...p.context.trim().split("\n"), `<!-- ${MARK}:end ${p.id} -->`, ""]);
    const context = [...blocks.flat(), "Sample project context (the project's own — never touched)."];
    const artifacts = [...new Set(applied.flatMap((p) => Object.keys(p.rules)))];
    const rules = artifacts.flatMap((artifact) => [`  ${artifact}:`, ...applied.flatMap((p) => (p.rules[artifact] ?? []).map((rule) => `    - ${rule} # ${MARK}:${p.id}`))]);
    return ["schema: spec-driven", "context: |", ...context.map((l) => (l ? `  ${l}` : "")), ...(rules.length ? ["rules:", ...rules] : []), ""].join("\n");
  };

  const desiredFor = (repoId: string, profileIds: string[]): { desired?: SharedProfile[]; refusal?: string } => {
    if (!config.repos.some((r) => r.enabled && r.id === repoId)) return { refusal: "not an enabled repository in the dashboard config" };
    const unknown = profileIds.filter((id) => !profiles.some((p) => p.id === id));
    if (unknown.length) return { refusal: `unknown profile${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}` };
    return { desired: profiles.filter((p) => profileIds.includes(p.id)) };
  };

  // What the visitor dismissed: gone from the board until a reload. Keyed by repository id and change name.
  const dismissed = new Set<string>();
  const dismissKey = (repoId: string, name: string) => `${repoId}\0${name}`;
  const withoutDismissed = (repo: RepoSnapshot): RepoSnapshot =>
    repo.changes.some((c) => !c.archived && dismissed.has(dismissKey(repo.id, c.name))) ? { ...repo, changes: repo.changes.filter((c) => c.archived || !dismissed.has(dismissKey(repo.id, c.name))) } : repo;

  /** The board without session worktrees: what the sessions themselves are validated against. */
  const baseSnapshot = (): Snapshot => ({
    generatedAt,
    repos: config.repos.filter((r) => r.enabled).map((r) => {
      const known = sample.snapshot.repos.find((s) => s.id === r.id);
      return known ? withoutDismissed(known) : emptyRepo(r.id, r.name, r.path);
    }),
  });

  const activityLog = buildActivity(sample.snapshot, now());
  /** Long enough to see "Pulling…", like a fetch over a network would be. */
  const PULL_MS = Math.min(900, latencyMs * 6);
  const pulled = new Set<string>();
  const simulatedPull = (repoId: string): PullResult | undefined => {
    const repo = snapshot().repos.find((r) => r.id === repoId);
    if (!repo?.ok || !repo.isGit) return undefined;
    const base = { repoId, fetched: true, branch: repo.currentBranch, upstream: `origin/${repo.currentBranch}`, defaultBranch: repo.defaultBranch };
    if (repo.onDefaultBranch === false) return { ...base, update: "skipped", reason: `on ${repo.currentBranch}, not ${repo.defaultBranch}; only fetched` };
    if (pulled.has(repoId)) return { ...base, update: "up-to-date" };
    pulled.add(repoId);
    // a made-up but stable number of new commits per sample repository
    return { ...base, update: "fast-forwarded", commits: 1 + (Number.parseInt(repoId.slice(0, 2), 16) % 5) };
  };

  // What the visitor removed with Clean up: gone from the board until a reload.
  const cleanupState = newCleanupState();
  const cleanedUp = (repo: RepoSnapshot): RepoSnapshot => {
    const worktrees = remainingWorktrees(cleanupState, repo.worktrees);
    return worktrees.length === repo.worktrees.length ? repo : { ...repo, worktrees, workInProgress: summarizeWorkInProgress(worktrees) };
  };
  /** Cleanup sees the sample's own checkouts, not session worktrees: those are removed from the sessions view. */
  const cleanupTarget = (repoId: string): RepoSnapshot => {
    const repo = sample.snapshot.repos.find((r) => r.id === repoId);
    if (!repo || !config.repos.some((r) => r.id === repoId && r.enabled)) throw new ApiError(404, "unknown repository");
    if (!repo.ok || !repo.isGit) throw new ApiError(409, "not a tracked, successfully scanned git repository");
    return repo;
  };

  const snapshot = (): Snapshot => ({
    generatedAt,
    repos: config.repos
      .filter((r) => r.enabled)
      .map((r) => {
        const known = sample.snapshot.repos.find((s) => s.id === r.id);
        const repo = known ? cleanedUp(withoutDismissed({ ...known, name: r.name })) : emptyRepo(r.id, r.name, r.path);
        // A session's worktree is a worktree of its repository, so `git worktree list` — the snapshot — has it too.
        const sessionWorktrees = config.agentSessions.enabled ? demoSessions.gitWorktrees(r.id) : [];
        const worktrees = [...repo.worktrees, ...sessionWorktrees];
        // The roll-up is derived from the checkouts, so it has to follow them.
        const withSessions = sessionWorktrees.length > 0 ? { ...repo, worktrees, workInProgress: summarizeWorkInProgress(worktrees) } : repo;
        return profiles.length > 0 ? { ...withSessions, sharedConfig: sharedState(r.id) } : withSessions;
      }),
  });

  const demoSessions: ReturnType<typeof createDemoSessions> = createDemoSessions({ now, clock, getConfig: () => config, getSnapshot: () => baseSnapshot() });

  // Same answers as the server: 404 for a repository that is not enabled or a change it does not have.
  const findChange = (repoId: string, change: string): { change: ChangeSnapshot; dir: string } => {
    const repo = snapshot().repos.find((r) => r.id === repoId);
    if (!repo) throw new ApiError(404, "not an enabled repository in the dashboard config");
    if (!/^[A-Za-z0-9._-]+$/.test(change)) throw new ApiError(400, "invalid change name");
    const found = repo.changes.find((c) => c.name === change);
    if (!found) throw new ApiError(404, "unknown change");
    const dir = found.archived ? `${repo.path}/openspec/changes/archive/${found.archived}-${change}` : `${repo.path}/openspec/changes/${change}`;
    return { change: found, dir };
  };
  /**
   * The sample's files of an active change in the main checkout, all committed — except a draft's scratch notes, so the
   * confirmation's "lost for good" can be seen. A change only a linked worktree holds is refused, as by the server.
   */
  const demoDismissPreview = (repoId: string, name: string): DismissPreview => {
    const { change } = findChange(repoId, name);
    if (change.archived) throw new ApiError(404, `"${name}" is archived; only active changes can be dismissed`);
    const checkouts = [change.checkout, ...(change.otherCheckouts ?? [])].filter((c) => c !== undefined);
    const holder = checkouts.find((c) => !c.isMain);
    if (checkouts.length > 0 && !checkouts.some((c) => c.isMain)) throw new ApiError(404, `"${name}" lives only in the worktree on ${holder?.branch ?? holder?.path}`);
    const paths = [".openspec.yaml", ...Object.values(sampleArtifactFiles(change)).flatMap((byPath) => Object.keys(byPath))];
    const files: DismissFile[] = paths.sort().map((path) => ({ path, state: "restorable" }));
    if (change.stage === "drafts") files.push({ path: "notes.md", state: "lost" });
    const copies = checkouts.filter((c) => !c.isMain).map((c) => ({ path: c.path, branch: c.branch }));
    return { repoId, name, isGit: true, files, copies, fingerprint: `demo:${repoId}:${name}` };
  };
  const failing = <T>(work: () => T): Promise<T> => {
    try {
      return reply(work());
    } catch (err) {
      return Promise.reject(err);
    }
  };
  const bytes = (text: string) => new TextEncoder().encode(text).length;

  return {
    state: () => reply(snapshot()),
    changeArtifacts: (repoId, changeName) =>
      failing(() => {
        const { change, dir } = findChange(repoId, changeName);
        const files = sampleArtifactFiles(change);
        return {
          change: { repoId, name: change.name, schema: change.schema, dir, archived: Boolean(change.archived) },
          artifacts: change.artifacts.map((a) => ({ ...a, files: Object.entries(files[a.id] ?? {}).map(([path, text]) => ({ path, bytes: bytes(text) })).sort((x, y) => (x.path < y.path ? -1 : 1)) })),
        };
      }),
    artifactFile: (repoId, changeName, path) =>
      failing(() => {
        const { change } = findChange(repoId, changeName);
        if (!path || path.startsWith("/") || path.split("/").includes("..")) throw new ApiError(400, "path must be relative to the change directory");
        const text = Object.values(sampleArtifactFiles(change)).find((byPath) => path in byPath)?.[path];
        if (text === undefined) throw new ApiError(404, "no such file in this change");
        return { path, bytes: bytes(text), text };
      }),
    // Built once from the sample, like a log that was written while the sample came about; filtered and paged like the real one.
    activity: (query) => reply(pageEvents(activityLog, query)),
    config: () => reply(config),
    saveConfig: (next) => {
      config = structuredClone(next);
      return reply(config);
    },
    discover: (scanRoots, ignorePaths) => {
      const roots = scanRoots ?? config.scanRoots;
      const ignored = (path: string) => (ignorePaths ?? config.ignorePaths).some((p) => path === p || path.startsWith(`${p.replace(/\/+$/, "")}/`));
      const inDemo = (root: string) => root === DEMO_ROOT || root.startsWith(`${DEMO_ROOT}/`) || DEMO_ROOT.startsWith(`${root.replace(/\/+$/, "")}/`);
      const tracked = new Set(config.repos.map((r) => r.id));
      return reply({
        candidates: roots.some(inDemo) ? sample.candidates.filter((c) => !tracked.has(c.id) && !ignored(c.path)) : [],
        errors: roots.filter((root) => !inDemo(root)).map((root) => ({ root, message: "The demo cannot read your disk; only the sample workspace exists here." })),
      });
    },
    // A pull in the demo contacts nothing: it answers with what the dashboard would say for such a repository.
    pullRepo: (repoId) => {
      const result = simulatedPull(repoId);
      if (!result) return new Promise((_, reject) => setTimeout(() => reject(new Error("not a tracked, successfully scanned git repository")), latencyMs));
      generatedAt = new Date(now()).toISOString();
      return new Promise((resolve) => setTimeout(() => resolve(structuredClone(result)), PULL_MS));
    },
    pullAll: () => {
      const results = snapshot().repos.flatMap((r) => simulatedPull(r.id) ?? []);
      generatedAt = new Date(now()).toISOString();
      return new Promise((resolve) => setTimeout(() => resolve(structuredClone({ results })), PULL_MS));
    },
    cleanupPreview: (repoId) => attempt(() => demoPreview(cleanupState, cleanupTarget(repoId))),
    cleanup: (repoId, selection) =>
      attempt(() => {
        const result = demoApply(cleanupState, cleanupTarget(repoId), selection);
        generatedAt = new Date(now()).toISOString();
        return result;
      }),
    // Dismissing in the demo deletes nothing anywhere: the change leaves the in-memory board until a reload.
    dismissPreview: (repoId, name) => attempt(() => demoDismissPreview(repoId, name)),
    dismissChange: (repoId, name, fingerprint) =>
      attempt(() => {
        const preview = demoDismissPreview(repoId, name);
        if (fingerprint !== preview.fingerprint) throw new ApiError(409, `"${name}" changed since it was shown; look at it again before dismissing`);
        dismissed.add(dismissKey(repoId, name));
        generatedAt = new Date(now()).toISOString();
        return { name, staged: true };
      }),
    scan: () => {
      generatedAt = new Date(now()).toISOString();
      return reply({ started: true });
    },
    // The demo does not write to disk: creating a change would need a place for it to persist, which the demo has not.
    createChange: () => new Promise((_, reject) => setTimeout(() => reject(new ApiError(503, "the demo does not persist changes")), latencyMs)),
    sharedConfig: () => reply({ profiles }),
    saveSharedConfig: (next) => {
      profiles = structuredClone(next.profiles);
      return reply({ profiles });
    },
    previewSharedConfig: (assignments) =>
      reply({
        previews: assignments.map(({ repoId, profileIds }): SharedConfigPreview => {
          const before = renderConfig(carried.get(repoId) ?? []);
          const { desired, refusal } = desiredFor(repoId, profileIds);
          return { repoId, current: sharedState(repoId), before, after: desired ? renderConfig(desired) : before, refusal };
        }),
      }),
    applySharedConfig: (assignments) => {
      const results = assignments.map(({ repoId, profileIds }): SharedConfigApplyResult => {
        const { desired, refusal } = desiredFor(repoId, profileIds);
        if (!desired) return { repoId, result: "refused", reason: refusal };
        const unchanged = renderConfig(desired) === renderConfig(carried.get(repoId) ?? []);
        carried.set(repoId, structuredClone(desired));
        return { repoId, result: unchanged ? "unchanged" : "written" };
      });
      generatedAt = new Date(now()).toISOString();
      return reply({ results });
    },

    // Agent sessions are simulated: state lives in memory, terminals play hand-written recordings, nothing is started.
    sessions: () => reply(demoSessions.list()),
    openSession: (repoId, change, action) => attempt(() => demoSessions.open(repoId, change, action)),
    openConsole: () => attempt(() => demoSessions.openConsole()),
    resumeSession: (id) => attempt(() => demoSessions.resume(id)),
    shipSession: (id) => attempt(() => demoSessions.ship(id)),
    removeWorktree: (repoId, name) => attempt(() => demoSessions.removeWorktree(repoId, name)),
    closeSession: (id, removeWorktree) => attempt(() => demoSessions.close(id, removeWorktree)),
    deleteSession: (id) => attempt(() => demoSessions.delete(id)),
    worktreeStatus: (id) => attempt(() => demoSessions.status(id)),
    promptSession: (id, action) => attempt(() => demoSessions.prompt(id, action)),
    openTerminal: (id, handlers) => demoSessions.terminal(id, handlers),
  };
}
