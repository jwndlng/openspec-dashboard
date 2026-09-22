// Sample data for the demo build. Everything here is made up: fictional repositories under /home/demo/, invented
// change names. Never paste real repository or change names into this file — the demo is published publicly, and
// test/demoData.test.ts fails on anything that looks like a real home directory.
//
// Ages are relative to `now`, so the published demo never looks abandoned. Column and stage are derived with the
// same rules the scanner uses, so the sample cannot disagree with the board.
import { defaultAgentSessions } from "../../shared/agentDefaults.ts";
import { deriveStage } from "../../shared/columns.ts";
import type { ArtifactStatus, ChangeSnapshot, CheckoutStatus, Config, RepoConfig, RepoSnapshot, Snapshot, Worktree } from "../../shared/types.ts";
import { summarizeWorkInProgress } from "../../shared/workInProgress.ts";

/** Appears in the demo bundle only; test/demoBundle.test.ts uses it to tell the two bundles apart. */
export const DEMO_MARKER = "openspec-dashboard-demo-build";
export const DEMO_ROOT = "/home/demo/work";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SCHEMA = "spec-driven";
/** Schema order (specs before design); the board shows design first. */
const ARTIFACT_IDS = ["proposal", "specs", "design", "tasks"];

/** How far the artifacts are written. "planned" means all four exist. */
type Written = "none" | "proposal" | "design" | "specs" | "planned";
const WRITTEN: Record<Written, string[]> = {
  none: [],
  proposal: ["proposal"],
  design: ["proposal", "design"],
  specs: ["proposal", "design", "specs"],
  planned: ARTIFACT_IDS,
};

interface SampleChange {
  name: string;
  written?: Written;
  /** [done, total]; implies every artifact is written unless `written` says otherwise. */
  tasks?: [number, number];
  /** Age of the last activity in days. */
  age: number;
  synced?: boolean;
  branch?: string;
  warnings?: string[];
}

/** The states a checkout chip can show; `detached` has no branch. */
export type CheckoutState = "clean" | "uncommitted" | "ahead" | "never-pushed" | "behind" | "detached" | "stale" | "locked" | "unknown";

interface SampleRepo {
  id: string;
  name: string;
  branch: string;
  /** State of the main checkout; clean when omitted. */
  main?: CheckoutState;
  /** Age of the last openspec/ update in hours. */
  updated: number;
  /** Linked worktrees as [branch, state]. */
  worktrees?: [string, CheckoutState][];
  error?: string;
  warnings?: string[];
  changes: SampleChange[];
  /** [name, archived days ago, task total] */
  archived: [string, number, number][];
}

const CLEAN: CheckoutStatus = { modified: 0, untracked: 0, conflicts: 0 };

/** One checkout the way the scanner would have recorded it. Every sample checkout comes from here, so states stay consistent. */
function checkout(path: string, branch: string, state: CheckoutState, isMain = false): Worktree {
  const base: Worktree = { path, head: "9f3c2ab", ...(isMain ? { isMain } : {}) };
  const upstream = `origin/${branch}`;
  const tracked = (extra: Partial<CheckoutStatus> = {}, unpushed = 0): Worktree => ({ ...base, branch, status: { ...CLEAN, upstream, ahead: unpushed, behind: 0, ...extra }, unpushed });
  switch (state) {
    case "clean":
      return tracked();
    case "uncommitted":
      return tracked({ modified: 4, untracked: 1 });
    case "ahead":
      return tracked({}, 2);
    case "behind":
      return tracked({ behind: 5 });
    case "never-pushed":
      return { ...base, branch, status: CLEAN, unpushed: 3 };
    case "detached":
      return { ...base, detached: true, status: CLEAN, unpushed: 1 };
    case "stale":
      return { ...base, branch, prunable: true };
    case "locked":
      return { ...tracked(), locked: true, lockReason: "agent session running" };
    case "unknown":
      return { ...base, branch, status: "unknown" };
  }
}

/** What each artifact waits for in the spec-driven schema. */
const REQUIRES: Record<string, string[]> = { proposal: [], specs: ["proposal"], design: ["proposal"], tasks: ["specs", "design"] };

function artifacts(written: Written): ArtifactStatus[] {
  const done = WRITTEN[written];
  return ARTIFACT_IDS.map((id) => ({
    id,
    status: done.includes(id) ? "done" : REQUIRES[id].every((dep) => done.includes(dep)) ? "ready" : "blocked",
  }));
}

const REPOS: SampleRepo[] = [
  {
    id: "a71c02e9",
    name: "atlas-api",
    branch: "main",
    updated: 2,
    worktrees: [
      ["feat/add-rate-limiting", "uncommitted"],
      ["fix/flaky-health-check", "never-pushed"],
    ],
    changes: [
      { name: "add-rate-limiting", tasks: [9, 14], age: 0.1, branch: "feat/add-rate-limiting" },
      { name: "paginate-list-endpoints", tasks: [3, 22], age: 2 },
      { name: "migrate-to-postgres-16", tasks: [0, 31], age: 5 },
      { name: "structured-error-codes", written: "specs", age: 1 },
      { name: "idempotency-keys", written: "proposal", age: 9 },
      { name: "deprecate-v1-auth", tasks: [12, 12], age: 3 },
      { name: "openapi-examples", tasks: [8, 8], age: 6, synced: true },
      { name: "graphql-gateway-spike", written: "none", age: 0.3 },
    ],
    archived: [
      ["add-health-endpoint", 4, 6],
      ["request-id-propagation", 8, 11],
      ["split-billing-module", 15, 27],
      ["cache-user-lookups", 22, 9],
      ["rotate-signing-keys", 31, 13],
      ["bulk-import-endpoint", 44, 18],
      ["drop-legacy-webhooks", 58, 7],
      ["audit-log-retention", 71, 15],
    ],
  },
  {
    id: "4be0d5a3",
    name: "harbor-web",
    branch: "feat/redesign-settings-page",
    main: "uncommitted",
    updated: 5,
    changes: [
      { name: "redesign-settings-page", tasks: [17, 24], age: 0.2, branch: "feat/redesign-settings-page" },
      { name: "dark-mode-tokens", tasks: [5, 9], age: 4 },
      { name: "keyboard-shortcuts", tasks: [0, 16], age: 11 },
      { name: "offline-drafts", written: "design", age: 7 },
      { name: "virtualize-long-tables", written: "proposal", age: 2 },
      { name: "replace-date-picker", tasks: [10, 10], age: 1 },
      { name: "onboarding-checklist", written: "planned", tasks: [0, 0], age: 13, warnings: ["tasks file has no tasks"] },
    ],
    archived: [
      ["accessible-modals", 3, 12],
      ["lazy-load-charts", 9, 8],
      ["unify-form-validation", 17, 21],
      ["remove-jquery-remnants", 26, 14],
      ["toast-notifications", 39, 6],
      ["csv-export-button", 52, 5],
      ["session-timeout-warning", 66, 9],
    ],
  },
  {
    id: "c9317f64",
    name: "lantern-infra",
    branch: "main",
    worktrees: [
      ["chore/upgrade-terraform", "clean"],
      ["spike/bisect-slow-plan", "detached"],
      ["feat/abandoned-dns-module", "stale"],
    ],
    updated: 26,
    warnings: ["openspec/config.yaml: unknown key `defaults` ignored"],
    changes: [
      { name: "centralize-log-shipping", tasks: [21, 38], age: 1 },
      { name: "pin-terraform-providers", tasks: [6, 7], age: 19 },
      { name: "blue-green-deploys", tasks: [0, 26], age: 3 },
      { name: "rotate-database-credentials", tasks: [0, 12], age: 24 },
      { name: "cost-allocation-tags", written: "specs", age: 8 },
      { name: "regional-failover-runbook", written: "design", age: 47 },
      { name: "adopt-policy-as-code", written: "proposal", age: 33, warnings: ["design.md: could not read artifact status"] },
      { name: "shrink-staging-cluster", tasks: [9, 9], age: 16, synced: true },
    ],
    archived: [
      ["enable-vpc-flow-logs", 6, 10],
      ["migrate-state-backend", 12, 19],
      ["harden-bastion-access", 20, 16],
      ["alerting-on-cert-expiry", 28, 7],
      ["retire-old-build-agents", 37, 11],
      ["backup-restore-drills", 49, 14],
      ["tag-untagged-resources", 63, 22],
      ["consolidate-dns-zones", 80, 9],
    ],
  },
  {
    id: "2f86b0cd",
    name: "quill-docs",
    branch: "main",
    updated: 70,
    changes: [
      { name: "versioned-api-reference", tasks: [4, 15], age: 3 },
      { name: "search-synonyms", written: "planned", tasks: [0, 8], age: 6 },
      { name: "contributor-style-guide", written: "proposal", age: 21 },
      { name: "broken-link-checker", tasks: [6, 6], age: 10 },
    ],
    archived: [
      ["move-to-static-generator", 14, 25],
      ["glossary-page", 35, 5],
      ["code-sample-tabs", 55, 8],
      ["docs-feedback-widget", 90, 10],
    ],
  },
  {
    id: "e05a9b17",
    name: "ember-mobile",
    branch: "release/4.2",
    updated: 9,
    main: "behind",
    worktrees: [
      ["feat/biometric-login", "ahead"],
      ["fix/push-token-refresh", "locked"],
    ],
    changes: [
      { name: "biometric-login", tasks: [11, 19], age: 0.4, branch: "feat/biometric-login" },
      { name: "push-token-refresh", tasks: [2, 5], age: 1, branch: "fix/push-token-refresh" },
      { name: "offline-sync-queue", tasks: [0, 28], age: 4 },
      { name: "tablet-layouts", written: "design", age: 12 },
      { name: "in-app-review-prompt", written: "none", age: 2 },
      { name: "reduce-cold-start", written: "specs", age: 5 },
    ],
    archived: [
      ["migrate-navigation-library", 7, 23],
      ["deep-link-routing", 19, 12],
      ["crash-report-symbols", 33, 6],
      ["localize-onboarding", 47, 17],
      ["image-cache-eviction", 75, 9],
    ],
  },
  {
    id: "6d44c1f8",
    name: "orbit-data",
    branch: "main",
    worktrees: [["feat/backfill-events", "unknown"]],
    updated: 120,
    error: "openspec list failed: openspec/changes/backfill-events/.openspec.yaml: unexpected end of file",
    changes: [
      { name: "partition-events-table", tasks: [7, 20], age: 5 },
      { name: "backfill-events", written: "proposal", age: 5 },
      { name: "schema-registry", tasks: [0, 17], age: 18 },
    ],
    archived: [
      ["dedupe-ingest-pipeline", 25, 13],
      ["nightly-quality-report", 60, 8],
    ],
  },
];

/** Found by discovery but not tracked, so Settings has something under "Discovered". */
const CANDIDATES: [string, string][] = [
  ["9a20e6b1", "pebble-cli"],
  ["b7f3108c", "tide-notifications"],
  ["53cd9e70", "playground/spec-experiments"],
];

function repoPath(name: string): string {
  return `${DEMO_ROOT}/${name}`;
}

export interface Sample {
  snapshot: Snapshot;
  config: Config;
  candidates: RepoConfig[];
}

export function buildSample(now: number): Sample {
  const iso = (ageMs: number) => new Date(now - ageMs).toISOString();
  const day = (ageDays: number) => iso(ageDays * DAY).slice(0, 10);

  const repos: RepoSnapshot[] = REPOS.map((r) => {
    const open: ChangeSnapshot[] = r.changes.map((c) => {
      const written = c.written ?? "planned";
      const input = {
        archived: false,
        schema: SCHEMA,
        artifacts: artifacts(written),
        tasks: c.tasks ? { done: c.tasks[0], total: c.tasks[1] } : null,
        specsSynced: c.synced,
      };
      return {
        repoId: r.id,
        name: c.name,
        schema: SCHEMA,
        artifacts: input.artifacts,
        tasks: input.tasks,
        created: day(c.age + 6),
        lastActivityAt: iso(c.age * DAY),
        branchMatch: c.branch,
        specsSynced: c.synced,
        warnings: c.warnings,
        ...deriveStage(input),
      };
    });
    const archived: ChangeSnapshot[] = r.archived.map(([name, age, total]) => {
      const input = { archived: true, schema: SCHEMA, artifacts: artifacts("planned"), tasks: { done: total, total } };
      return {
        repoId: r.id,
        name,
        schema: SCHEMA,
        artifacts: input.artifacts,
        tasks: input.tasks,
        created: day(age + 20),
        archived: day(age),
        lastActivityAt: iso(age * DAY),
        ...deriveStage(input),
      };
    });
    const worktrees = [
      checkout(repoPath(r.name), r.branch, r.main ?? "clean", true),
      ...(r.worktrees ?? []).map(([branch, state]) => checkout(`${repoPath(r.name)}-worktrees/${branch.replace("/", "-")}`, branch, state)),
    ];
    return {
      id: r.id,
      name: r.name,
      path: repoPath(r.name),
      ok: r.error === undefined,
      error: r.error,
      warnings: r.warnings,
      scannedAt: iso(r.error ? 3 * HOUR : 0),
      isGit: true,
      currentBranch: r.branch,
      worktrees,
      workInProgress: summarizeWorkInProgress(worktrees),
      lastUpdatedAt: iso(r.updated * HOUR),
      changes: [...open, ...archived],
    } satisfies RepoSnapshot;
  });

  const config = {
    version: 1,
    scanRoots: [DEMO_ROOT],
    repos: REPOS.map((r) => ({ id: r.id, path: repoPath(r.name), name: r.name, enabled: true })),
    pollIntervalSeconds: 60,
    port: 4711,
    agentSessions: defaultAgentSessions(), // off: a static demo has no agent to start
  } satisfies Config;

  const candidates = CANDIDATES.map(([id, name]) => ({ id, path: repoPath(name), name: name.split("/").pop() ?? name, enabled: false })) satisfies RepoConfig[];

  return { snapshot: { generatedAt: iso(0), repos }, config, candidates };
}
