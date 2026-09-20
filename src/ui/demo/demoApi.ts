// In-memory stand-in for the dashboard server. Nothing is read from or written to anywhere: a reload starts over.
import type { Config, RepoSnapshot, Snapshot } from "../../shared/types.ts";
import type { Api } from "../api.ts";
import { buildSample, DEMO_ROOT } from "./sampleData.ts";

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

  const snapshot = (): Snapshot => ({
    generatedAt,
    repos: config.repos
      .filter((r) => r.enabled)
      .map((r) => {
        const known = sample.snapshot.repos.find((s) => s.id === r.id);
        return known ? { ...known, name: r.name } : emptyRepo(r.id, r.name, r.path);
      }),
  });

  return {
    state: () => reply(snapshot()),
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
  };
}
