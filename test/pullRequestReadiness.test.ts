import { expect, test } from "bun:test";
import { isNotReady, pullRequestReadiness, readinessRole, readinessWord } from "../src/shared/pullRequestReadiness.ts";
import type { PullRequest } from "../src/shared/types.ts";

const pr = (patch: Partial<PullRequest> = {}): PullRequest => ({
  number: 125,
  title: "Add the validate phase",
  url: "https://github.com/acme/alpha-infra/pull/125",
  author: "octo",
  head: "feat/add-validate-phase",
  base: "main",
  draft: false,
  state: "open",
  createdAt: "2026-10-01T09:00:00Z",
  review: "none",
  reviewRequestedFromViewer: false,
  checks: "passing",
  mergeable: "mergeable",
  ...patch,
});

test("green and mergeable is ready", () => {
  expect(pullRequestReadiness(pr())).toEqual({ ready: true });
});

test("no checks configured and mergeable is ready", () => {
  expect(pullRequestReadiness(pr({ checks: "none" }))).toEqual({ ready: true });
});

test("checks still running: not ready, in progress", () => {
  expect(pullRequestReadiness(pr({ checks: "pending" }))).toEqual({ ready: false, reason: "checks running", inProgress: true });
});

test("a conflict outranks failing checks, and waits", () => {
  expect(pullRequestReadiness(pr({ mergeable: "conflicting", checks: "failing" }))).toEqual({ ready: false, reason: "conflicts", inProgress: false });
  expect(pullRequestReadiness(pr({ mergeable: "conflicting", checks: "pending" }))).toEqual({ ready: false, reason: "conflicts", inProgress: false });
});

test("failing checks outrank running ones and unknown mergeability", () => {
  expect(pullRequestReadiness(pr({ checks: "failing", mergeable: "unknown" }))).toEqual({ ready: false, reason: "checks failing", inProgress: false });
});

test("mergeability not computed yet: not ready, in progress", () => {
  expect(pullRequestReadiness(pr({ mergeable: "unknown" }))).toEqual({ ready: false, reason: "mergeability unknown", inProgress: true });
});

test("approval does not matter", () => {
  expect(pullRequestReadiness(pr({ review: "review_required" }))).toEqual({ ready: true });
  expect(pullRequestReadiness(pr({ review: "changes_requested" }))).toEqual({ ready: true });
});

test("a draft is not ready and waits, whatever its checks", () => {
  expect(pullRequestReadiness(pr({ draft: true }))).toEqual({ ready: false, reason: "draft", inProgress: false });
  expect(pullRequestReadiness(pr({ draft: true, mergeable: "conflicting" }))?.ready).toBe(false);
});

test("merged and closed pull requests have no readiness", () => {
  expect(pullRequestReadiness(pr({ state: "merged" }))).toBeUndefined();
  expect(pullRequestReadiness(pr({ state: "closed", checks: "failing" }))).toBeUndefined();
  expect(isNotReady(pr({ state: "merged" }))).toBe(false);
});

test("an older cache without mergeability reads as unknown, and malformed entries never look ready", () => {
  const { mergeable: _, ...old } = pr();
  expect(pullRequestReadiness(old)).toEqual({ ready: false, reason: "mergeability unknown", inProgress: true });
  expect(pullRequestReadiness(pr({ checks: "weird" as PullRequest["checks"] }))).toMatchObject({ ready: false, reason: "checks running" });
  expect(pullRequestReadiness(pr({ mergeable: "MAYBE" as PullRequest["mergeable"] }))).toMatchObject({ ready: false, reason: "mergeability unknown" });
  expect(pullRequestReadiness(undefined)).toBeUndefined();
  expect(pullRequestReadiness(null as unknown as PullRequest)).toBeUndefined();
  expect(pullRequestReadiness({} as PullRequest)).toBeUndefined();
});

test("roles and words: never info, every state in words", () => {
  const cases: [Partial<PullRequest>, string, string][] = [
    [{}, "ready", "success"],
    [{ checks: "failing" }, "checks failing", "danger"],
    [{ mergeable: "conflicting" }, "conflicts", "warning"],
    [{ draft: true }, "draft", "branch"],
    [{ checks: "pending" }, "checks running", "branch"],
    [{ mergeable: "unknown" }, "mergeability unknown", "branch"],
  ];
  for (const [patch, word, role] of cases) {
    const readiness = pullRequestReadiness(pr(patch));
    if (!readiness) throw new Error("expected a readiness");
    expect<string>(readinessWord(readiness)).toBe(word);
    expect<string>(readinessRole(readiness)).toBe(role);
  }
});
