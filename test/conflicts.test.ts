// The conflict signal of a work status: git's own merge, run in memory, writing nothing into the repository (design D1).
import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mergeScratchDir, worktreesDir } from "../src/server/paths.ts";
import { MAX_CONFLICT_FILES, pruneMergeScratch, readConflicts, readWorkStatus } from "../src/server/sessions/workStatus.ts";
import { ensureWorktree } from "../src/server/sessions/worktree.ts";
import { tempDir, treeFingerprint, useTempHome } from "./helpers.ts";
import { git, tempGitRepo } from "./sessionHelpers.ts";

setDefaultTimeout(30_000);

let cleanup: () => Promise<void>;
beforeAll(async () => {
  ({ cleanup } = await useTempHome());
});
afterAll(() => cleanup());

async function worktree(repoPath: string, name: string): Promise<string> {
  const path = join(worktreesDir(), `t-${Math.random().toString(36).slice(2, 8)}`, name);
  await ensureWorktree(repoPath, path, `feat/${name}`);
  return path;
}

const commit = async (cwd: string, files: Record<string, string>, message: string) => {
  for (const [name, content] of Object.entries(files)) await writeFile(join(cwd, name), content);
  git(cwd, "add", "-A");
  git(cwd, "commit", "-q", "-m", message);
};

/** Gives the repository an `origin` (a bare repository next to it) that has `main`, as after a clone. */
async function withOrigin(repoPath: string): Promise<void> {
  const bare = join(await tempDir("osd-origin-"), "origin.git");
  git(repoPath, "init", "-q", "--bare", bare);
  git(repoPath, "remote", "add", "origin", bare);
  git(repoPath, "push", "-q", "-u", "origin", "main");
  git(repoPath, "remote", "set-head", "origin", "main");
}

/** A repository whose `main` and whose branch both moved, so a merge is a real question. */
async function diverged(): Promise<{ repo: string; wt: string }> {
  const repo = await tempGitRepo();
  await commit(repo, { "f.txt": "a\nb\nc\n", "g.txt": "x\n" }, "base");
  const wt = await worktree(repo, "diverge");
  return { repo, wt };
}

test("overlapping edits report the conflicting files", async () => {
  const { repo, wt } = await diverged();
  await commit(wt, { "f.txt": "a\nb\nBRANCH\n", "g.txt": "x\nbranch\n" }, "branch edit");
  await commit(repo, { "f.txt": "a\nb\nMAIN\n", "g.txt": "x\nmain\n" }, "main edit");

  const conflicts = await readConflicts(wt, "main");
  expect(conflicts?.base).toBe("main");
  expect(conflicts?.files.sort()).toEqual(["f.txt", "g.txt"]);
  expect(conflicts?.truncated).toBeUndefined();
});

test("a base that moved on other files reports no conflict", async () => {
  const { repo, wt } = await diverged();
  await commit(wt, { "f.txt": "a\nb\nBRANCH\n" }, "branch edit");
  await commit(repo, { "other.txt": "unrelated\n" }, "main edit elsewhere");

  expect(await readConflicts(wt, "main")).toBeUndefined();
});

test("the same line changed identically on both sides is not a conflict", async () => {
  const { repo, wt } = await diverged();
  await commit(wt, { "f.txt": "a\nb\nSAME\n" }, "branch edit");
  await commit(repo, { "f.txt": "a\nb\nSAME\n" }, "main edit");

  expect(await readConflicts(wt, "main")).toBeUndefined();
});

test("a long list of conflicting files is capped and reported as truncated", async () => {
  const { repo, wt } = await diverged();
  const many = MAX_CONFLICT_FILES + 5;
  const onBranch: Record<string, string> = {};
  const onMain: Record<string, string> = {};
  for (let i = 0; i < many; i++) {
    onBranch[`f${i}.txt`] = `branch ${i}\n`;
    onMain[`f${i}.txt`] = `main ${i}\n`;
  }
  await commit(wt, onBranch, "branch adds many");
  await commit(repo, onMain, "main adds the same many");

  const conflicts = await readConflicts(wt, "main");
  expect(conflicts?.files).toHaveLength(MAX_CONFLICT_FILES);
  expect(conflicts?.truncated).toBe(true);
});

test("an unreadable base yields no answer instead of throwing", async () => {
  const { wt } = await diverged();
  expect(await readConflicts(wt, "no-such-ref")).toBeUndefined();
  expect(await readConflicts(wt, "refs/heads/gone")).toBeUndefined();
});

test("a directory that is not a git worktree yields no answer", async () => {
  const plain = await tempDir("osd-plain-");
  expect(await readConflicts(plain, "main")).toBeUndefined();
});

// Spec (dashboard-api): the conflict check writes nothing into the repository.
test("the check leaves the repository and the worktree byte-identical, and writes into the scratch store", async () => {
  const { repo, wt } = await diverged();
  await commit(wt, { "f.txt": "a\nb\nBRANCH\n" }, "branch edit");
  await commit(repo, { "f.txt": "a\nb\nMAIN\n" }, "main edit");
  await pruneMergeScratch();

  // Baselines first: the test's own `git status` has no GIT_OPTIONAL_LOCKS=0 and would refresh the index itself.
  const head = git(wt, "rev-parse", "HEAD");
  const status = git(wt, "status", "--porcelain");
  const beforeRepo = await treeFingerprint(repo);
  const beforeWt = await treeFingerprint(wt);

  // The whole status read, not just the bare check: this is what a scan actually runs.
  const work = (await readWorkStatus(repo, wt)).work;
  expect(work.conflicts?.files).toEqual(["f.txt"]);

  expect(await treeFingerprint(repo)).toBe(beforeRepo);
  expect(await treeFingerprint(wt)).toBe(beforeWt);
  expect(git(wt, "rev-parse", "HEAD")).toBe(head);
  expect(git(wt, "status", "--porcelain")).toBe(status); // after the fingerprints, for the same reason
  // …and the objects git did write went to the dashboard's own store.
  const scratch = await readdir(mergeScratchDir(), { recursive: true });
  expect(scratch.length).toBeGreaterThan(2); // more than the empty info/ and pack/
});

test("the scratch store is emptied on start-up and rebuilt on demand", async () => {
  const { repo, wt } = await diverged();
  await commit(wt, { "f.txt": "a\nb\nBRANCH\n" }, "branch edit");
  await commit(repo, { "f.txt": "a\nb\nMAIN\n" }, "main edit");
  expect(await readConflicts(wt, "main")).toBeDefined();

  await pruneMergeScratch();
  await expect(readdir(mergeScratchDir())).rejects.toThrow();

  expect(await readConflicts(wt, "main")).toBeDefined(); // created again on demand
  expect(await readdir(mergeScratchDir())).toContain("pack");
});

// Design D1: an old git without `--write-tree` must degrade to silence, never to an error or a writing fallback.
test("a git that cannot merge in memory leaves every status without conflict information", async () => {
  const { repo, wt } = await diverged();
  await commit(wt, { "f.txt": "a\nb\nBRANCH\n" }, "branch edit");
  await commit(repo, { "f.txt": "a\nb\nMAIN\n" }, "main edit");

  // A `git` earlier on PATH that answers everything the real one does, except `merge-tree`.
  const binDir = join(await tempDir("osd-bin-"), "bin");
  await mkdir(binDir, { recursive: true });
  const real = Bun.which("git");
  await writeFile(
    join(binDir, "git"),
    `#!/bin/sh\nfor a in "$@"; do\n  if [ "$a" = "merge-tree" ]; then echo "fatal: unknown subcommand" >&2; exit 129; fi\ndone\nexec ${real} "$@"\n`,
    { mode: 0o755 },
  );
  const previous = process.env.PATH;
  process.env.PATH = `${binDir}:${previous}`;
  try {
    const { work } = await readWorkStatus(repo, wt);
    expect(work.state).toBe("unpushed"); // every other part of the status still answered
    expect(work.conflicts).toBeUndefined();
    expect(await readConflicts(wt, "main")).toBeUndefined();
  } finally {
    process.env.PATH = previous;
    await rm(binDir, { recursive: true, force: true });
  }
});

test("only work the base lacks is checked: merged, clean and missing carry no conflict information", async () => {
  const { repo, wt } = await diverged();
  await withOrigin(repo);
  // clean: the branch has nothing the base lacks
  expect((await readWorkStatus(repo, wt)).work).toEqual({ state: "clean", base: "origin/main" });

  await commit(wt, { "f.txt": "a\nb\nBRANCH\n" }, "branch edit");
  git(wt, "push", "-q", "-u", "origin", "feat/diverge");
  await commit(repo, { "f.txt": "a\nb\nMAIN\n" }, "main edit");
  git(repo, "push", "-q", "origin", "main");
  expect((await readWorkStatus(repo, wt)).work.conflicts?.files).toEqual(["f.txt"]);

  // merged: the base now has the branch's content, so there is nothing left to merge
  git(repo, "merge", "-q", "--no-ff", "-m", "merge", "-X", "theirs", "feat/diverge");
  git(repo, "push", "-q", "origin", "main");
  const merged = (await readWorkStatus(repo, wt)).work;
  expect(merged.state).toBe("merged");
  expect(merged.conflicts).toBeUndefined();

  // missing: not a worktree at all
  const gone = await readWorkStatus(repo, join(wt, "no-such-dir"));
  expect(gone.work).toEqual({ state: "missing" });
  expect(gone.work.conflicts).toBeUndefined();
});

test("a dirty worktree is judged on its commits, and keeps its state and count", async () => {
  const { repo, wt } = await diverged();
  await commit(wt, { "f.txt": "a\nb\nBRANCH\n" }, "branch edit");
  await commit(repo, { "f.txt": "a\nb\nMAIN\n" }, "main edit");
  await writeFile(join(wt, "scratch.txt"), "not committed");

  const work = (await readWorkStatus(repo, wt)).work;
  expect(work.state).toBe("uncommitted");
  expect(work.count).toBe(1);
  expect(work.base).toBe("the main checkout");
  // The uncommitted file is not part of the question; the branch's commits are.
  expect(work.conflicts).toEqual({ base: "the main checkout", files: ["f.txt"] });
});

test("with an origin the conflict names the default branch the user knows", async () => {
  const { repo, wt } = await diverged();
  await withOrigin(repo);

  await commit(wt, { "f.txt": "a\nb\nBRANCH\n" }, "branch edit");
  await commit(repo, { "f.txt": "a\nb\nMAIN\n" }, "main edit");
  git(repo, "push", "-q", "origin", "main");

  const work = (await readWorkStatus(repo, wt)).work;
  expect(work.base).toBe("origin/main");
  // The display base, not the raw ref the merge was computed against.
  expect(work.conflicts).toEqual({ base: "origin/main", files: ["f.txt"] });
});
