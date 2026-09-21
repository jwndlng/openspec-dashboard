// In-memory stand-in for the dashboard server. Nothing is read from or written to anywhere: a reload starts over.
import { pageEvents } from "../../shared/activity.ts";
import type { Config, RepoSharedConfig, RepoSnapshot, SharedConfigApplyResult, SharedConfigPreview, SharedProfile, Snapshot } from "../../shared/types.ts";
import type { Api } from "../api.ts";
import { buildSample, DEMO_ROOT, buildActivity } from "./sampleData.ts";

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

  const activityLog = buildActivity(sample.snapshot, now());

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

  return {
    state: () => reply(snapshot()),
    // Built once from the sample, like a log that was written while the sample came about; filtered and paged like the real one.
    activity: (query) => reply(pageEvents(activityLog, query)),
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
    sessions: () => reply({ sessions: [], agents: [], worktrees: [] }),
    openSession: () => Promise.reject(new Error(NO_SESSIONS)),
    resumeSession: () => Promise.reject(new Error(NO_SESSIONS)),
    shipSession: () => Promise.reject(new Error(NO_SESSIONS)),
    removeWorktree: () => Promise.reject(new Error(NO_SESSIONS)),
    closeSession: () => Promise.reject(new Error(NO_SESSIONS)),
    deleteSession: () => Promise.reject(new Error(NO_SESSIONS)),
    worktreeStatus: () => Promise.reject(new Error(NO_SESSIONS)),
    promptSession: () => Promise.reject(new Error(NO_SESSIONS)),
  };
}
