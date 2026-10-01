// The one rule that ties a cached pull request to a change: exact head branch, own repository, open first.
import { expect, test } from "bun:test";
import { linkedPullRequest } from "../src/shared/pullRequestLink.ts";
import type { PullRequest, RepoPullRequests } from "../src/shared/types.ts";

const HOUR = 3600_000;
const at = (hoursAgo: number) => new Date(Date.parse("2026-03-10T12:00:00Z") - hoursAgo * HOUR).toISOString();

const pr = (patch: Partial<PullRequest> & { number: number }): PullRequest => ({
  title: `change ${patch.number}`,
  url: `https://github.com/acme/alpha-infra/pull/${patch.number}`,
  author: "octo",
  head: "feat/add-validate-phase",
  base: "main",
  draft: false,
  state: "open",
  createdAt: at(10),
  review: "none",
  reviewRequestedFromViewer: false,
  checks: "none",
  ...patch,
});

const list = (repoId: string, pullRequests: PullRequest[], patch: Partial<RepoPullRequests> = {}): RepoPullRequests => ({
  repoId,
  github: `acme/${repoId}`,
  status: "ok",
  fetchedAt: at(0),
  pullRequests,
  ...patch,
});

const change = (branchMatch?: string, repoId = "alpha") => ({ repoId, branchMatch });

test("a pull request whose head branch is exactly the change's branch is its pull request", () => {
  const lists = [list("alpha", [pr({ number: 125 })])];
  expect(linkedPullRequest(change("feat/add-validate-phase"), lists)?.number).toBe(125);
});

test("no pull request for the branch means none", () => {
  expect(linkedPullRequest(change("feat/something-else"), [list("alpha", [pr({ number: 125 })])])).toBeUndefined();
});

test("an off-convention branch name is not matched", () => {
  const lists = [list("alpha", [pr({ number: 125, head: "jan/125-add-validate-phase" })])];
  expect(linkedPullRequest(change("feat/add-validate-phase"), lists)).toBeUndefined();
});

test("name containment is not a match, in either direction", () => {
  const lists = [list("alpha", [pr({ number: 125, head: "feat/add-validate-phase" })])];
  expect(linkedPullRequest(change("feat/add-validate"), lists)).toBeUndefined();
  const shorter = [list("alpha", [pr({ number: 7, head: "feat/add-validate" })])];
  expect(linkedPullRequest(change("feat/add-validate-phase"), shorter)).toBeUndefined();
  // Compared as written: no case folding, no trimming.
  expect(linkedPullRequest(change("Feat/add-validate-phase"), lists)).toBeUndefined();
  expect(linkedPullRequest(change("feat/add-validate-phase "), lists)).toBeUndefined();
});

test("the same branch in another repository is not this change's", () => {
  const lists = [list("beta", [pr({ number: 9 })])];
  expect(linkedPullRequest(change("feat/add-validate-phase", "alpha"), lists)).toBeUndefined();
  expect(linkedPullRequest(change("feat/add-validate-phase", "beta"), lists)?.number).toBe(9);
});

test("an open pull request wins over a merged one, and a draft counts as open", () => {
  const merged = pr({ number: 120, state: "merged", mergedAt: at(1), createdAt: at(50) });
  const open = pr({ number: 125, createdAt: at(30) });
  expect(linkedPullRequest(change("feat/add-validate-phase"), [list("alpha", [merged, open])])?.number).toBe(125);
  expect(linkedPullRequest(change("feat/add-validate-phase"), [list("alpha", [open, merged])])?.number).toBe(125);
  const draft = pr({ number: 126, draft: true, createdAt: at(30) });
  expect(linkedPullRequest(change("feat/add-validate-phase"), [list("alpha", [merged, draft])])?.number).toBe(126);
});

test("of several closed pull requests, the most recently closed is shown", () => {
  const older = pr({ number: 130, state: "closed", closedAt: at(40), createdAt: at(41) });
  const newer = pr({ number: 110, state: "closed", closedAt: at(2), createdAt: at(90) });
  const lists = [list("alpha", [older, newer])];
  expect(linkedPullRequest(change("feat/add-validate-phase"), lists)?.number).toBe(110);
  expect(linkedPullRequest(change("feat/add-validate-phase"), [list("alpha", [newer, older])])?.number).toBe(110);
});

test("a change without a branch has no pull request", () => {
  const lists = [list("alpha", [pr({ number: 125, head: "" })])];
  expect(linkedPullRequest(change(undefined), lists)).toBeUndefined();
  expect(linkedPullRequest(change(""), lists)).toBeUndefined();
});

test("a repository whose pull requests are unavailable links nothing, a failed one keeps its last list", () => {
  const p = pr({ number: 125 });
  expect(linkedPullRequest(change("feat/add-validate-phase"), [list("alpha", [p], { status: "unavailable", reason: "gh is not installed" })])).toBeUndefined();
  expect(linkedPullRequest(change("feat/add-validate-phase"), [list("alpha", [p], { status: "failed", reason: "timed out" })])?.number).toBe(125);
});

test("it is total: empty, missing and older-cache input give undefined rather than throwing", () => {
  expect(linkedPullRequest(change("feat/x"), [])).toBeUndefined();
  expect(linkedPullRequest(change("feat/x"), undefined)).toBeUndefined();
  expect(linkedPullRequest(change(undefined), undefined)).toBeUndefined();
  // What an older cache might hold: entries without fields this version reads, extra fields, holes.
  const odd = [
    { repoId: "alpha", status: "ok", pullRequests: [{ number: 1, title: "old", legacyHeadRefName: "feat/x" }, null, "garbage"] },
    { repoId: "alpha", status: "ok" },
    null,
  ] as unknown as RepoPullRequests[];
  expect(() => linkedPullRequest(change("feat/x"), odd)).not.toThrow();
  expect(linkedPullRequest(change("feat/x"), odd)).toBeUndefined();
  // Unreadable dates do not throw either; the higher number decides.
  const undated = [list("alpha", [pr({ number: 3, state: "closed", createdAt: "not a date" }), pr({ number: 4, state: "closed", createdAt: "" })])];
  expect(linkedPullRequest(change("feat/add-validate-phase"), undated)?.number).toBe(4);
});

test("it is pure: the input is left as it was", () => {
  const lists = [list("alpha", [pr({ number: 120, state: "merged", mergedAt: at(1) }), pr({ number: 125 })])];
  const before = structuredClone(lists);
  linkedPullRequest(change("feat/add-validate-phase"), lists);
  expect(lists).toEqual(before);
});
