import { expect, test } from "bun:test";
import type { ChangeSession, SessionAction, SessionState, SessionWorktree } from "../src/shared/types.ts";
import { archivedShown, hasRunningSession } from "../src/ui/sessionState.ts";

const main = { path: "/w/acme/alpha-infra", branch: "main", isMain: true };
const card = { repoId: "a1", name: "add-audit-log", checkout: main };
const session = (state: SessionState, action: SessionAction = "implement", change = "add-audit-log", repoId = "a1"): ChangeSession => ({
  id: `${repoId}-${change}-${action}-${state}`,
  agentId: "fake",
  agentName: "Fake",
  state,
  worktreePath: `/h/worktrees/${repoId}/${change}`,
  branch: `feat/${change}`,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
  resumable: false,
  repoId,
  change,
  action,
});
const merged: SessionWorktree[] = [];

test("a running session of the change keeps it, whatever its action", () => {
  expect(hasRunningSession(card, [session("running")])).toBe(true);
  expect(hasRunningSession(card, [session("running", "archive")])).toBe(true);
});

test("ended sessions keep nothing", () => {
  expect(hasRunningSession(card, [session("exited"), session("failed", "archive")])).toBe(false);
  expect(hasRunningSession(card, [])).toBe(false);
});

test("a running session of a same-named change in another repository, or of another change, does not count", () => {
  expect(hasRunningSession(card, [session("running", "implement", "add-audit-log", "b2"), session("running", "implement", "other-change")])).toBe(false);
});

test("Hide merged keeps a merged archive while its session runs, and drops it once the session ended", () => {
  expect(archivedShown(card, true, merged, [session("running")])).toBe(true);
  expect(archivedShown(card, true, merged, [session("exited")])).toBe(false);
  expect(archivedShown(card, true, merged, [])).toBe(false);
});

test("with Hide merged off every archive is shown, and a pending one is shown either way", () => {
  expect(archivedShown(card, false, merged, [])).toBe(true);
  const linked = { ...card, checkout: { path: "/w/acme/alpha-infra-wt", branch: "chore/archive-add-audit-log", isMain: false } };
  expect(archivedShown(linked, true, merged, [])).toBe(true);
});
