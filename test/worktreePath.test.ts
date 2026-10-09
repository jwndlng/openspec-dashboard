import { expect, test } from "bun:test";
import type { SessionWorktree } from "../src/shared/types.ts";
import { DetailHeader, WorktreePath } from "../src/ui/changeDetail.tsx";
import { splitPathLabel } from "../src/ui/format.ts";
import { changeWorktreePath } from "../src/ui/sessionState.ts";
import { byComponent } from "./vnode.ts";

const main = { path: "/w/acme/demo-ops", branch: "main", isMain: true };
const linked = { path: "/w/acme/demo-ops-audit-trail", branch: "feat/audit-trail", isMain: false };
const change = (checkout?: typeof main) => ({ repoId: "d1", name: "audit-trail", checkout });
const tree = (name: string, lastActivityAt?: string, change = "audit-trail", repoId = "d1"): SessionWorktree => ({
  repoId,
  name,
  path: `/h/worktrees/${repoId}/${name}`,
  change,
  action: "implement",
  work: { state: "clean" },
  lastActivityAt,
});

test("the linked worktree the change's data comes from is its worktree", () => {
  expect(changeWorktreePath(change(linked), [])).toBe("/w/acme/demo-ops-audit-trail");
  expect(changeWorktreePath(change(linked), [tree("audit-trail", "2026-10-09T10:00:00Z")])).toBe("/w/acme/demo-ops-audit-trail");
});

test("otherwise the most recently active session worktree of that change", () => {
  const older = tree("audit-trail", "2026-10-08T10:00:00Z");
  const newer = tree("audit-trail-2", "2026-10-09T10:00:00Z");
  expect(changeWorktreePath(change(main), [older])).toBe("/h/worktrees/d1/audit-trail");
  expect(changeWorktreePath(change(main), [older, newer])).toBe("/h/worktrees/d1/audit-trail-2");
  expect(changeWorktreePath(change(), [newer, older])).toBe("/h/worktrees/d1/audit-trail-2");
});

test("no worktree for a change only in the main checkout, and other changes' worktrees do not count", () => {
  expect(changeWorktreePath(change(main), [])).toBeUndefined();
  expect(changeWorktreePath(change(), [])).toBeUndefined();
  expect(changeWorktreePath(change(main), [tree("billing", undefined, "billing"), tree("audit-trail", undefined, "audit-trail", "other")])).toBeUndefined();
});

test("the path label keeps the worktree's own name as its tail", () => {
  expect(splitPathLabel("/h/worktrees/d1/audit-trail")).toEqual({ head: "/h/worktrees/d1/", tail: "audit-trail" });
  expect(splitPathLabel("/h/worktrees/d1/audit-trail/")).toEqual({ head: "/h/worktrees/d1/", tail: "audit-trail" });
  expect(splitPathLabel("relative")).toEqual({ head: "relative", tail: "" });
});

test("the detail header offers the worktree path for the change it shows, not for one gone from the snapshot", () => {
  const repo = { id: "d1", name: "demo-ops", path: "/w/acme/demo-ops", ok: true, scannedAt: "2026-10-09T10:00:00Z", isGit: true, worktrees: [], changes: [] };
  const snapshot = { ...change(linked), schema: "spec-driven", artifacts: [], tasks: null, stage: "implementing" as const, column: "Implementing" };
  const offered = byComponent(DetailHeader({ repo, change: snapshot, onClose: () => {} }), WorktreePath);
  expect(offered.map((el) => (el.props.change as { checkout?: { path: string } }).checkout?.path)).toEqual(["/w/acme/demo-ops-audit-trail"]);
  expect(byComponent(DetailHeader({ repo, change: { name: "gone" }, onClose: () => {} }), WorktreePath)).toEqual([]);
});
