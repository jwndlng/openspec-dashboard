import { expect, test } from "bun:test";
import type { CleanupPreview } from "../src/shared/types.ts";
import {
  confirmLabel,
  hasRemovable,
  initialSelection,
  outcomeText,
  restoreCommand,
  selectionPayload,
  toggleBranch,
  toggleWorktree,
} from "../src/ui/cleanupState.ts";

const C1 = "1".repeat(40);
const C2 = "2".repeat(40);
const C3 = "3".repeat(40);

const preview: CleanupPreview = {
  repoId: "r",
  base: "origin/main",
  worktrees: [
    { path: "/w/acme/wt/audit-trail", branch: "feat/audit-trail", work: { state: "merged" }, managed: true, removable: true },
    {
      path: "/w/acme/wt/report",
      branch: "feat/report",
      work: { state: "uncommitted", count: 1 },
      managed: false,
      removable: false,
      reason: "the worktree has uncommitted changes",
    },
  ],
  prunable: [{ path: "/w/acme/wt/gone" }],
  branches: [
    { name: "feat/audit-trail", commit: C1, mergedBy: "content", worktreePath: "/w/acme/wt/audit-trail", removable: true },
    { name: "feat/done", commit: C2, mergedBy: "ancestry", removable: true },
    { name: "fix/parser", commit: C3, removable: false, reason: "2 commit(s) not in origin/main" },
  ],
};

test("removable items start selected and the confirm label names what will happen", () => {
  const s = initialSelection(preview);
  expect([...s.worktrees]).toEqual(["/w/acme/wt/audit-trail"]);
  expect([...s.branches]).toEqual(["feat/audit-trail", "feat/done"]);
  expect(confirmLabel(preview, s)).toBe("Remove 1 worktree, prune 1 record, delete 2 branches");
  expect(selectionPayload(preview, s)).toEqual({
    worktrees: ["/w/acme/wt/audit-trail"],
    prune: true,
    branches: [
      { name: "feat/audit-trail", commit: C1 },
      { name: "feat/done", commit: C2 },
    ],
  });
});

test("a branch goes with its worktree: deselecting the worktree drops it, selecting the branch brings the worktree", () => {
  let s = toggleWorktree(preview, initialSelection(preview), "/w/acme/wt/audit-trail", false);
  expect([...s.branches]).toEqual(["feat/done"]);
  s = toggleBranch(preview, s, "feat/audit-trail", true);
  expect([...s.worktrees]).toEqual(["/w/acme/wt/audit-trail"]);
  s = toggleBranch(preview, s, "feat/audit-trail", false);
  expect([...s.worktrees]).toEqual(["/w/acme/wt/audit-trail"]); // the worktree may go on its own
});

test("nothing selected means no confirm label; nothing removable is said", () => {
  const none = { worktrees: new Set<string>(), prune: false, branches: new Set<string>() };
  expect(confirmLabel(preview, none)).toBe("");
  const kept: CleanupPreview = { repoId: "r", worktrees: [preview.worktrees[1]], prunable: [], branches: [preview.branches[2]] };
  expect(hasRemovable(kept)).toBe(false);
  expect(confirmLabel(kept, initialSelection(kept))).toBe("");
  expect(hasRemovable(preview)).toBe(true);
});

test("deleted branches come with a restore command; kept items with their reason", () => {
  expect(restoreCommand({ kind: "branch", id: "feat/done", outcome: "deleted", commit: C2 })).toBe(`git branch feat/done ${C2}`);
  expect(restoreCommand({ kind: "worktree", id: "/w/x", outcome: "removed" })).toBeUndefined();
  expect(outcomeText({ kind: "branch", id: "feat/done", outcome: "kept", reason: "it changed since the preview" })).toBe("kept: it changed since the preview");
  expect(outcomeText({ kind: "prune", id: "/w/gone", outcome: "pruned" })).toBe("pruned");
});
