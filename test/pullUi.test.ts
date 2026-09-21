import { expect, test } from "bun:test";
import type { PullResult } from "../src/shared/types.ts";
import { branchNotice, pullNeedsReport, pullOutcome } from "../src/ui/pullState.ts";

const result = (patch: Partial<PullResult>): PullResult => ({ repoId: "r", fetched: true, update: "up-to-date", branch: "main", upstream: "origin/main", defaultBranch: "main", ...patch });

test("every outcome reads as text, with the reason available", () => {
  expect(pullOutcome(result({ update: "fast-forwarded", commits: 3 }))).toMatchObject({ label: "+3 commits", tone: "success" });
  expect(pullOutcome(result({ update: "fast-forwarded", commits: 1 })).label).toBe("+1 commit");
  expect(pullOutcome(result({ update: "fast-forwarded", commits: 2, hooksSkipped: true })).detail).toContain("post-merge hook was not run");
  expect(pullOutcome(result({}))).toMatchObject({ label: "up to date", tone: "" });
  expect(pullOutcome(result({ update: "skipped", reason: "on feat/redesign, not main; only fetched" }))).toEqual({ label: "fetched only", tone: "warning", detail: "Fetched, but the checkout was not updated: on feat/redesign, not main; only fetched." });
  expect(pullOutcome(result({ fetched: false, update: "skipped", reason: "no remote configured; there is nothing to pull" }))).toMatchObject({ label: "nothing to pull", tone: "" });
  expect(pullOutcome(result({ update: "refused", reason: "local and remote have diverged (1 ahead, 2 behind)" }))).toMatchObject({ label: "refused", tone: "warning" });
  expect(pullOutcome(result({ fetched: false, update: "failed", reason: "Could not read from remote repository." })).detail).toBe("Could not fetch: Could not read from remote repository.");
  expect(pullOutcome(result({ fetched: false, update: "failed", reason: "timed out" }))).toEqual({ label: "failed", tone: "danger", detail: "Could not fetch: timed out." });
});

test("an outcome that left the checkout behind is reported, the rest only badged", () => {
  // stated: the pull was asked for to bring the checkout up to date and it did not
  expect(pullNeedsReport(result({ update: "skipped", reason: "on feat/redesign, not main; only fetched" }))).toBe(true);
  expect(pullNeedsReport(result({ update: "refused", reason: "local and remote have diverged (1 ahead, 2 behind)" }))).toBe(true);
  expect(pullNeedsReport(result({ fetched: false, update: "failed", reason: "timed out" }))).toBe(true);
  // nothing to say: the checkout is as current as the remote can make it
  expect(pullNeedsReport(result({ update: "fast-forwarded", commits: 3 }))).toBe(false);
  expect(pullNeedsReport(result({}))).toBe(false);
  expect(pullNeedsReport(result({ fetched: false, update: "skipped", reason: "no remote configured; there is nothing to pull" }))).toBe(false);
});

test("the notice appears only off a known default branch, and says what it means", () => {
  expect(branchNotice({ currentBranch: "main", defaultBranch: "main", onDefaultBranch: true })).toBeUndefined();
  expect(branchNotice({ currentBranch: "develop" })).toBeUndefined(); // nobody knows the default branch: claim nothing
  expect(branchNotice({ currentBranch: "develop", onDefaultBranch: false })).toBeUndefined();
  const off = branchNotice({ currentBranch: "feat/redesign-settings-page", defaultBranch: "main", onDefaultBranch: false });
  expect(off?.short).toBe("on feat/redesign-settings-page, not main");
  expect(off?.long).toContain("Archived changes, specs and progress shown for this repository come from that branch and may be outdated");
  expect(off?.long).toContain("Changes that live in worktrees are read from their own checkouts and are not affected");
  expect(branchNotice({ defaultBranch: "trunk", onDefaultBranch: false })?.short).toBe("on a detached HEAD, not trunk");
});
