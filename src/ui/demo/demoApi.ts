// In-memory stand-in for the dashboard server. Nothing is read from or written to anywhere: a reload starts over.
import { pageEvents, retained } from "../../shared/activity.ts";
import { labelKey, labelProblem, MAX_LABEL_COLORS } from "../../shared/labels.ts";
import { availableName } from "../../shared/nameHints.ts";
import { summarizeWorkInProgress } from "../../shared/workInProgress.ts";
import type { ChangeSnapshot, Config, DismissFile, DismissPreview, PullBlockingFile, PullResult, RepoConfig, RepoSharedConfig, RepoSnapshot, SharedConfigApplyResult, SharedConfigPreview, SharedProfile, Snapshot } from "../../shared/types.ts";
import { ApiError, type Api, labelLists } from "../api.ts";
import { demoApply, demoPreview, newCleanupState, remainingWorktrees } from "./demoCleanup.ts";
import { createDemoSessions } from "./demoSessions.ts";
import { sampleArtifactFiles } from "./sampleArtifacts.ts";
import { buildActivity, buildPullRequests, buildSample, DEMO_CARRIED, demoEnvironment, DEMO_PROFILES, DEMO_ROOT } from "./sampleData.ts";
import type { Clock } from "./transcripts.ts";


// ---------------------------------------------------------------------------------------------------------------------
// One sample repository's first pull is blocked by the dashboard's own leftovers, so the visitor can try Resolve and
// pull: `.openspec.yaml` is the same on both sides, `prompt.md` is not, and everything here is made up.
// ---------------------------------------------------------------------------------------------------------------------
const BLOCKED_REPO = "2f86b0cd"; // quill-docs
const BLOCKED_CHANGE = "add-import-redirects";
const BLOCKED_UPSTREAM = "4f19b7ce0a2d5168b3c47ae90d1f6825bb3c07ea";
const BLOCKED_FILES: PullBlockingFile[] = [
  {
    path: `openspec/changes/${BLOCKED_CHANGE}/.openspec.yaml`,
    kind: "leftover",
    differs: false,
    incoming: "9a3c1d5e7b02f48619cd3a7e04b8156f2c9d0e71",
    staged: "9a3c1d5e7b02f48619cd3a7e04b8156f2c9d0e71",
    worktree: "9a3c1d5e7b02f48619cd3a7e04b8156f2c9d0e71",
  },
  {
    path: `openspec/changes/${BLOCKED_CHANGE}/prompt.md`,
    kind: "leftover",
    differs: true,
    incoming: "1b74e0c6d9a25f38401e7bc3a5d68f291047c3ba",
    staged: "e52d8106f3ba9c74d015e6b82a39fc07461d9825",
    worktree: "e52d8106f3ba9c74d015e6b82a39fc07461d9825",
  },
];
const BLOCKED_HINT =
  "These files are left over from changes created here that the incoming commits already contain. Resolve and pull replaces them with the incoming version and keeps a copy of anything that differs.";
const BLOCKED_COPY = `/home/demo/.openspec-dashboard/pull-backups/${BLOCKED_REPO}/2026-02-14T09-41-08-317Z/openspec/changes/${BLOCKED_CHANGE}/prompt.md`;

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
  // The demo's pull requests are synthetic and in memory: "refreshing" only moves this forward, nothing is fetched.
  let pullRequestsFetchedAt = now() - 2 * 60_000;

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
  /** Every repository the sample can describe: the tracked ones, plus any that has been integrated in this session. */
  const sampleRepo = (id: string): RepoSnapshot | undefined => sample.snapshot.repos.find((s) => s.id === id) ?? sample.integrated.find((s) => s.id === id);

  const baseSnapshot = (): Snapshot => ({
    generatedAt,
    repos: config.repos.filter((r) => r.enabled).map((r) => {
      const known = sampleRepo(r.id);
      return known ? withoutDismissed(known) : emptyRepo(r.id, r.name, r.path);
    }),
  });

  const activityLog = buildActivity(sample.snapshot, now());
  /** Long enough to see "Pulling…", like a fetch over a network would be. */
  const PULL_MS = Math.min(900, latencyMs * 6);
  const pulled = new Set<string>();
  let leftoversResolved = false;
  const simulatedPull = (repoId: string): PullResult | undefined => {
    const repo = snapshot().repos.find((r) => r.id === repoId);
    if (!repo?.ok || !repo.isGit) return undefined;
    const base = { repoId, fetched: true, branch: repo.currentBranch, upstream: `origin/${repo.currentBranch}`, defaultBranch: repo.defaultBranch };
    if (repo.onDefaultBranch === false) return { ...base, update: "skipped", reason: `on ${repo.currentBranch}, not ${repo.defaultBranch}; only fetched` };
    // One sample repository is blocked by the dashboard's own leftovers until the visitor tries Resolve and pull.
    if (repoId === BLOCKED_REPO && !leftoversResolved) {
      return {
        ...base,
        update: "refused",
        reason: `Your local changes to the following files would be overwritten by merge: ${BLOCKED_FILES.map((f) => f.path).join(" ")}`,
        blocking: structuredClone(BLOCKED_FILES),
        resolvable: { upstream: BLOCKED_UPSTREAM, files: structuredClone(BLOCKED_FILES) },
        hint: BLOCKED_HINT,
      };
    }
    if (pulled.has(repoId)) return { ...base, update: "up-to-date" };
    pulled.add(repoId);
    // a made-up but stable number of new commits per sample repository
    return { ...base, update: "fast-forwarded", commits: 1 + (Number.parseInt(repoId.slice(0, 2), 16) % 5) };
  };

  /** Resolving in the demo removes nothing anywhere: it answers with what the dashboard would say for those files. */
  const simulatedResolve = (repoId: string, upstream: string): PullResult | undefined => {
    const repo = snapshot().repos.find((r) => r.id === repoId);
    if (!repo?.ok || !repo.isGit) return undefined;
    const base = { repoId, fetched: false, branch: repo.currentBranch, upstream: `origin/${repo.currentBranch}`, defaultBranch: repo.defaultBranch };
    if (repoId !== BLOCKED_REPO || leftoversResolved || upstream !== BLOCKED_UPSTREAM) {
      return { ...base, update: "refused", reason: "the blocking files are no longer the ones that were shown; pull again to see where they stand" };
    }
    leftoversResolved = true;
    pulled.add(repoId);
    return {
      ...base,
      update: "fast-forwarded",
      commits: 2,
      resolved: [{ path: BLOCKED_FILES[0].path }, { path: BLOCKED_FILES[1].path, copy: BLOCKED_COPY }],
    };
  };

  // What the visitor removed with Clean up: gone from the board until a reload.
  const cleanupState = newCleanupState();
  const cleanedUp = (repo: RepoSnapshot): RepoSnapshot => {
    const worktrees = remainingWorktrees(cleanupState, repo.worktrees);
    return worktrees.length === repo.worktrees.length ? repo : { ...repo, worktrees, workInProgress: summarizeWorkInProgress(worktrees) };
  };
  /** Cleanup sees the sample's own checkouts, not session worktrees: those are removed from the sessions view. */
  const cleanupTarget = (repoId: string): RepoSnapshot => {
    const repo = sampleRepo(repoId);
    if (!repo || !config.repos.some((r) => r.id === repoId && r.enabled)) throw new ApiError(404, "unknown repository");
    if (!repo.ok || !repo.isGit) throw new ApiError(409, "not a tracked, successfully scanned git repository");
    return repo;
  };

  const snapshot = (): Snapshot => ({
    generatedAt,
    repos: config.repos
      .filter((r) => r.enabled)
      .map((r) => {
        const known = sampleRepo(r.id);
        const repo = known ? cleanedUp(withoutDismissed({ ...known, name: r.name })) : emptyRepo(r.id, r.name, r.path);
        // A session's worktree is a worktree of its repository, so `git worktree list` — the snapshot — has it too.
        const sessionWorktrees = config.agentSessions.enabled ? demoSessions.gitWorktrees(r.id) : [];
        const worktrees = [...repo.worktrees, ...sessionWorktrees];
        // The roll-up is derived from the checkouts, so it has to follow them.
        const withSessions = sessionWorktrees.length > 0 ? { ...repo, worktrees, workInProgress: summarizeWorkInProgress(worktrees) } : repo;
        return profiles.length > 0 ? { ...withSessions, sharedConfig: sharedState(r.id) } : withSessions;
      }),
  });

  /** Still without OpenSpec: the sample's integratable repositories minus the ones the visitor has already set up. */
  const integratable = () => sample.integratable.filter((r) => !config.repos.some((c) => c.id === r.id));

  const demoSessions: ReturnType<typeof createDemoSessions> = createDemoSessions({
    now,
    clock,
    getConfig: () => config,
    getSnapshot: () => baseSnapshot(),
    integratable,
    // The recording ended, which here stands for `openspec/config.yaml` appearing: track it and show its board.
    onIntegrated: (path) => {
      const repo = sample.integratable.find((r) => r.path === path);
      if (!repo || config.repos.some((r) => r.id === repo.id)) return;
      config = { ...config, repos: [...config.repos, { id: repo.id, path: repo.path, name: repo.name, enabled: true }] };
      generatedAt = new Date(now()).toISOString();
    },
  });

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
  /** One configured repository changed, as the dashboard's per-repository routes do; 404 when it is not configured. */
  const updateRepo = (repoId: string, change: (repo: RepoConfig) => RepoConfig): Config => {
    if (!config.repos.some((r) => r.id === repoId)) throw new ApiError(404, "repository not found");
    config = { ...config, repos: config.repos.map((r) => (r.id === repoId ? change(r) : r)) };
    return config;
  };

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
    // Built once from the sample, like a log that was written while the sample came about; kept for the same 7 days,
    // filtered and paged like the real one.
    activity: (query) => reply(pageEvents(retained(activityLog, now()), query)),
    config: () => reply(config),
    // Fixed sample data, derived from the config the visitor is looking at: no process, no PATH, no file, no connection.
    environment: () => reply(demoEnvironment(config, now())),
    saveConfig: (next) => {
      config = structuredClone(next);
      return reply(config);
    },
    // The overview's instant actions, on the page's own copy of the config: gone after a reload, like every edit here.
    trackRepo: (path) =>
      failing(() => {
        const configured = config.repos.find((r) => r.path === path);
        if (configured) {
          config = { ...config, repos: config.repos.map((r) => (r === configured ? { ...r, enabled: true } : r)) };
          return config;
        }
        const ignored = config.ignorePaths.some((p) => path === p || path.startsWith(`${p}/`));
        const candidate = sample.candidates.find((c) => c.path === path);
        if (!candidate || ignored) throw new ApiError(404, "this folder is not a repository discovery offers for tracking");
        const name = availableName(
          candidate,
          config.repos.map((r) => r.name),
        );
        config = {
          ...config,
          repos: [...config.repos, { id: candidate.id, path: candidate.path, name, enabled: true }].sort((x, y) => x.path.localeCompare(y.path)),
        };
        return config;
      }),
    setRepoEnabled: (repoId, enabled) =>
      failing(() => {
        if (!config.repos.some((r) => r.id === repoId)) throw new ApiError(404, "repository not found");
        config = { ...config, repos: config.repos.map((r) => (r.id === repoId ? { ...r, enabled } : r)) };
        return config;
      }),
    ignorePath: (path) => {
      const trimmed = path.replace(/\/+$/, "");
      return failing(() => {
        if (!trimmed.startsWith("/")) throw new ApiError(400, "path must be an absolute path");
        if (!config.ignorePaths.includes(trimmed)) config = { ...config, ignorePaths: [...config.ignorePaths, trimmed] };
        return config;
      });
    },
    renameRepo: (repoId, name) =>
      failing(() => {
        if (!name.trim()) throw new ApiError(400, "name must not be empty");
        return updateRepo(repoId, (r) => ({ ...r, name: name.trim() }));
      }),
    setRepoAgent: (repoId, { enabled, agentId }) =>
      failing(() => {
        if (enabled === undefined && agentId === undefined) throw new ApiError(400, "send enabled or agentId");
        if (typeof agentId === "string" && !config.agentSessions.agents.some((a) => a.id === agentId)) throw new ApiError(400, `unknown agent ${agentId}`);
        return updateRepo(repoId, (r) => {
          const agent: NonNullable<RepoConfig["agent"]> = { enabled: true, ...r.agent };
          if (enabled !== undefined) agent.enabled = enabled;
          if (agentId === null) delete agent.agentId;
          else if (agentId !== undefined) agent.agentId = agentId;
          return { ...r, agent };
        });
      }),
    setRepoLabels: (repoId, patch) =>
      failing(() => {
        const lists = labelLists(patch);
        if (Object.keys(lists).length === 0) throw new ApiError(400, "send labels or hiddenLabels");
        for (const list of Object.values(lists)) {
          list.forEach((label, i) => {
            const problem = labelProblem(label, list.slice(0, i));
            if (problem) throw new ApiError(400, problem);
          });
        }
        return updateRepo(repoId, (r) => {
          const next: RepoConfig = { ...r };
          for (const [key, list] of Object.entries(lists) as ["labels" | "hiddenLabels", string[]][]) {
            if (list.length) next[key] = list.map((l) => l.trim());
            else delete next[key];
          }
          return next;
        });
      }),
    setLabelColor: (label, hue) =>
      failing(() => {
        const problem = labelProblem(label);
        if (problem) throw new ApiError(400, problem);
        if (hue !== null && !(Number.isInteger(hue) && hue >= 0 && hue <= 359)) throw new ApiError(400, "hue must be null or a whole number from 0 to 359");
        const key = labelKey(label.trim());
        const colors = { ...config.labelColors };
        if (hue === null) delete colors[key];
        else colors[key] = hue;
        if (Object.keys(colors).length > MAX_LABEL_COLORS) throw new ApiError(400, `at most ${MAX_LABEL_COLORS} label colours`);
        const { labelColors: _, ...rest } = config;
        config = Object.keys(colors).length ? { ...rest, labelColors: colors } : rest;
        return config;
      }),
    forgetRepo: (repoId) =>
      failing(() => {
        const repo = config.repos.find((r) => r.id === repoId);
        if (!repo) throw new ApiError(404, "repository not found");
        if (repo.enabled) throw new ApiError(409, "disable the repository before forgetting it");
        config = { ...config, repos: config.repos.filter((r) => r.id !== repoId) };
        return config;
      }),
    discover: (scanRoots, ignorePaths) => {
      const roots = scanRoots ?? config.scanRoots;
      const ignored = (path: string) => (ignorePaths ?? config.ignorePaths).some((p) => path === p || path.startsWith(`${p.replace(/\/+$/, "")}/`));
      const inDemo = (root: string) => root === DEMO_ROOT || root.startsWith(`${DEMO_ROOT}/`) || DEMO_ROOT.startsWith(`${root.replace(/\/+$/, "")}/`);
      const tracked = new Set(config.repos.map((r) => r.id));
      return reply({
        candidates: roots.some(inDemo) ? sample.candidates.filter((c) => !tracked.has(c.id) && !ignored(c.path)) : [],
        integratable: roots.some(inDemo) ? integratable().filter((r) => !ignored(r.path)) : [],
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
    pullRequests: () => reply(buildPullRequests(sample.snapshot, now(), pullRequestsFetchedAt)),
    // Made up, so a board never asks for them again; Refresh and the Pull requests view still simulate a fetch.
    syntheticPullRequests: true,
    // A refresh takes long enough for the control's running state to be visible, and answers with the same data.
    refreshPullRequests: () =>
      new Promise((resolve) =>
        setTimeout(() => {
          pullRequestsFetchedAt = now();
          resolve(structuredClone(buildPullRequests(sample.snapshot, now(), pullRequestsFetchedAt)));
        }, 600),
      ),
    pullAll: () => {
      const results = snapshot().repos.flatMap((r) => simulatedPull(r.id) ?? []);
      generatedAt = new Date(now()).toISOString();
      return new Promise((resolve) => setTimeout(() => resolve(structuredClone({ results })), PULL_MS));
    },
    // Confirming Resolve and pull in the demo writes nothing: the outcome is the one the dashboard would report.
    resolvePull: (repoId, claim) => {
      const result = simulatedResolve(repoId, claim.upstream);
      if (!result) return new Promise((_, reject) => setTimeout(() => reject(new Error("not a tracked, successfully scanned git repository")), latencyMs));
      generatedAt = new Date(now()).toISOString();
      return new Promise((resolve) => setTimeout(() => resolve(structuredClone(result)), PULL_MS));
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
    startIntegration: (path) => attempt(() => demoSessions.openIntegration(path)),
    createProject: () => new Promise((_, reject) => setTimeout(() => reject(new ApiError(503, "the demo does not create folders")), latencyMs)),
    resumeSession: (id) => attempt(() => demoSessions.resume(id)),
    shipSession: (id) => attempt(() => demoSessions.ship(id)),
    resolveConflicts: (id) => attempt(() => demoSessions.resolveConflicts(id)),
    removeWorktree: (repoId, name) => attempt(() => demoSessions.removeWorktree(repoId, name)),
    closeSession: (id, removeWorktree) => attempt(() => demoSessions.close(id, removeWorktree)),
    deleteSession: (id) => attempt(() => demoSessions.delete(id)),
    worktreeStatus: (id) => attempt(() => demoSessions.status(id)),
    promptSession: (id, action) => attempt(() => demoSessions.prompt(id, action)),
    openTerminal: (id, handlers) => demoSessions.terminal(id, handlers),
  };
}
