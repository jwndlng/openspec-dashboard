import { expect, test } from "bun:test";
import type { ChangeSnapshot, DismissPreview, RepoSnapshot } from "../src/shared/types.ts";
import { DetailHeader } from "../src/ui/changeDetail.tsx";
import { dismissedNotice, dismissOffer, lossWarning, stagingNote } from "../src/ui/dismissState.ts";
import { byTag, textOf } from "./vnode.ts";

const change = (patch: Partial<ChangeSnapshot> = {}): ChangeSnapshot => ({
  repoId: "demo-ops",
  name: "lint-rules",
  schema: "spec-driven",
  artifacts: [],
  tasks: null,
  stage: "drafts",
  column: "Drafts",
  checkout: { path: "/w/acme/demo-ops", branch: "main", isMain: true },
  ...patch,
});

const repo = (patch: Partial<RepoSnapshot> = {}): RepoSnapshot => ({
  id: "demo-ops",
  name: "demo-ops",
  path: "/w/acme/demo-ops",
  ok: true,
  scannedAt: "2026-09-24T10:00:00Z",
  isGit: true,
  worktrees: [],
  changes: [],
  ...patch,
});

const preview = (patch: Partial<DismissPreview> = {}): DismissPreview => ({
  repoId: "demo-ops",
  name: "lint-rules",
  isGit: true,
  files: [
    { path: ".openspec.yaml", state: "restorable" },
    { path: "proposal.md", state: "restorable" },
  ],
  copies: [],
  fingerprint: "f",
  ...patch,
});

test("offered for an active change in the main checkout, and for one without checkout information", () => {
  expect(dismissOffer(change())).toEqual({ shown: true });
  expect(dismissOffer(change({ checkout: undefined }))).toEqual({ shown: true });
  // Led by a worktree, but the main checkout has a copy too.
  expect(dismissOffer(change({ checkout: { path: "/w/acme/wt", branch: "feat/lint-rules", isMain: false }, otherCheckouts: [{ path: "/w/acme/demo-ops", isMain: true, column: "Drafts" }] }))).toEqual({ shown: true });
});

test("not offered for an archived change; disabled, naming the branch, for a worktree-only change", () => {
  expect(dismissOffer(change({ archived: "2026-09-01" }))).toEqual({ shown: false });
  const offer = dismissOffer(change({ checkout: { path: "/w/acme/wt", branch: "feat/cloud-deployment", isMain: false } }));
  expect(offer.shown && offer.disabledReason).toContain("feat/cloud-deployment");
});

test("the loss warning appears only when something cannot be restored", () => {
  expect(lossWarning(preview())).toBeUndefined();
  expect(lossWarning(preview({ files: [{ path: "proposal.md", state: "restorable" }, { path: "design.md", state: "lost" }] }))).toBe(
    "1 of these files has changes that are not committed and cannot be restored.",
  );
  expect(lossWarning(preview({ files: [{ path: "a.md", state: "lost" }, { path: "b.md", state: "lost" }] }))).toContain("all 2 are deleted for good");
  expect(lossWarning(preview({ isGit: false, files: [{ path: "a.md", state: "lost" }] }))).toContain("no git");
});

test("the staging note and the notice say what git was left with", () => {
  expect(stagingNote(preview())).toContain("Nothing is committed");
  expect(stagingNote(preview({ isGit: false }))).toContain("no git");
  expect(dismissedNotice({ name: "lint-rules", staged: true }, preview())).toBe("Dismissed lint-rules. Its removal is staged, ready to commit.");
  expect(dismissedNotice({ name: "lint-rules", staged: false }, preview())).toContain("Nothing was staged");
  expect(dismissedNotice({ name: "lint-rules", staged: false }, preview({ isGit: false }))).toBe("Dismissed lint-rules.");
  expect(dismissedNotice({ name: "lint-rules", staged: true }, preview({ copies: [{ path: "/w/acme/wt", branch: "feat/lint-rules" }] }))).toContain("stays on the board");
});

const dismissButtons = (tree: unknown) => byTag(tree as never, "button").filter((b) => textOf(b).includes("Dismiss change"));

test("the detail header shows Dismiss change only where it is offered", () => {
  const noop = () => {};
  expect(dismissButtons(DetailHeader({ repo: repo(), change: change(), onClose: noop, onDismiss: noop }))).toHaveLength(1);
  expect(dismissButtons(DetailHeader({ repo: repo(), change: change(), onClose: noop }))).toHaveLength(0);
  expect(dismissButtons(DetailHeader({ repo: repo(), change: change({ archived: "2026-09-01" }), onClose: noop, onDismiss: noop }))).toHaveLength(0);
  expect(dismissButtons(DetailHeader({ repo: repo({ ok: false }), change: change(), onClose: noop, onDismiss: noop }))).toHaveLength(0);
  const [disabled] = dismissButtons(DetailHeader({ repo: repo(), change: change({ checkout: { path: "/w/acme/wt", branch: "feat/x", isMain: false } }), onClose: noop, onDismiss: noop }));
  expect(disabled.props.disabled).toBe(true);
  expect(String(disabled.props.title)).toContain("feat/x");
});
