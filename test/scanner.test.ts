import { afterAll, beforeAll, expect, test } from "bun:test";
import { appendFile, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultConfig, newRepoConfig } from "../src/server/config.ts";
import type { ParsedStatus } from "../src/server/git.ts";
import { MAX_INSPECTED_WORKTREES, PROMPT_LIMIT_BYTES, Scanner, scanRepo } from "../src/server/scanner.ts";
import { LocalRepoSource } from "../src/server/source.ts";
import type { Worktree } from "../src/shared/types.ts";
import { FIXTURES, gitIn, tempDir, useTempHome } from "./helpers.ts";

let cleanup: () => Promise<void>;
beforeAll(async () => {
  ({ cleanup } = await useTempHome());
});
afterAll(() => cleanup());

const nano = newRepoConfig(join(FIXTURES, "demo-ops"), true);
const soc = newRepoConfig(join(FIXTURES, "beta-soc"), true);

test("scans a fixture repo: artifacts, tasks, archive dates, columns", async () => {
  const snap = await scanRepo(nano);
  expect(snap.ok).toBe(true);
  const byName = new Map(snap.changes.map((c) => [c.name, c]));

  const aws = byName.get("cloud-deployment")!;
  expect(aws.artifacts.map((a) => a.id)).toEqual(["proposal", "specs", "design", "tasks"]);
  expect(aws.artifacts.every((a) => a.status === "done")).toBe(true);
  expect(aws.tasks?.total).toBeGreaterThan(0);
  expect(aws.lastActivityAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  const { done, total } = aws.tasks!;
  expect(aws.column).toBe(done === total ? "Done" : done > 0 ? "Implementing" : "Ready");

  const complete = byName.get("configurable-builder")!;
  expect(complete.tasks?.done).toBe(complete.tasks?.total);
  expect(complete.column).toBe("Done");

  const archived = byName.get("runbook-repo-field")!;
  expect(archived.archived).toBe("2026-06-18");
  expect(archived.created).toBe("2026-06-16");
  expect(archived.column).toBe("Archived");
  expect(archived.tasks?.done).toBe(archived.tasks?.total);
});

test("all artifacts done with an empty tasks file lands in Ready with a warning", async () => {
  const root = await tempDir();
  const change = join(root, "openspec", "changes", "empty-tasks");
  await mkdir(join(change, "specs", "cap"), { recursive: true });
  await writeFile(join(root, "openspec", "config.yaml"), "schema: spec-driven\n");
  await writeFile(join(change, ".openspec.yaml"), "schema: spec-driven\ncreated: 2026-09-01\n");
  for (const f of ["proposal.md", "design.md"]) await writeFile(join(change, f), "# x\n");
  await writeFile(join(change, "specs", "cap", "spec.md"), "## ADDED Requirements\n");
  await writeFile(join(change, "tasks.md"), "## 1. Nothing\n\n(no tasks yet)\n");

  const snap = await scanRepo(newRepoConfig(root, true));
  const empty = snap.changes.find((c) => c.name === "empty-tasks")!;
  expect(empty.artifacts.every((a) => a.status === "done")).toBe(true);
  expect(empty.tasks).toEqual({ done: 0, total: 0 });
  expect(empty.column).toBe("Ready");
  expect(empty.warnings).toContain("tasks file has no tasks");
  expect(empty.created).toBe("2026-09-01");
  await rm(root, { recursive: true, force: true });
});

test("skip_specs marks spec artifacts done; unknown schema is reported per change", async () => {
  const root = await tempDir();
  await mkdir(join(root, "openspec", "changes", "refactor"), { recursive: true });
  await mkdir(join(root, "openspec", "changes", "odd"), { recursive: true });
  await writeFile(join(root, "openspec", "config.yaml"), "schema: spec-driven\n");
  await writeFile(join(root, "openspec", "changes", "refactor", ".openspec.yaml"), "schema: spec-driven\ncreated: 2026-09-02\nskip_specs: true\n");
  await writeFile(join(root, "openspec", "changes", "refactor", "proposal.md"), "# p\n");
  await writeFile(join(root, "openspec", "changes", "odd", ".openspec.yaml"), "schema: my-custom\ncreated: 2026-09-03\n");

  const snap = await scanRepo(newRepoConfig(root, true));
  const refactor = snap.changes.find((c) => c.name === "refactor")!;
  expect(refactor.artifacts).toEqual([
    { id: "proposal", status: "done" },
    { id: "specs", status: "done" },
    { id: "design", status: "ready" },
    { id: "tasks", status: "blocked" },
  ]);
  // design comes before specs in display order and is not written, so the last completed step is the proposal
  expect(refactor.column).toBe("Proposal");

  const odd = snap.changes.find((c) => c.name === "odd")!;
  expect(odd.schema).toBe("my-custom");
  expect(odd.artifacts).toEqual([]);
  expect(odd.column).toBe("Unknown");
  expect(odd.warnings?.[0]).toMatch(/unknown schema 'my-custom'/);
  await rm(root, { recursive: true, force: true });
});

test("archived list is sorted newest first and archive count matches disk", async () => {
  const snap = await scanRepo(soc);
  const archived = snap.changes.filter((c) => c.archived);
  expect(archived.length).toBe(16);
  const dates = archived.map((c) => c.archived!);
  expect([...dates].sort().reverse()).toEqual(dates);
});

test("missing repo path yields ok:false without throwing", async () => {
  const snap = await scanRepo(newRepoConfig("/nonexistent/repo", true));
  expect(snap.ok).toBe(false);
  expect(snap.error).toMatch(/does not exist/);
});

test("unexpected change directory names are skipped with a warning", async () => {
  class Weird extends LocalRepoSource {
    override async listChanges() {
      const listing = await super.listChanges();
      return { ...listing, warnings: [...listing.warnings, 'skipped change directory with unexpected name: "foo;rm -rf"'] };
    }
  }
  const snap = await scanRepo(nano, new Weird(nano.path));
  expect(snap.warnings?.[0]).toContain("foo;rm -rf");
});

test("scanner isolates a failing repo and keeps its last good changes", async () => {
  const config = { ...defaultConfig(), repos: [nano, soc] };
  const scanner = new Scanner(() => config, { persist: false });
  await scanner.trigger().done;
  expect(scanner.snapshot.repos.map((r) => r.ok)).toEqual([true, true]);
  const socChanges = scanner.snapshot.repos[1].changes.length;

  const failing = new Scanner(() => config, {
    persist: false,
    sourceFor: (repo) => {
      const src = new LocalRepoSource(repo.path);
      if (repo.id === soc.id) src.listChanges = () => Promise.reject(new Error("disk on fire"));
      return src;
    },
  }, scanner.snapshot);
  const { started, done } = failing.trigger();
  expect(started).toBe(true);
  expect(failing.trigger().started).toBe(false);
  await done;
  const [n, b] = failing.snapshot.repos;
  expect(n.ok).toBe(true);
  expect(b.ok).toBe(false);
  expect(b.error).toBe("disk on fire");
  expect(b.changes.length).toBe(socChanges);
});

// --- Checkouts: real linked worktrees in temporary repositories, with a local bare repository as the "remote". ---

const CLEAN = { modified: 0, untracked: 0, conflicts: 0 };

/** A committed repository with an `openspec/` directory. Resolved path: macOS temp dirs sit behind a symlink, and git reports real paths. */
async function newGitRepo(prefix: string): Promise<{ base: string; repo: string }> {
  const base = await realpath(await tempDir(prefix));
  const repo = join(base, "alpha-infra");
  await mkdir(join(repo, "openspec", "changes"), { recursive: true });
  await writeFile(join(repo, "openspec", "config.yaml"), "schema: spec-driven\n");
  await writeFile(join(repo, "a.txt"), "a\n");
  await writeFile(join(repo, "b.txt"), "b\n");
  await gitIn(repo, "init", "-q");
  await gitIn(repo, "add", "-A");
  await gitIn(repo, "commit", "-q", "-m", "init");
  return { base, repo };
}

async function commits(cwd: string, n: number, label: string): Promise<void> {
  for (let i = 0; i < n; i++) {
    await appendFile(join(cwd, "a.txt"), `${label} ${i}\n`);
    await gitIn(cwd, "commit", "-q", "-am", `${label} ${i}`);
  }
}

let wt: { base: string; repo: string };
const wtPath = (name: string) => join(wt.base, "wt", name);
const scanWt = (source?: LocalRepoSource) => scanRepo(newRepoConfig(wt.repo, true), source);
const checkout = (list: Worktree[], name: string) => list.find((w) => w.path === wtPath(name))!;

beforeAll(async () => {
  wt = await newGitRepo("osd-checkouts-");
  const { base, repo } = wt;
  await gitIn(base, "init", "-q", "--bare", "remote.git");
  await gitIn(repo, "remote", "add", "origin", join(base, "remote.git"));
  await gitIn(repo, "push", "-q", "-u", "origin", "main");

  await gitIn(repo, "worktree", "add", "-q", wtPath("clean"), "-b", "feat/report");
  await gitIn(wtPath("clean"), "push", "-q", "-u", "origin", "feat/report");

  const dirty = wtPath("dirty");
  await gitIn(repo, "worktree", "add", "-q", dirty, "-b", "feat/dirty");
  await appendFile(join(dirty, "a.txt"), "edited\n");
  await writeFile(join(dirty, "secret-plan.md"), "staged\n");
  await gitIn(dirty, "add", "secret-plan.md");
  await gitIn(dirty, "mv", "b.txt", "c.txt");
  await mkdir(join(dirty, "scratch"));
  for (let i = 0; i < 40; i++) await writeFile(join(dirty, "scratch", `note-${i}.md`), "x\n");

  // 5 commits pushed and then dropped locally, 2 new local ones: ahead 2, behind 5.
  const diverged = wtPath("diverged");
  await gitIn(repo, "worktree", "add", "-q", diverged, "-b", "feat/diverged");
  await commits(diverged, 5, "upstream");
  await gitIn(diverged, "push", "-q", "-u", "origin", "feat/diverged");
  await gitIn(diverged, "reset", "-q", "--hard", "HEAD~5");
  await commits(diverged, 2, "local");

  await gitIn(repo, "worktree", "add", "-q", wtPath("never-pushed"), "-b", "feat/never-pushed");
  await commits(wtPath("never-pushed"), 3, "unpushed");

  await gitIn(repo, "worktree", "add", "-q", "--detach", wtPath("detached"));
  await commits(wtPath("detached"), 1, "detached");

  const unborn = wtPath("unborn");
  await gitIn(repo, "worktree", "add", "-q", "--detach", unborn);
  await gitIn(unborn, "checkout", "-q", "--orphan", "feat/unborn");
  await gitIn(unborn, "rm", "-rfq", ".");
  await writeFile(join(unborn, "one.md"), "1\n");
  await writeFile(join(unborn, "two.md"), "2\n");

  await gitIn(repo, "worktree", "add", "-q", wtPath("held"), "-b", "fix/held");
  await gitIn(repo, "worktree", "lock", "--reason", "in use", wtPath("held"));

  await gitIn(repo, "worktree", "add", "-q", wtPath("gone"), "-b", "feat/gone");
  await rm(wtPath("gone"), { recursive: true, force: true });
});
afterAll(() => rm(wt.base, { recursive: true, force: true }));

test("checkouts: the main checkout is recorded but not counted as a worktree", async () => {
  const snap = await scanWt();
  expect(snap.ok).toBe(true);
  expect(snap.worktrees.length).toBe(9);
  expect(snap.worktrees.filter((w) => w.isMain).map((w) => w.path)).toEqual([wt.repo]);
  expect(snap.worktrees[0]).toMatchObject({ isMain: true, branch: "main", status: { ...CLEAN, upstream: "origin/main", ahead: 0, behind: 0 }, unpushed: 0 });
  expect(snap.workInProgress).toEqual({ worktrees: 8, uncommitted: 2, unpushed: 3, stale: 1, unknown: 0 });
});

test("checkouts: clean, uncommitted, ahead and behind", async () => {
  const { worktrees } = await scanWt();
  const clean = checkout(worktrees, "clean");
  expect(clean.status).toEqual({ ...CLEAN, upstream: "origin/feat/report", ahead: 0, behind: 0 });
  expect(clean.unpushed).toBe(0);

  // Edited + staged + renamed; the untracked directory of 40 files is one item.
  const dirty = checkout(worktrees, "dirty");
  expect(dirty.status).toMatchObject({ modified: 3, untracked: 1 });

  const diverged = checkout(worktrees, "diverged");
  expect(diverged.status).toMatchObject({ upstream: "origin/feat/diverged", ahead: 2, behind: 5 });
  expect(diverged.unpushed).toBe(2);
});

test("checkouts: never-pushed branch, detached HEAD and unborn branch", async () => {
  const snap = await scanWt();
  const never = checkout(snap.worktrees, "never-pushed");
  expect(never.status).toEqual(CLEAN);
  expect(never.unpushed).toBe(3);

  const detached = checkout(snap.worktrees, "detached");
  expect(detached).toMatchObject({ detached: true, unpushed: 1 });
  expect(detached.branch).toBeUndefined();
  expect(detached.head).toMatch(/^[0-9a-f]{7}$/);

  const unborn = checkout(snap.worktrees, "unborn");
  expect(unborn.status).toEqual({ ...CLEAN, untracked: 2 });
  expect(unborn.unpushed).toBe(0);
  expect(snap.ok).toBe(true);
});

test("checkouts: a removed directory is prunable and never inspected; a locked worktree is flagged", async () => {
  const inspected: string[] = [];
  class Recording extends LocalRepoSource {
    override checkoutStatus(path: string) {
      inspected.push(path);
      return super.checkoutStatus(path);
    }
    override localOnlyCommits(path: string) {
      inspected.push(path);
      return super.localOnlyCommits(path);
    }
  }
  const snap = await scanWt(new Recording(wt.repo));
  const gone = checkout(snap.worktrees, "gone");
  expect(snap.ok).toBe(true);
  expect(gone).toMatchObject({ prunable: true, branch: "feat/gone" });
  expect(gone.status).toBeUndefined();
  expect(gone.unpushed).toBeUndefined();
  expect(inspected).not.toContain(wtPath("gone"));
  expect(inspected).toContain(wtPath("held"));
  expect(checkout(snap.worktrees, "held")).toMatchObject({ locked: true, lockReason: "in use", status: CLEAN });
});

test("checkouts: detached and branchless entries are ignored by branch matching", async () => {
  await mkdir(join(wt.repo, "openspec", "changes", "never-pushed"), { recursive: true });
  await mkdir(join(wt.repo, "openspec", "changes", "detached"), { recursive: true });
  const snap = await scanWt();
  await rm(join(wt.repo, "openspec", "changes"), { recursive: true, force: true });
  await mkdir(join(wt.repo, "openspec", "changes"));
  expect(snap.changes.find((c) => c.name === "never-pushed")?.branchMatch).toBe("feat/never-pushed");
  expect(snap.changes.find((c) => c.name === "detached")?.branchMatch).toBeUndefined();
});

test("checkouts: a failing status leaves that worktree unknown and the others intact", async () => {
  class OneFails extends LocalRepoSource {
    override checkoutStatus(path: string): Promise<ParsedStatus | undefined> {
      if (path === wtPath("clean")) return Promise.resolve(undefined); // what a failed or timed-out command resolves to
      if (path === wtPath("held")) return Promise.reject(new Error("boom"));
      return super.checkoutStatus(path);
    }
  }
  const snap = await scanWt(new OneFails(wt.repo));
  expect(snap.ok).toBe(true);
  expect(checkout(snap.worktrees, "clean").status).toBe("unknown");
  expect(checkout(snap.worktrees, "held").status).toBe("unknown");
  expect(checkout(snap.worktrees, "diverged").unpushed).toBe(2);
  expect(snap.worktrees[0].status).toMatchObject(CLEAN);
  expect(snap.workInProgress).toMatchObject({ unknown: 2, uncommitted: 2 });
});

test("checkouts: a failed scan keeps the previous checkouts and summary", async () => {
  const config = { ...defaultConfig(), repos: [newRepoConfig(wt.repo, true)] };
  let fail = false;
  class Flaky extends LocalRepoSource {
    override listChanges() {
      return fail ? Promise.reject(new Error("boom")) : super.listChanges();
    }
  }
  const scanner = new Scanner(() => config, { persist: false, sourceFor: (r) => new Flaky(r.path) });
  const good = (await scanner.trigger().done).repos[0];
  fail = true;
  const bad = (await scanner.trigger().done).repos[0];
  expect(bad.ok).toBe(false);
  expect(bad.worktrees).toEqual(good.worktrees);
  expect(checkout(bad.worktrees, "dirty").status).toMatchObject({ modified: 3 });
  expect(bad.workInProgress).toEqual(good.workInProgress!);
});

test("checkouts: without remote-tracking refs nothing reports an unpushed count", async () => {
  const { base, repo } = await newGitRepo("osd-noremote-");
  await gitIn(repo, "worktree", "add", "-q", join(base, "wt"), "-b", "feat/local");
  await commits(join(base, "wt"), 2, "local");
  const snap = await scanRepo(newRepoConfig(repo, true));
  expect(snap.worktrees.map((w) => w.status)).toEqual([CLEAN, CLEAN]);
  expect(snap.worktrees.every((w) => w.unpushed === undefined)).toBe(true);
  expect(snap.workInProgress).toEqual({ worktrees: 1, uncommitted: 0, unpushed: 0, stale: 0, unknown: 0 });
  await rm(base, { recursive: true, force: true });
});

test("checkouts: above the cap the rest are listed without a status", async () => {
  const { base, repo } = await newGitRepo("osd-cap-");
  for (let i = 0; i < 15; i++) await gitIn(repo, "worktree", "add", "-q", join(base, "wt", `w${i}`), "-b", `feat/w${i}`);
  const snap = await scanRepo(newRepoConfig(repo, true));
  const linked = snap.worktrees.filter((w) => !w.isMain);
  expect(linked.length).toBe(15);
  expect(linked.filter((w) => typeof w.status === "object").length).toBe(MAX_INSPECTED_WORKTREES);
  const skipped = linked.filter((w) => w.inspected === false);
  expect(skipped.length).toBe(3);
  expect(skipped.every((w) => w.status === undefined)).toBe(true);
  expect(snap.worktrees[0].status).toEqual(CLEAN);
  expect(snap.workInProgress).toEqual({ worktrees: 15, uncommitted: 0, unpushed: 0, stale: 0, unknown: 0 });
  await rm(base, { recursive: true, force: true });
});

test("checkouts: a non-git repository reports none and no summary", async () => {
  class NotGit extends LocalRepoSource {
    override isGit() {
      return Promise.resolve(false);
    }
  }
  const snap = await scanRepo(newRepoConfig(wt.repo, true), new NotGit(wt.repo));
  expect(snap.ok).toBe(true);
  expect(snap.worktrees).toEqual([]);
  expect(snap.workInProgress).toBeUndefined();
});

test("scanner reports prompt.md: absent, small, oversized, and does not affect artifact status", async () => {
  const root = await tempDir();
  const changeRoot = join(root, "openspec", "changes");
  await mkdir(changeRoot, { recursive: true });
  await writeFile(join(root, "openspec", "config.yaml"), "schema: spec-driven\n");

  await mkdir(join(changeRoot, "no-prompt"), { recursive: true });
  await writeFile(join(changeRoot, "no-prompt", ".openspec.yaml"), "schema: spec-driven\ncreated: 2026-09-01\n");

  await mkdir(join(changeRoot, "with-prompt"), { recursive: true });
  await writeFile(join(changeRoot, "with-prompt", ".openspec.yaml"), "schema: spec-driven\ncreated: 2026-09-02\n");
  await writeFile(join(changeRoot, "with-prompt", "prompt.md"), "# Prompt\n\nLog every mutation\n");

  await mkdir(join(changeRoot, "oversized"), { recursive: true });
  await writeFile(join(changeRoot, "oversized", ".openspec.yaml"), "schema: spec-driven\ncreated: 2026-09-03\n");
  await writeFile(join(changeRoot, "oversized", "prompt.md"), "a".repeat(PROMPT_LIMIT_BYTES + 100));

  const snap = await scanRepo(newRepoConfig(root, true));
  const byName = new Map(snap.changes.map((c) => [c.name, c]));

  const noPrompt = byName.get("no-prompt")!;
  expect(noPrompt.prompt).toBeUndefined();
  // Artifact status unchanged by the prompt logic — proposal not done ⇒ "New".
  expect(noPrompt.column).toBe("New");

  const withPrompt = byName.get("with-prompt")!;
  expect(withPrompt.prompt).toBe("# Prompt\n\nLog every mutation\n");
  expect(withPrompt.column).toBe("New");

  const oversized = byName.get("oversized")!;
  expect(oversized.prompt?.length).toBe(PROMPT_LIMIT_BYTES);
  expect(oversized.warnings?.some((w) => w.includes("larger than"))).toBe(true);

  await rm(root, { recursive: true, force: true });
});
