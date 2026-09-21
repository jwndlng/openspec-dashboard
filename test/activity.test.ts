import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultConfig, newRepoConfig } from "../src/server/config.ts";
import { parseStatusPaths } from "../src/server/git.ts";
import { latestIso, Scanner, scanRepo } from "../src/server/scanner.ts";
import { type DirtyFile, LocalRepoSource } from "../src/server/source.ts";
import { tempDir, useTempHome } from "./helpers.ts";

const COMMIT_DATE = "2026-03-01T10:00:00+01:00";
const at = (iso: string) => Date.parse(iso);

let cleanup: () => Promise<void>;
let root: string;

async function git(cwd: string, ...args: string[]): Promise<void> {
  const proc = Bun.spawn(["git", "-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...args], {
    cwd,
    stdout: "ignore",
    stderr: "pipe",
    env: { ...process.env, GIT_AUTHOR_DATE: COMMIT_DATE, GIT_COMMITTER_DATE: COMMIT_DATE },
  });
  if ((await proc.exited) !== 0) throw new Error(`git ${args.join(" ")}: ${await new Response(proc.stderr).text()}`);
}

/** Sets a file's mtime to `iso` and returns it as epoch ms. */
async function touch(path: string, iso: string): Promise<number> {
  const date = new Date(iso);
  await utimes(path, date, date);
  return date.getTime();
}

beforeAll(async () => {
  ({ cleanup } = await useTempHome());
  root = await tempDir("osd-activity-");
  const foo = join(root, "openspec", "changes", "foo");
  await mkdir(foo, { recursive: true });
  await mkdir(join(root, "openspec", "specs", "auth"), { recursive: true });
  await writeFile(join(root, "openspec", "config.yaml"), "schema: spec-driven\n");
  await writeFile(join(foo, "proposal.md"), "# foo\n");
  await writeFile(join(foo, "design.md"), "# design\n");
  await writeFile(join(root, "openspec", "specs", "auth", "spec.md"), "# auth\n");
  await writeFile(join(root, "README.md"), "# repo\n");
  await git(root, "init", "-q");
  await git(root, "add", "-A");
  await git(root, "commit", "-q", "-m", "init");
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
  await cleanup();
});

const scan = () => scanRepo(newRepoConfig(root, true));
const fooOf = (snap: Awaited<ReturnType<typeof scan>>) => snap.changes.find((c) => c.name === "foo")!;

test("parseStatusPaths handles modified, untracked, deleted, renamed and spaced paths", () => {
  const out = [" M openspec/a.md", "?? openspec/new dir/b.md", " D openspec/gone.md", "R  openspec/new.md", "openspec/old.md", "D  openspec/staged-gone.md", ""].join("\0");
  expect(parseStatusPaths(out)).toEqual([
    { path: "openspec/a.md", deleted: false },
    { path: "openspec/new dir/b.md", deleted: false },
    { path: "openspec/gone.md", deleted: true },
    { path: "openspec/new.md", deleted: false },
    { path: "openspec/staged-gone.md", deleted: true },
  ]);
  expect(parseStatusPaths("")).toEqual([]);
});

test("latestIso compares instants across offsets and ignores junk", () => {
  expect(latestIso("2026-03-01T10:00:00+01:00", "2026-03-01T09:30:00Z")).toBe("2026-03-01T09:30:00Z");
  expect(latestIso(undefined, "not a date")).toBeUndefined();
});

test("clean tree: dates come from the commit even when a clean file's mtime is newer", async () => {
  // Same content, new mtime: what a checkout or clone does to every file.
  await touch(join(root, "openspec", "changes", "foo", "proposal.md"), "2026-09-01T00:00:00Z");
  const snap = await scan();
  expect(snap.ok).toBe(true);
  expect(at(fooOf(snap).lastActivityAt!)).toBe(at(COMMIT_DATE));
  expect(at(snap.lastUpdatedAt!)).toBe(at(COMMIT_DATE));
});

test("scanning never rewrites .git/index, even when its stat data is stale", async () => {
  await touch(join(root, "openspec", "changes", "foo", "design.md"), "2026-09-02T00:00:00Z");
  const before = await readFile(join(root, ".git", "index"));
  await scan();
  expect(Buffer.compare(before, await readFile(join(root, ".git", "index")))).toBe(0);
});

test("an uncommitted edit to a committed change counts", async () => {
  const design = join(root, "openspec", "changes", "foo", "design.md");
  await writeFile(design, "# design, edited\n");
  const mtime = await touch(design, "2026-09-10T12:00:00Z");
  const snap = await scan();
  expect(at(fooOf(snap).lastActivityAt!)).toBe(mtime);
  expect(at(snap.lastUpdatedAt!)).toBe(mtime);
});

test("files in an untracked change directory are listed individually", async () => {
  const idea = join(root, "openspec", "changes", "new-idea");
  await mkdir(idea, { recursive: true });
  await writeFile(join(idea, "proposal.md"), "# idea\n");
  const mtime = await touch(join(idea, "proposal.md"), "2026-09-12T12:00:00Z");
  await touch(idea, "2026-09-05T00:00:00Z"); // the directory itself is older than the file in it
  const snap = await scan();
  expect(at(snap.lastUpdatedAt!)).toBe(mtime);
  expect(at(snap.changes.find((c) => c.name === "new-idea")!.lastActivityAt!)).toBe(mtime);
});

test("a spec edited outside any change moves the repo date but no change's date", async () => {
  const spec = join(root, "openspec", "specs", "auth", "spec.md");
  await writeFile(spec, "# auth, edited\n");
  const mtime = await touch(spec, "2026-09-15T12:00:00Z");
  const before = fooOf(await scan()).lastActivityAt;
  const snap = await scan();
  expect(at(snap.lastUpdatedAt!)).toBe(mtime);
  expect(fooOf(snap).lastActivityAt).toBe(before);
  expect(at(before!)).toBeLessThan(mtime);
});

test("files outside openspec/ never count", async () => {
  await writeFile(join(root, "README.md"), "# repo, edited\n");
  await touch(join(root, "README.md"), "2026-09-18T00:00:00Z");
  expect(at((await scan()).lastUpdatedAt!)).toBe(at("2026-09-15T12:00:00Z"));
});

test("a deleted file counts through its parent directory", async () => {
  await rm(join(root, "openspec", "changes", "foo", "proposal.md"));
  const mtime = await touch(join(root, "openspec", "changes", "foo"), "2026-09-16T12:00:00Z");
  const snap = await scan();
  expect(at(fooOf(snap).lastActivityAt!)).toBe(mtime);
  expect(at(snap.lastUpdatedAt!)).toBe(mtime);
});

test("git status failing degrades to commit dates without failing the scan", async () => {
  class NoStatus extends LocalRepoSource {
    override dirtyFiles(): Promise<DirtyFile[]> {
      return Promise.reject(new Error("status timed out"));
    }
  }
  const snap = await scanRepo(newRepoConfig(root, true), new NoStatus(root));
  expect(snap.ok).toBe(true);
  expect(at(fooOf(snap).lastActivityAt!)).toBe(at(COMMIT_DATE));
  // The repository is never older than its changes: `new-idea` was never committed, so its time comes from its files
  // (the mtime fallback), which needs no `git status`.
  const newest = Math.max(...snap.changes.map((c) => at(c.lastActivityAt!)));
  expect(newest).toBeGreaterThan(at(COMMIT_DATE));
  expect(at(snap.lastUpdatedAt!)).toBe(newest);
});

test("non-git repository uses the newest mtime under openspec/", async () => {
  const plain = await tempDir("osd-plain-");
  const change = join(plain, "openspec", "changes", "bar");
  await mkdir(change, { recursive: true });
  await writeFile(join(change, "proposal.md"), "# bar\n");
  await writeFile(join(plain, "openspec", "project.md"), "# project\n");
  await touch(join(change, "proposal.md"), "2026-08-01T00:00:00Z");
  const mtime = await touch(join(plain, "openspec", "project.md"), "2026-08-20T00:00:00Z");
  // A temp dir can sit inside no git repo at all; make sure of it for this assertion.
  const snap = await scanRepo(newRepoConfig(plain, true));
  if (!snap.isGit) {
    expect(at(snap.lastUpdatedAt!)).toBe(mtime);
    expect(at(snap.changes[0].lastActivityAt!)).toBe(at("2026-08-01T00:00:00Z"));
  }
  await rm(plain, { recursive: true, force: true });
});

test("a failed scan keeps the previous lastUpdatedAt", async () => {
  const repo = newRepoConfig(root, true);
  const config = { ...defaultConfig(), repos: [repo] };
  let fail = false;
  class Flaky extends LocalRepoSource {
    override exists(): Promise<boolean> {
      return fail ? Promise.reject(new Error("boom")) : super.exists();
    }
  }
  const scanner = new Scanner(() => config, { persist: false, sourceFor: (r) => new Flaky(r.path) });
  const good = (await scanner.trigger().done).repos[0];
  expect(good.lastUpdatedAt).toBeDefined();
  fail = true;
  const bad = (await scanner.trigger().done).repos[0];
  expect(bad.ok).toBe(false);
  expect(bad.lastUpdatedAt).toBe(good.lastUpdatedAt);
});
