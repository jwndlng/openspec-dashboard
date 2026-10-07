import { afterAll, afterEach, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { chmod, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { defaultConfig, newRepoConfig } from "../src/server/config.ts";
import { blockingSet, classifyBlocking, isChangeLeftoverPath, maskCredentials, parseBlobEntries, parseNulList, parseStatusStates, PullBusyError, pullAll, pullRepository, reasonFrom } from "../src/server/pull.ts";
import { Scanner } from "../src/server/scanner.ts";
import { useTempHome } from "./helpers.ts";
import { type Fixture, fixture, git, localChange, remoteChange, remoteCommits } from "./pullHelpers.ts";

// These tests create git repositories, run real git against local remotes and wait on deliberately slow fake remotes;
// slow CI runners need more than the 5 s default.
setDefaultTimeout(60_000);

let cleanup: () => Promise<void>;
const bases: string[] = [];
const savedSsh = process.env.GIT_SSH_COMMAND;
beforeAll(async () => {
  ({ cleanup } = await useTempHome());
});
afterEach(() => {
  if (savedSsh === undefined) delete process.env.GIT_SSH_COMMAND;
  else process.env.GIT_SSH_COMMAND = savedSsh;
});
afterAll(async () => {
  for (const b of bases) await rm(b, { recursive: true, force: true });
  await cleanup();
});

async function make(defaultName?: string): Promise<Fixture> {
  const f = await fixture(defaultName);
  bases.push(f.base);
  return f;
}
const head = (dir: string) => git(dir, "rev-parse", "HEAD");
const status = (dir: string) => git(dir, "status", "--porcelain");
const pull = (f: Fixture, options?: { fetchTimeoutMs?: number }) => pullRepository(newRepoConfig(f.repo, true), options);

/** Every file under `dir` with size and mtime — any write at all shows up. */
async function fingerprint(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const visit = async (d: string): Promise<void> => {
    for (const entry of await readdir(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) await visit(p);
      else {
        const s = await stat(p);
        out[relative(dir, p)] = `${s.size}:${s.mtimeMs}`;
      }
    }
  };
  await visit(dir);
  return out;
}

test("behind and clean: fast-forwarded by the right number of commits; then up to date", async () => {
  const f = await make();
  await remoteCommits(f, 2);
  const result = await pull(f);
  expect(result).toMatchObject({ fetched: true, update: "fast-forwarded", commits: 2, branch: "main", upstream: "origin/main", defaultBranch: "main" });
  expect(head(f.repo)).toBe(head(f.other));
  expect(status(f.repo)).toBe("");
  const before = await fingerprint(join(f.repo, "app.txt").replace(/app\.txt$/, "openspec"));
  expect(await pull(f)).toMatchObject({ fetched: true, update: "up-to-date" });
  expect(await fingerprint(join(f.repo, "openspec"))).toEqual(before);
});

test("an unrelated uncommitted edit survives; an overlapping one makes git refuse and nothing changes", async () => {
  const f = await make();
  await remoteCommits(f, 1, "app.txt");
  await writeFile(join(f.repo, "notes.txt"), "my notes, not committed\n");
  expect(await pull(f)).toMatchObject({ update: "fast-forwarded", commits: 1 });
  expect(await readFile(join(f.repo, "notes.txt"), "utf8")).toBe("my notes, not committed\n");

  await remoteCommits(f, 1, "app.txt");
  await writeFile(join(f.repo, "app.txt"), "my edit to the same file\n");
  const at = head(f.repo);
  const index = await readFile(join(f.repo, ".git", "index"));
  const refused = await pull(f);
  expect(refused).toMatchObject({ fetched: true, update: "refused" });
  expect(refused.reason).toContain("would be overwritten");
  expect(refused.reason).toContain("app.txt");
  expect([head(f.repo), await readFile(join(f.repo, "app.txt"), "utf8")]).toEqual([at, "my edit to the same file\n"]);
  expect(Buffer.compare(index, await readFile(join(f.repo, ".git", "index")))).toBe(0);
});

test("diverged: refused, the local commit and the working tree are untouched", async () => {
  const f = await make();
  await remoteCommits(f, 1);
  await writeFile(join(f.repo, "local.txt"), "local\n");
  git(f.repo, "add", "-A");
  git(f.repo, "commit", "-q", "-m", "local work");
  const at = head(f.repo);
  const result = await pull(f);
  expect(result).toMatchObject({ fetched: true, update: "refused", reason: "local and remote have diverged (1 ahead, 1 behind)" });
  expect([head(f.repo), status(f.repo)]).toEqual([at, ""]);
  expect(git(f.repo, "log", "--oneline", "--merges")).toBe(""); // never a merge commit
});

test("off the default branch, or detached: fetched only — refs move, the checkout does not", async () => {
  const f = await make();
  git(f.repo, "checkout", "-q", "-b", "feat/redesign");
  await writeFile(join(f.repo, "wip.txt"), "work in progress\n");
  await remoteCommits(f, 3);
  const tracking = git(f.repo, "rev-parse", "origin/main");
  const at = head(f.repo);
  const result = await pull(f);
  expect(result).toMatchObject({ fetched: true, update: "skipped", branch: "feat/redesign", defaultBranch: "main", reason: "on feat/redesign, not main; only fetched" });
  expect(git(f.repo, "rev-parse", "origin/main")).not.toBe(tracking); // the fetch happened
  expect([head(f.repo), git(f.repo, "symbolic-ref", "--short", "HEAD"), status(f.repo)]).toEqual([at, "feat/redesign", "?? wip.txt"]);

  git(f.repo, "checkout", "-q", "--detach");
  expect(await pull(f)).toMatchObject({ fetched: true, update: "skipped", reason: "on a detached HEAD, not main; only fetched" });
});

test("no upstream: fetched from origin, not updated. No remote at all: nothing is run", async () => {
  const f = await make();
  git(f.repo, "branch", "--unset-upstream");
  await remoteCommits(f, 1);
  const at = head(f.repo);
  expect(await pull(f)).toMatchObject({ fetched: true, update: "skipped", reason: "main has no upstream; only fetched" });
  expect(head(f.repo)).toBe(at);

  const lonely = await make();
  git(lonely.repo, "remote", "remove", "origin");
  const before = await fingerprint(lonely.repo);
  expect(await pull(lonely)).toMatchObject({ fetched: false, update: "skipped", reason: "no remote configured; there is nothing to pull" });
  expect(await fingerprint(lonely.repo)).toEqual(before);
});

test("unreachable remote: failed with git's reason, nothing in the working tree changed", async () => {
  const f = await make();
  git(f.repo, "remote", "set-url", "origin", join(f.base, "nowhere.git"));
  const at = head(f.repo);
  const result = await pull(f);
  expect(result).toMatchObject({ fetched: false, update: "failed" });
  expect(result.reason).toContain("does not appear to be a git repository");
  expect([head(f.repo), status(f.repo)]).toEqual([at, ""]);
});

test("a remote that never answers is stopped at the timeout", async () => {
  const f = await make();
  git(f.repo, "remote", "set-url", "origin", "ssh://git.example.invalid/team/repo.git");
  process.env.GIT_SSH_COMMAND = "sleep 30 #"; // stands in for a connection that hangs
  const started = Date.now();
  expect(await pull(f, { fetchTimeoutMs: 500 })).toMatchObject({ fetched: false, update: "failed", reason: "timed out" });
  expect(Date.now() - started).toBeLessThan(10_000);
});

test("repository hooks do not run, and the result says so", async () => {
  const f = await make();
  const hook = join(f.repo, ".git", "hooks", "post-merge");
  await mkdir(join(f.repo, ".git", "hooks"), { recursive: true });
  await writeFile(hook, "#!/bin/sh\necho ran > hook-ran.txt\n");
  await chmod(hook, 0o755);
  await remoteCommits(f, 1);
  expect(await pull(f)).toMatchObject({ update: "fast-forwarded", hooksSkipped: true });
  expect(existsSync(join(f.repo, "hook-ran.txt"))).toBe(false);
  // the hook is real: a plain merge would have run it
  await remoteCommits(f, 1);
  git(f.repo, "fetch", "-q");
  git(f.repo, "merge", "--ff-only", "-q", "origin/main");
  expect(existsSync(join(f.repo, "hook-ran.txt"))).toBe(true);
});

test("linked worktrees are left alone: files, index and branch", async () => {
  const f = await make();
  const one = join(f.base, "wt-one");
  const two = join(f.repo, ".claude", "worktrees", "two");
  git(f.repo, "worktree", "add", "-q", "-b", "feat/one", one);
  git(f.repo, "worktree", "add", "-q", "-b", "feat/two", two);
  await writeFile(join(one, "wip.txt"), "uncommitted in a worktree\n");
  await remoteCommits(f, 2);
  const before = { one: await fingerprint(one), two: await fingerprint(two), heads: [head(one), head(two)], indexes: await Promise.all(["wt-one", "two"].map((n) => readFile(join(f.repo, ".git", "worktrees", n, "index")))) };
  expect(await pull(f)).toMatchObject({ update: "fast-forwarded", commits: 2 });
  expect(await fingerprint(one)).toEqual(before.one);
  expect([head(one), head(two)]).toEqual(before.heads);
  for (const [i, n] of ["wt-one", "two"].entries()) expect(Buffer.compare(before.indexes[i], await readFile(join(f.repo, ".git", "worktrees", n, "index")))).toBe(0);
  expect([git(one, "symbolic-ref", "--short", "HEAD"), git(two, "symbolic-ref", "--short", "HEAD")]).toEqual(["feat/one", "feat/two"]);
});

test("what reaches the browser: credentials masked, git's telling lines only", () => {
  expect(maskCredentials("fatal: unable to access 'https://alice:s3cret@git.example.invalid/team/repo.git/'")).toBe("fatal: unable to access 'https://***@git.example.invalid/team/repo.git/'");
  expect(maskCredentials("ssh://deploy@host.example.invalid/x and https://tok3n@h.example.invalid/y")).toBe("ssh://***@host.example.invalid/x and https://***@h.example.invalid/y");
  expect(maskCredentials("nothing to hide in /home/demo/work/x")).toBe("nothing to hide in /home/demo/work/x");
  expect(reasonFrom("hint: try again\nfatal: Could not read from remote repository.\n\nhint: check access")).toBe("Could not read from remote repository.");
  expect(reasonFrom("error: Your local changes to the following files would be overwritten by merge:\n\tapp.txt\nPlease commit your changes or stash them before you merge.\nAborting")).toBe("Your local changes to the following files would be overwritten by merge: app.txt");
  expect(reasonFrom("fatal: unable to access 'https://bob:pw@h.example.invalid/r.git/': timeout")).toBe("unable to access 'https://***@h.example.invalid/r.git/': timeout");
  expect(reasonFrom("")).toBe("git gave no reason");
});

test("one pull per repository at a time; pull-all reports every repository on its own", async () => {
  const slow = await make();
  git(slow.repo, "remote", "set-url", "origin", "ssh://git.example.invalid/team/repo.git");
  process.env.GIT_SSH_COMMAND = "sleep 2 #";
  const first = pull(slow, { fetchTimeoutMs: 800 });
  await expect(pull(slow)).rejects.toBeInstanceOf(PullBusyError);
  expect((await first).update).toBe("failed");
  expect((await pull(slow, { fetchTimeoutMs: 300 })).update).toBe("failed"); // the lock was released

  delete process.env.GIT_SSH_COMMAND;
  const [good, unreachable, offBranch] = [await make(), await make(), await make()];
  await remoteCommits(good, 1);
  git(unreachable.repo, "remote", "set-url", "origin", join(unreachable.base, "nowhere.git"));
  git(offBranch.repo, "checkout", "-q", "-b", "release/4.2");
  const results = await pullAll([good, unreachable, offBranch].map((f) => newRepoConfig(f.repo, true)));
  expect(results.map((r) => r.update)).toEqual(["fast-forwarded", "failed", "skipped"]);
  expect(results.map((r) => r.fetched)).toEqual([true, false, true]);
});

test("nothing but the pull action ever reaches a remote: scans and polls leave a recording remote untouched", async () => {
  const f = await make();
  // Every access to this remote goes through a fake ssh that leaves a marker before failing.
  const marker = join(f.base, "remote-was-contacted");
  const fakeSsh = join(f.base, "fake-ssh.sh");
  await writeFile(fakeSsh, `#!/bin/sh\necho contacted >> "${marker}"\nexit 1\n`);
  await chmod(fakeSsh, 0o755);
  git(f.repo, "remote", "set-url", "origin", "ssh://git.example.invalid/team/repo.git");
  process.env.GIT_SSH_COMMAND = fakeSsh;

  const repo = newRepoConfig(f.repo, true);
  const config = { ...defaultConfig(), repos: [repo] };
  const scanner = new Scanner(() => config, { persist: false });
  for (let i = 0; i < 3; i++) await scanner.trigger().done; // what start-up and the poll interval do
  expect(scanner.snapshot.repos[0]).toMatchObject({ ok: true, defaultBranch: "main", onDefaultBranch: true });
  expect(existsSync(marker)).toBe(false);

  // …and the recorder does work: the pull action is what trips it
  expect((await pullRepository(repo)).update).toBe("failed");
  expect(existsSync(marker)).toBe(true);
});

// ---------------------------------------------------------------------------------------------------------------------
// Blocking files: the pure classification, then what a refusal reports.
// ---------------------------------------------------------------------------------------------------------------------

const YAML = "openspec/changes/add-login/.openspec.yaml";
const blob = (id: string, mode = "100644") => ({ mode, id });
const a = "a".repeat(40);
const b = "b".repeat(40);

test("git's -z output parses back into paths, states and blobs, spaces and all", () => {
  expect(parseNulList("one\u0000two\u0000")).toEqual(["one", "two"]);
  const states = parseStatusStates(" M src/app.ts\u0000A  openspec/changes/x/y\u0000?? note s.md\u0000AD gone.txt\u0000");
  expect([...states]).toEqual([
    ["src/app.ts", " M"],
    ["openspec/changes/x/y", "A "],
    ["note s.md", "??"],
    ["gone.txt", "AD"],
  ]);
  expect([...parseBlobEntries(`100644 blob ${a}\t${YAML}\u0000120000 blob ${b}\tlink\u0000`)]).toEqual([
    [YAML, blob(a)],
    ["link", blob(b, "120000")],
  ]);
  expect([...parseBlobEntries(`100755 ${a} 0\tbin/run\u0000`)]).toEqual([["bin/run", blob(a, "100755")]]);
  expect(parseBlobEntries("garbage with no tab\u0000").size).toBe(0);
});

test("only the paths the incoming commits change and the checkout has uncommitted block, once each, sorted", () => {
  const states = new Map([
    ["src/app.ts", " M"],
    ["notes.md", " M"],
  ]);
  expect(blockingSet(["src/app.ts", "src/app.ts", "README.md"], states)).toEqual(["src/app.ts"]);
  expect(blockingSet(["b.txt", "src/app.ts"], new Map([...states, ["b.txt", "??"]]))).toEqual(["b.txt", "src/app.ts"]);
  expect(blockingSet(["README.md"], states)).toEqual([]);
});

test("a leftover path is a change directory's file, never the archive and never an odd name", () => {
  expect(isChangeLeftoverPath(YAML)).toBe(true);
  expect(isChangeLeftoverPath("openspec/changes/add-login/specs/api/spec.md")).toBe(true);
  expect(isChangeLeftoverPath("openspec/changes/archive/2026-01-01-add-login/proposal.md")).toBe(false);
  expect(isChangeLeftoverPath("openspec/changes/add login/proposal.md")).toBe(false); // not a change name
  expect(isChangeLeftoverPath("openspec/changes/../secrets/x.md")).toBe(false);
  expect(isChangeLeftoverPath("openspec/changes/add-login/../../../x")).toBe(false);
  expect(isChangeLeftoverPath("openspec/changes/add-login")).toBe(false); // the directory itself, no file
  expect(isChangeLeftoverPath("openspec/changes/add-login/")).toBe(false);
  expect(isChangeLeftoverPath("openspec/specs/api/spec.md")).toBe(false);
  expect(isChangeLeftoverPath("src/app.ts")).toBe(false);
});

test("what makes a blocking file a leftover, and what makes it differ", () => {
  const facts = { incoming: blob(a), worktree: a, regularFile: true };
  // staged, identical to the incoming blob
  expect(classifyBlocking(YAML, "A ", { ...facts, staged: blob(a) })).toEqual({ path: YAML, kind: "leftover", differs: false, incoming: a, staged: a, worktree: a });
  // staged and edited: the working tree differs
  expect(classifyBlocking(YAML, "AM", { ...facts, staged: blob(a), worktree: b })).toMatchObject({ kind: "leftover", differs: true, worktree: b });
  // staged content differs even though the working tree matches
  expect(classifyBlocking(YAML, "A ", { ...facts, staged: blob(b) })).toMatchObject({ kind: "leftover", differs: true, staged: b });
  // a mode of its own is a difference too
  expect(classifyBlocking(YAML, "A ", { ...facts, staged: blob(a, "100755") })).toMatchObject({ kind: "leftover", differs: true });
  // untracked, never staged
  expect(classifyBlocking(YAML, "??", facts)).toEqual({ path: YAML, kind: "leftover", differs: false, incoming: a, staged: undefined, worktree: a });

  // everything that is the user's own work instead
  const work = { path: YAML, kind: "local-work" as const };
  expect(classifyBlocking(YAML, " M", facts)).toEqual(work); // tracked in the current commit and edited
  expect(classifyBlocking(YAML, "AD", facts)).toEqual(work); // staged new but deleted again
  expect(classifyBlocking(YAML, "A ", { ...facts, incoming: undefined })).toEqual(work); // the incoming commit has no such file
  expect(classifyBlocking(YAML, "A ", { ...facts, incoming: blob(a, "120000") })).toEqual(work); // a symlink upstream
  expect(classifyBlocking(YAML, "A ", { ...facts, staged: blob(a, "120000") })).toEqual(work); // a symlink in the index
  expect(classifyBlocking(YAML, "A ", { ...facts, regularFile: false })).toEqual(work); // not an ordinary file on disk
  expect(classifyBlocking(YAML, "A ", { ...facts, worktree: undefined })).toEqual(work); // could not be hashed
  expect(classifyBlocking("src/app.ts", "A ", facts)).toEqual({ path: "src/app.ts", kind: "local-work" });
  expect(classifyBlocking("openspec/changes/archive/2026-01-01-x/proposal.md", "A ", facts)).toMatchObject({ kind: "local-work" });
});

test("a refusal over local work lists exactly the overlapping files and says what to do about them", async () => {
  const f = await make();
  await remoteCommits(f, 1, "app.txt");
  await writeFile(join(f.repo, "app.txt"), "my edit to the same file\n");
  await writeFile(join(f.repo, "notes.txt"), "an edit nothing incoming touches\n"); // not blocking
  const refused = await pull(f);
  expect(refused).toMatchObject({ update: "refused", blocking: [{ path: "app.txt", kind: "local-work" }], hint: "Commit or set aside the listed files, then pull again." });
  expect(refused.blocking).toHaveLength(1);
  expect(refused.resolvable).toBeUndefined();
  expect(refused.reason).toContain("would be overwritten");
});

test("a change's own leftovers are recognised: staged, untracked, identical and differing, and the offer is made", async () => {
  const f = await make();
  await remoteChange(f, "add-login", { ".openspec.yaml": "schema: spec-driven\n", "prompt.md": "upstream prompt\n" });
  await remoteChange(f, "add-billing", { ".openspec.yaml": "schema: spec-driven\n" });
  await localChange(f, "add-login", { ".openspec.yaml": "schema: spec-driven\n", "prompt.md": "the prompt as it was typed here\n" });
  await localChange(f, "add-billing", { ".openspec.yaml": "schema: spec-driven\n" }, false); // never staged
  const refused = await pull(f);
  expect(refused.update).toBe("refused");
  expect(refused.blocking).toEqual([
    { path: "openspec/changes/add-billing/.openspec.yaml", kind: "leftover", differs: false, incoming: expect.any(String), staged: undefined, worktree: expect.any(String) },
    { path: "openspec/changes/add-login/.openspec.yaml", kind: "leftover", differs: false, incoming: expect.any(String), staged: expect.any(String), worktree: expect.any(String) },
    { path: "openspec/changes/add-login/prompt.md", kind: "leftover", differs: true, incoming: expect.any(String), staged: expect.any(String), worktree: expect.any(String) },
  ]);
  expect(refused.resolvable).toEqual({ upstream: git(f.repo, "rev-parse", "origin/main"), files: refused.blocking ?? [] });
  expect(refused.hint).toContain("Resolve and pull replaces them with the incoming version");
});

test("one real edit among the leftovers withdraws the offer", async () => {
  const f = await make();
  await remoteChange(f, "add-login", { ".openspec.yaml": "schema: spec-driven\n" });
  await remoteCommits(f, 1, "app.txt");
  await localChange(f, "add-login", { ".openspec.yaml": "schema: spec-driven\n" });
  await writeFile(join(f.repo, "app.txt"), "my own edit\n");
  const refused = await pull(f);
  expect(refused.blocking?.map((b) => [b.path, b.kind])).toEqual([
    ["app.txt", "local-work"],
    ["openspec/changes/add-login/.openspec.yaml", "leftover"],
  ]);
  expect(refused.resolvable).toBeUndefined();
  expect(refused.hint).toBe("Commit or set aside the listed files, then pull again.");
});

test("an offer writes nothing: a refused pull with a Resolve and pull offer changed nothing beyond the fetch", async () => {
  const f = await make();
  await remoteChange(f, "add-login", { ".openspec.yaml": "schema: spec-driven\n", "prompt.md": "as merged\n" });
  await localChange(f, "add-login", { ".openspec.yaml": "schema: spec-driven\n", "prompt.md": "as typed here\n" });
  git(f.repo, "fetch", "-q"); // so even the remote-tracking ref is already where the pull will leave it
  const before = { at: head(f.repo), status: status(f.repo), index: await readFile(join(f.repo, ".git", "index")), files: await fingerprint(join(f.repo, "openspec")) };

  const refused = await pull(f);
  expect(refused.resolvable).toBeDefined();
  expect([head(f.repo), status(f.repo)]).toEqual([before.at, before.status]);
  expect(Buffer.compare(before.index, await readFile(join(f.repo, ".git", "index")))).toBe(0);
  expect(await fingerprint(join(f.repo, "openspec"))).toEqual(before.files);
  // …and nothing was written under the dashboard's home either: copies happen only on confirmation
  expect(existsSync(join(process.env.SPEC_CONTROL_HOME as string, "pull-backups"))).toBe(false);
});

test("a diverged refusal says where to reconcile and never mentions forcing", async () => {
  const f = await make();
  await remoteCommits(f, 1);
  await writeFile(join(f.repo, "local.txt"), "local\n");
  git(f.repo, "add", "-A");
  git(f.repo, "commit", "-q", "-m", "local work");
  const refused = await pull(f);
  expect(refused).toMatchObject({ update: "refused", hint: "Reconcile the local commits outside the dashboard, then pull again." });
  expect(refused.blocking).toBeUndefined();
  expect(`${refused.reason} ${refused.hint}`).not.toMatch(/force|--hard|discard|reset/i);
});
