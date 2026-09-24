import { expect, test } from "bun:test";
import { parseStatusV2, parseWorktrees } from "../src/server/git.ts";
import { parseTaskProgress } from "../src/server/tasksParser.ts";
import { boardColumns, deriveStage, isComplete } from "../src/shared/columns.ts";
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
    "HEAD 1234567890abcdef",
    "detached",
    "",
    "worktree /repo/.worktrees/held",
    "HEAD 456",
    "branch refs/heads/fix/held",
    "locked",
    "",
    "worktree /repo/.worktrees/held with reason",
    "HEAD 789",
    "branch refs/heads/fix/held-2",
    "locked agent session still running",
    "",
    "worktree /repo/.worktrees/gone",
    "HEAD 0ab",
    "branch refs/heads/feat/gone",
    "prunable gitdir file points to non-existent location",
    "",
  ].join("\n");
  expect(parseWorktrees(porcelain)).toEqual([
    { path: "/repo", head: "abc", branch: "main", isMain: true },
    { path: "/repo/.worktrees/feat", head: "def", branch: "feat/structured-report-format" },
    { path: "/repo/.worktrees/detached", head: "1234567", detached: true },
    { path: "/repo/.worktrees/held", head: "456", branch: "fix/held", locked: true },
    { path: "/repo/.worktrees/held with reason", head: "789", branch: "fix/held-2", locked: true, lockReason: "agent session still running" },
    { path: "/repo/.worktrees/gone", head: "0ab", branch: "feat/gone", prunable: true },
  ]);
  expect(parseWorktrees("")).toEqual([]);
});

test("a bare main record is flagged and is still the main entry", () => {
  const porcelain = ["worktree /srv/repo.git", "bare", "", "worktree /w/feat", "HEAD abc", "branch refs/heads/feat/x", ""].join("\n");
  expect(parseWorktrees(porcelain)).toEqual([
    { path: "/srv/repo.git", bare: true, isMain: true },
    { path: "/w/feat", head: "abc", branch: "feat/x" },
  ]);
});

const OID = "1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e";
const statusV2 = (...lines: string[]) => parseStatusV2([...lines, ""].join("\n"));
const CLEAN = { detached: false, unborn: false, modified: 0, untracked: 0, conflicts: 0 };

test("status v2: clean with upstream, ahead and behind", () => {
  const branch = [`# branch.oid ${OID}`, "# branch.head feat/report", "# branch.upstream origin/feat/report"];
  expect(statusV2(...branch, "# branch.ab +0 -0")).toEqual({ ...CLEAN, head: "feat/report", upstream: "origin/feat/report", ahead: 0, behind: 0 });
  expect(statusV2(...branch, "# branch.ab +2 -5")).toMatchObject({ ahead: 2, behind: 5 });
});

test("status v2: modified, staged, renamed, unmerged and untracked entries are counted, never named", () => {
  const parsed = statusV2(
    `# branch.oid ${OID}`,
    "# branch.head main",
    `1 .M N... 100644 100644 100644 ${OID} ${OID} src/edited.ts`,
    `1 A. N... 000000 100644 100644 ${OID} ${OID} src/staged new.ts`,
    `2 R. N... 100644 100644 100644 ${OID} ${OID} R100 src/new-name.ts\tsrc/old-name.ts`,
    `u UU N... 100644 100644 100644 100644 ${OID} ${OID} ${OID} src/conflict.ts`,
    "? scratch/",
    "? notes.md",
    "! ignored.log",
  );
  expect(parsed).toEqual({ ...CLEAN, head: "main", modified: 4, conflicts: 1, untracked: 2 });
  expect(JSON.stringify(parsed)).not.toContain("src/");
});

test("status v2: no upstream, detached and unborn", () => {
  const noUpstream = statusV2(`# branch.oid ${OID}`, "# branch.head feat/never-pushed");
  expect(noUpstream).toEqual({ ...CLEAN, head: "feat/never-pushed" });
  expect(noUpstream.upstream).toBeUndefined();
  expect(noUpstream.ahead).toBeUndefined();
  // An upstream that is configured but gone has no ahead/behind line.
  expect(statusV2(`# branch.oid ${OID}`, "# branch.head x", "# branch.upstream origin/x")).toEqual({ ...CLEAN, head: "x", upstream: "origin/x" });
  expect(statusV2(`# branch.oid ${OID}`, "# branch.head (detached)")).toEqual({ ...CLEAN, detached: true });
  expect(statusV2("# branch.oid (initial)", "# branch.head main", "? a.md", "? b.md")).toEqual({ ...CLEAN, head: "main", unborn: true, untracked: 2 });
  expect(parseStatusV2("")).toEqual(CLEAN);
});

const A = (...pairs: [string, ArtifactStatus["status"]][]): ArtifactStatus[] => pairs.map(([id, status]) => ({ id, status }));
// Artifacts in the order the spec-driven schema declares them (specs before design), with the named ones done.
const specDriven = (...done: string[]) => A(...["proposal", "specs", "design", "tasks"].map((id): [string, ArtifactStatus["status"]] => [id, done.includes(id) ? "done" : "ready"]));
const ALL = ["proposal", "specs", "design", "tasks"];
const stage = (artifacts: ArtifactStatus[], tasks: { done: number; total: number } | null, extra: { archived?: boolean } = {}) =>
  deriveStage({ archived: false, artifacts, tasks, ...extra });
const LIFECYCLE = ["Backlog", "Drafts", "Ready", "Implementing", "Done", "Archived"];

test("column derivation: backlog until something is written, drafts until everything is", () => {
  expect(stage(specDriven(), null)).toEqual({ stage: "backlog", column: "Backlog" });
  expect(stage(specDriven("proposal"), null)).toEqual({ stage: "drafts", column: "Drafts" });
  expect(stage(specDriven("proposal", "design"), null)).toEqual({ stage: "drafts", column: "Drafts" });
  expect(stage(specDriven("proposal", "specs"), null)).toEqual({ stage: "drafts", column: "Drafts" });
  // which artifact is written does not matter, only that one is
  expect(stage(specDriven("specs"), null)).toEqual({ stage: "drafts", column: "Drafts" });
  expect(stage(specDriven("proposal", "design", "specs"), { done: 0, total: 0 })).toEqual({ stage: "drafts", column: "Drafts" });
  expect(stage(specDriven(...ALL), null)).toEqual({ stage: "ready", column: "Ready" });
  expect(stage(specDriven(...ALL), { done: 0, total: 12 })).toEqual({ stage: "ready", column: "Ready" });
  expect(stage(specDriven(...ALL), { done: 0, total: 0 })).toEqual({ stage: "ready", column: "Ready" });
  expect(stage(specDriven(...ALL), { done: 1, total: 12 })).toEqual({ stage: "implementing", column: "Implementing" });
  // ticked tasks win even while an artifact is still open
  expect(stage(specDriven("proposal", "specs"), { done: 2, total: 12 })).toEqual({ stage: "implementing", column: "Implementing" });
  expect(stage([], null)).toEqual({ stage: "unknown", column: "Unknown" });
  // any schema is placed the same way
  expect(stage(A(["brief", "done"], ["plan", "ready"], ["checklist", "blocked"]), null)).toEqual({ stage: "drafts", column: "Drafts" });
});

test("column derivation: every complete change is Done until archived", () => {
  expect(stage(specDriven(...ALL), { done: 12, total: 12 })).toEqual({ stage: "done", column: "Done" });
  expect(stage(specDriven(...ALL), { done: 3, total: 3 }, { archived: true })).toEqual({ stage: "archived", column: "Archived" });
  expect([isComplete("done"), isComplete("implementing"), isComplete("archived")]).toEqual([true, false, false]);
});

test("board columns: the lifecycle columns for every schema, Unknown only when needed", () => {
  const change = (schema: string, artifacts: ArtifactStatus[], column = "Drafts") => ({
    repoId: "r", name: "c", schema, artifacts, tasks: null, stage: "drafts" as const, column,
  });
  const snap = (changes: ReturnType<typeof change>[]): Snapshot => ({
    generatedAt: "",
    repos: [{ id: "r", name: "r", path: "/r", ok: true, scannedAt: "", isGit: false, worktrees: [], changes }],
  });
  expect(boardColumns(snap([change("spec-driven", specDriven())]))).toEqual(LIFECYCLE);
  expect(boardColumns(snap([change("plain", A(["brief", "done"], ["plan", "ready"], ["checklist", "blocked"]))]))).toEqual(LIFECYCLE);
  expect(boardColumns(snap([change("spec-driven", specDriven()), change("tdd", A(["spec", "done"], ["tests", "ready"]))]))).toEqual(LIFECYCLE);
  expect(boardColumns(snap([]))).toEqual(LIFECYCLE);
  expect(boardColumns(snap([change("spec-driven", [], "Unknown")]))).toEqual(["Backlog", "Drafts", "Unknown", "Ready", "Implementing", "Done", "Archived"]);
});
