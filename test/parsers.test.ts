import { expect, test } from "bun:test";
import { parseWorktrees } from "../src/server/git.ts";
import { parseTaskProgress } from "../src/server/tasksParser.ts";
import { artifactLabel, boardColumns, deriveStage, displayOrder, isComplete } from "../src/shared/columns.ts";
import type { ArtifactStatus, Snapshot } from "../src/shared/types.ts";

test("task progress counts mixed list markers", () => {
  const md = ["## 1. Setup", "- [x] 1.1 a", "* [ ] 1.2 b", "1. [X] 1.3 c", "+ [ ] d", "2) [x] e", "- not a task", "[x] no marker"].join("\n");
  expect(parseTaskProgress(md)).toEqual({ done: 3, total: 5 });
  expect(parseTaskProgress("")).toEqual({ done: 0, total: 0 });
});

test("worktree porcelain parsing: main first, detached kept, flags read", () => {
  const porcelain = [
    "worktree /repo",
    "HEAD abc",
    "branch refs/heads/main",
    "",
    "worktree /repo/.worktrees/feat",
    "HEAD def",
    "branch refs/heads/feat/structured-report-format",
    "",
    "worktree /repo/.worktrees/detached",
    "HEAD 123",
    "detached",
    "",
    "worktree /elsewhere/gone",
    "HEAD 456",
    "branch refs/heads/feat/gone",
    "prunable gitdir file points to non-existent location",
    "",
    "worktree /elsewhere/locked",
    "HEAD 789",
    "branch refs/heads/feat/locked",
    "locked in use",
    "",
  ].join("\n");
  expect(parseWorktrees(porcelain)).toEqual([
    { path: "/repo", branch: "main", isMain: true },
    { path: "/repo/.worktrees/feat", branch: "feat/structured-report-format" },
    { path: "/repo/.worktrees/detached", detached: true },
    { path: "/elsewhere/gone", branch: "feat/gone", prunable: true },
    { path: "/elsewhere/locked", branch: "feat/locked" },
  ]);
  expect(parseWorktrees("worktree /bare.git\nbare\n\nworktree /wt\nHEAD a\nbranch refs/heads/x\n")).toEqual([{ path: "/bare.git", bare: true, isMain: true }, { path: "/wt", branch: "x" }]);
  expect(parseWorktrees("")).toEqual([]);
});

const A = (...pairs: [string, ArtifactStatus["status"]][]): ArtifactStatus[] => pairs.map(([id, status]) => ({ id, status }));
// Artifacts in the order the spec-driven schema declares them (specs before design), with the named ones done.
const specDriven = (...done: string[]) => A(...["proposal", "specs", "design", "tasks"].map((id): [string, ArtifactStatus["status"]] => [id, done.includes(id) ? "done" : "ready"]));
const ALL = ["proposal", "specs", "design", "tasks"];
const stage = (artifacts: ArtifactStatus[], tasks: { done: number; total: number } | null, extra: { archived?: boolean; specsSynced?: boolean; schema?: string } = {}) =>
  deriveStage({ archived: false, schema: "spec-driven", artifacts, tasks, ...extra });

test("column derivation: a column names the last completed step", () => {
  expect(stage(specDriven(), null)).toEqual({ stage: "new", column: "New" });
  expect(stage(specDriven("proposal"), null)).toEqual({ stage: "artifact", column: "Proposal" });
  expect(stage(specDriven("proposal", "design"), null)).toEqual({ stage: "artifact", column: "Design" });
  // specs written before design: design comes first in display order, so the change has not got past Proposal
  expect(stage(specDriven("proposal", "specs"), null)).toEqual({ stage: "artifact", column: "Proposal" });
  expect(stage(specDriven("proposal", "design", "specs"), null)).toEqual({ stage: "artifact", column: "Specs" });
  expect(stage(specDriven(...ALL), null)).toEqual({ stage: "ready", column: "Ready" });
  expect(stage(specDriven(...ALL), { done: 0, total: 12 })).toEqual({ stage: "ready", column: "Ready" });
  expect(stage(specDriven(...ALL), { done: 0, total: 0 })).toEqual({ stage: "ready", column: "Ready" });
  expect(stage(specDriven(...ALL), { done: 1, total: 12 })).toEqual({ stage: "implementing", column: "Implementing" });
  // ticked tasks win even while an artifact is still open
  expect(stage(specDriven("proposal", "specs"), { done: 2, total: 12 })).toEqual({ stage: "implementing", column: "Implementing" });
  expect(stage([], null)).toEqual({ stage: "artifact", column: "Unknown" });
  expect(artifactLabel("delta-specs")).toBe("Delta Specs");
});

test("column derivation: complete changes split into Done and Synced, archived wins", () => {
  expect(stage(specDriven(...ALL), { done: 12, total: 12 })).toEqual({ stage: "done", column: "Done" });
  expect(stage(specDriven(...ALL), { done: 12, total: 12 }, { specsSynced: false })).toEqual({ stage: "done", column: "Done" });
  expect(stage(specDriven(...ALL), { done: 12, total: 12 }, { specsSynced: true })).toEqual({ stage: "synced", column: "Synced" });
  // sync state is irrelevant until every task is ticked
  expect(stage(specDriven(...ALL), { done: 3, total: 12 }, { specsSynced: true })).toEqual({ stage: "implementing", column: "Implementing" });
  expect(stage(specDriven(...ALL), { done: 3, total: 3 }, { archived: true, specsSynced: true })).toEqual({ stage: "archived", column: "Archived" });
  expect([isComplete("done"), isComplete("synced"), isComplete("implementing"), isComplete("archived")]).toEqual([true, true, false, false]);
});

test("display order: only spec-driven is reordered, unknown ids follow, other schemas are untouched", () => {
  const ids = (schema: string, list: string[]) => displayOrder(schema, list.map((id) => ({ id }))).map((a) => a.id);
  expect(ids("spec-driven", ["proposal", "specs", "design", "tasks"])).toEqual(["proposal", "design", "specs", "tasks"]);
  expect(ids("spec-driven", ["proposal", "research", "specs", "design", "review", "tasks"])).toEqual(["proposal", "design", "specs", "tasks", "research", "review"]);
  expect(ids("tdd", ["spec", "tests", "design"])).toEqual(["spec", "tests", "design"]);
  // another schema's change is placed by its own order
  const tdd = A(["spec", "done"], ["tests", "done"], ["implementation", "ready"]);
  expect(stage(tdd, null, { schema: "tdd" })).toEqual({ stage: "artifact", column: "Tests" });
});

test("board columns: New, artifact columns minus each schema's last, then the implementation states", () => {
  const change = (schema: string, artifacts: ArtifactStatus[], column = "Proposal") => ({
    repoId: "r", name: "c", schema, artifacts, tasks: null, stage: "artifact" as const, column,
  });
  const snap = (changes: ReturnType<typeof change>[]): Snapshot => ({
    generatedAt: "",
    repos: [{ id: "r", name: "r", path: "/r", ok: true, scannedAt: "", isGit: false, worktrees: [], changes }],
  });
  expect(boardColumns(snap([change("spec-driven", specDriven())]))).toEqual(["New", "Proposal", "Design", "Specs", "Ready", "Implementing", "Done", "Synced", "Archived"]);
  expect(boardColumns(snap([change("plain", A(["brief", "done"], ["plan", "ready"], ["checklist", "blocked"]))]))).toEqual(["New", "Brief", "Plan", "Ready", "Implementing", "Done", "Synced", "Archived"]);
  expect(
    boardColumns(snap([change("spec-driven", specDriven()), change("spec-driven", specDriven("proposal")), change("tdd", A(["spec", "done"], ["tests", "ready"], ["implementation", "blocked"]))])),
  ).toEqual(["New", "Proposal", "Design", "Specs", "Spec", "Tests", "Ready", "Implementing", "Done", "Synced", "Archived"]);
  // lifecycle columns are there even with nothing to show; Unknown only when a change needs it
  expect(boardColumns(snap([]))).toEqual(["New", "Ready", "Implementing", "Done", "Synced", "Archived"]);
  expect(boardColumns(snap([change("spec-driven", [], "Unknown")]))).toEqual(["New", "Unknown", "Ready", "Implementing", "Done", "Synced", "Archived"]);
});
