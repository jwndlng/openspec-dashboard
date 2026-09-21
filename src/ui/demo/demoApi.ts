// In-memory stand-in for the dashboard server. Nothing is read from or written to anywhere: a reload starts over.
import type { ChangeSnapshot, Config, RepoSharedConfig, RepoSnapshot, SharedConfigApplyResult, SharedConfigPreview, SharedProfile, Snapshot } from "../../shared/types.ts";
import { ApiError, type Api } from "../api.ts";
import { sampleArtifactFiles } from "./sampleArtifacts.ts";
import { buildSample, DEMO_ROOT } from "./sampleData.ts";

const NO_SESSIONS = "agent sessions need the dashboard server and a local agent CLI; they are not part of the demo";

export interface DemoApiOptions {
  now?: () => number;
  /** Simulated round trip, long enough for loading states to show. */
  latencyMs?: number;
}

export function createDemoApi({ now = Date.now, latencyMs = 150 }: DemoApiOptions = {}): Api {
  const sample = buildSample(now());
  let config: Config = sample.config;
  let generatedAt = sample.snapshot.generatedAt;

  const reply = <T>(value: T): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), latencyMs));

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
  let profiles: SharedProfile[] = [];
  const carried = new Map<string, SharedProfile[]>();
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

  const snapshot = (): Snapshot => ({
    generatedAt,
    repos: config.repos
      .filter((r) => r.enabled)
      .map((r) => {
        const known = sample.snapshot.repos.find((s) => s.id === r.id);
        const repo = known ? { ...known, name: r.name } : emptyRepo(r.id, r.name, r.path);
        return profiles.length > 0 ? { ...repo, sharedConfig: sharedState(r.id) } : repo;
      }),
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
    config: () => reply(config),
    saveConfig: (next) => {
      config = structuredClone(next);
      return reply(config);
    },
    discover: (scanRoots) => {
      const roots = scanRoots ?? config.scanRoots;
      const inDemo = (root: string) => root === DEMO_ROOT || root.startsWith(`${DEMO_ROOT}/`) || DEMO_ROOT.startsWith(`${root.replace(/\/+$/, "")}/`);
      const tracked = new Set(config.repos.map((r) => r.id));
      return reply({
        candidates: roots.some(inDemo) ? sample.candidates.filter((c) => !tracked.has(c.id)) : [],
        errors: roots.filter((root) => !inDemo(root)).map((root) => ({ root, message: "The demo cannot read your disk; only the sample workspace exists here." })),
      });
    },
    scan: () => {
      generatedAt = new Date(now()).toISOString();
      return reply({ started: true });
    },
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

    // Agent sessions start a local CLI; there is nothing to start in a static demo, and its config keeps them off.
    sessions: () => reply({ sessions: [], agent: { available: false, reason: "agent sessions are not available in the demo" } }),
    openSession: () => Promise.reject(new Error(NO_SESSIONS)),
    sendMessage: () => Promise.reject(new Error(NO_SESSIONS)),
    stopSession: () => Promise.reject(new Error(NO_SESSIONS)),
    cancelSession: () => Promise.reject(new Error(NO_SESSIONS)),
    closeSession: () => Promise.reject(new Error(NO_SESSIONS)),
    deleteSession: () => Promise.reject(new Error(NO_SESSIONS)),
    worktreeStatus: () => Promise.reject(new Error(NO_SESSIONS)),
  };
}
