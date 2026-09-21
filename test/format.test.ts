import { expect, test } from "bun:test";
import { applyCommand, checkoutHint, copyCommandFor, isStartColumn, pendingArchiveHint, splitBranchLabel, startCommand } from "../src/ui/format.ts";

test("short branch names are not split", () => {
  expect(splitBranchLabel("feat/add-login")).toEqual({ head: "feat/add-login", tail: "" });
  expect(splitBranchLabel("")).toEqual({ head: "", tail: "" });
  expect(splitBranchLabel("a".repeat(20))).toEqual({ head: "a".repeat(20), tail: "" });
});

test("long conventional names keep a readable tail starting at a word boundary", () => {
  expect(splitBranchLabel("feat/introduce-tenant-quota-enforcement")).toEqual({
    head: "feat/introduce-tenant-",
    tail: "quota-enforcement",
  });
  // the default cut lands on the separator itself: it stays with the head
  expect(splitBranchLabel("chore/refresh-cache-warmup-schedule")).toEqual({
    head: "chore/refresh-cache-",
    tail: "warmup-schedule",
  });
});

test("the tail is nudged left to a separator only within the limit", () => {
  // default cut lands inside "subscription"; its start is 3 characters to the left
  expect(splitBranchLabel("feat/bulk-subscription-export").tail).toBe("subscription-export");
  // no separator within 4 characters: cut mid-word at exactly tailLength
  const name = `feat/${"x".repeat(40)}`;
  expect(splitBranchLabel(name).tail).toBe("x".repeat(16));
});

test("head and tail always reassemble to the full name", () => {
  for (const name of ["feat/a", "fix/some_really.long-branch/name-with-many-parts", "release/2026.09.20-hotfix-for-scanner-timeouts", "x".repeat(21)]) {
    const { head, tail } = splitBranchLabel(name);
    expect(head + tail).toBe(name);
  }
});

test("tail length and nudge are configurable", () => {
  expect(splitBranchLabel("feat/abcdefghij", 4, 0)).toEqual({ head: "feat/abcdef", tail: "ghij" });
});

test("checkoutHint says where a change lives and which other checkouts are at a different point", () => {
  const wt = { path: "/w/acme/alpha-infra/.claude/worktrees/audit-trail", branch: "feat/audit-trail", isMain: false };
  expect(checkoutHint({})).toBe("a branch or worktree matches this change");
  expect(checkoutHint({ checkout: { path: "/w/acme/alpha-infra", isMain: true } })).toBe("a branch or worktree matches this change");
  expect(checkoutHint({ checkout: wt })).toBe("lives in worktree /w/acme/alpha-infra/.claude/worktrees/audit-trail");
  expect(
    checkoutHint({
      checkout: wt,
      otherCheckouts: [
        { isMain: true, branch: "main", column: "Proposal" },
        { isMain: false, branch: "wip/old", column: "Design" },
        { isMain: false, column: "New" },
      ],
    }).split("\n"),
  ).toEqual(["lives in worktree /w/acme/alpha-infra/.claude/worktrees/audit-trail", "also in: main checkout — Proposal", "also in: wip/old — Design", "also in: detached worktree — New"]);
});

test("the apply command is built for the checkout a change lives in", () => {
  expect(applyCommand("/w/acme/alpha-infra/.claude/worktrees/audit-trail", "audit-trail")).toBe('cd /w/acme/alpha-infra/.claude/worktrees/audit-trail && claude "/opsx:apply audit-trail"');
  expect(applyCommand("/w/acme/My Repos/alpha", "audit-trail")).toBe(`cd '/w/acme/My Repos/alpha' && claude "/opsx:apply audit-trail"`);
});

test("isStartColumn: true for pre-Ready columns, false for Ready onwards", () => {
  for (const column of ["New", "Proposal", "Design", "Specs", "Brief", "Plan", "Unknown"]) {
    expect([column, isStartColumn(column)]).toEqual([column, true]);
  }
  for (const column of ["Ready", "Implementing", "Done", "Synced", "Archived"]) {
    expect([column, isStartColumn(column)]).toEqual([column, false]);
  }
});

test("startCommand: continue drafting; extended with a pointer to prompt.md when present", () => {
  expect(startCommand("/w/acme/forum-admin", "add-audit-trail", false)).toBe('cd /w/acme/forum-admin && claude "/opsx:continue add-audit-trail"');
  expect(startCommand("/w/acme/forum-admin", "add-audit-trail", true)).toBe('cd /w/acme/forum-admin && claude "/opsx:continue add-audit-trail — see openspec/changes/add-audit-trail/prompt.md"');
  expect(startCommand("/w/acme/My Repos/alpha", "add-audit-trail", false)).toBe(`cd '/w/acme/My Repos/alpha' && claude "/opsx:continue add-audit-trail"`);
});

test("copyCommandFor: apply for Ready onwards, start (+prompt) for earlier columns", () => {
  const apply = copyCommandFor({ column: "Ready", name: "add-audit-trail" }, "/w/acme/forum-admin");
  expect(apply).toEqual({ label: "Copy apply", text: 'cd /w/acme/forum-admin && claude "/opsx:apply add-audit-trail"' });

  const start = copyCommandFor({ column: "New", name: "add-audit-trail" }, "/w/acme/forum-admin");
  expect(start).toEqual({ label: "Copy start", text: 'cd /w/acme/forum-admin && claude "/opsx:continue add-audit-trail"' });

  const withPrompt = copyCommandFor({ column: "Proposal", name: "add-audit-trail", prompt: "Log every mutation" }, "/w/acme/forum-admin");
  expect(withPrompt.label).toBe("Copy start");
  expect(withPrompt.text).toContain("/opsx:continue add-audit-trail — see openspec/changes/add-audit-trail/prompt.md");

  // an empty-string prompt is the same as no prompt (a whitespace-only prompt never becomes a file)
  const withEmptyPrompt = copyCommandFor({ column: "New", name: "add-audit-trail", prompt: "" }, "/w/acme/forum-admin");
  expect(withEmptyPrompt.text).not.toContain("prompt.md");
});

test("pendingArchiveHint: only for an archive that lives in a linked worktree", () => {
  const worktree = { path: "/w/acme/alpha-infra/.claude/worktrees/archive-audit-trail", branch: "chore/archive-audit-trail", isMain: false };
  const hint = pendingArchiveHint({ archived: "2026-09-20", checkout: worktree, otherCheckouts: [{ branch: "main", isMain: true, column: "Implementing" }] });
  expect(hint?.label).toBe("on chore/archive-audit-trail · not in main checkout");
  expect(hint?.title).toContain("still active in: main checkout — Implementing");
  expect(pendingArchiveHint({ archived: "2026-09-20" })).toBeUndefined();
  expect(pendingArchiveHint({ archived: "2026-09-20", checkout: { path: "/w/acme/alpha-infra", isMain: true } })).toBeUndefined();
  expect(pendingArchiveHint({ archived: null, checkout: worktree })).toBeUndefined();
  expect(pendingArchiveHint({ archived: "2026-09-20", checkout: { ...worktree, branch: undefined } })?.label).toContain("a detached worktree");
});
