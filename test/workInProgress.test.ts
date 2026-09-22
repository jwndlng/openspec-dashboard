import { expect, test } from "bun:test";
import type { CheckoutStatus, Worktree } from "../src/shared/types.ts";
import { summarizeWorkInProgress } from "../src/shared/workInProgress.ts";

const clean: CheckoutStatus = { modified: 0, untracked: 0, conflicts: 0 };
const main = (extra: Partial<Worktree> = {}): Worktree => ({ path: "/w/acme/alpha-infra", branch: "main", isMain: true, status: clean, unpushed: 0, ...extra });
const linked = (name: string, extra: Partial<Worktree> = {}): Worktree => ({ path: `/w/acme/wt/${name}`, branch: `feat/${name}`, status: clean, unpushed: 0, ...extra });

test("mixed states", () => {
  const checkouts = [
    main(),
    linked("report", { status: { ...clean, modified: 2, untracked: 1 } }),
    linked("parser", { unpushed: 2 }),
    { path: "/w/acme/wt/gone", branch: "feat/gone", prunable: true },
  ];
  expect(summarizeWorkInProgress(checkouts)).toEqual({ worktrees: 3, uncommitted: 1, unpushed: 1, stale: 1, unknown: 0 });
});

test("dirty main checkout without worktrees", () => {
  expect(summarizeWorkInProgress([main({ status: { ...clean, modified: 4 } })])).toEqual({ worktrees: 0, uncommitted: 1, unpushed: 0, stale: 0, unknown: 0 });
});

test("one checkout with both counts once under each", () => {
  const both = linked("both", { status: { ...clean, untracked: 3 }, unpushed: 5 });
  expect(summarizeWorkInProgress([main(), both])).toEqual({ worktrees: 1, uncommitted: 1, unpushed: 1, stale: 0, unknown: 0 });
});

test("uninspected and unknown checkouts count as neither uncommitted nor unpushed", () => {
  const checkouts = [main(), { path: "/w/acme/wt/a", branch: "feat/a", status: "unknown" as const }, { path: "/w/acme/wt/b", branch: "feat/b", inspected: false }];
  expect(summarizeWorkInProgress(checkouts)).toEqual({ worktrees: 2, uncommitted: 0, unpushed: 0, stale: 0, unknown: 1 });
});

test("no checkouts", () => {
  expect(summarizeWorkInProgress([])).toEqual({ worktrees: 0, uncommitted: 0, unpushed: 0, stale: 0, unknown: 0 });
});
