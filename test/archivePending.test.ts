import { expect, test } from "bun:test";
import type { SessionWorktree, WorkState } from "../src/shared/types.ts";
import { archivePending } from "../src/ui/sessionState.ts";

const main = { path: "/w/acme/alpha-infra", branch: "main", isMain: true };
const linked = { path: "/w/acme/alpha-infra-wt", branch: "chore/archive-add-audit-log", isMain: false };
const card = (checkout?: typeof main) => ({ repoId: "a1", name: "add-audit-log", checkout });
const tree = (state: WorkState, change = "add-audit-log", repoId = "a1"): SessionWorktree => ({
  repoId,
  name: `${change}-archive`,
  path: `/h/worktrees/${repoId}/${change}-archive`,
  change,
  action: "archive",
  work: { state },
});

test("an archive found only in a linked worktree is pending", () => {
  expect(archivePending(card(linked), [])).toBe(true);
});

test("an archive the main checkout holds is merged", () => {
  expect(archivePending(card(main), [])).toBe(false);
  expect(archivePending(card(main), [tree("clean"), tree("missing")])).toBe(false);
});

test("an archive in a worktree whose work is merged only waits for a pull: merged", () => {
  expect(archivePending(card(linked), [tree("merged")])).toBe(false);
});

test("unshipped work in the change's worktree keeps it pending, even once main holds the archive", () => {
  for (const state of ["uncommitted", "unpushed", "pushed"] as const) expect(archivePending(card(main), [tree(state)])).toBe(true);
  expect(archivePending(card(linked), [tree("merged"), tree("unpushed")])).toBe(true);
});

test("worktrees of other changes or repositories do not count", () => {
  expect(archivePending(card(main), [tree("unpushed", "other-change"), tree("unpushed", "add-audit-log", "b2")])).toBe(false);
  expect(archivePending(card(linked), [tree("merged", "other-change")])).toBe(true);
});

test("without git (no checkout) an archive is merged", () => {
  expect(archivePending(card(), [])).toBe(false);
});
