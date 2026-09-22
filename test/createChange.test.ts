import { expect, test } from "bun:test";
import { chmod, readFile } from "node:fs/promises";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createChange, stageChangeDir } from "../src/server/createChange.ts";
import { tempDir } from "./helpers.ts";
import { git, tempGitRepo } from "./sessionHelpers.ts";

async function repoWithOpenspec(schema?: string): Promise<string> {
  const root = await tempDir();
  await mkdir(join(root, "openspec", "changes"), { recursive: true });
  if (schema !== undefined) await writeFile(join(root, "openspec", "config.yaml"), `schema: ${schema}\n`);
  return root;
}

/** `git status --porcelain --untracked-files=all`, lines sorted and untrimmed: the leading column is the index state. */
function porcelain(repo: string): string[] {
  const out = Bun.spawnSync(["git", "status", "--porcelain", "--untracked-files=all"], { cwd: repo, stdout: "pipe", stderr: "pipe" }).stdout.toString();
  return out.split("\n").filter((line) => line !== "").sort();
}

/** Runs `fn` with `git` resolving to a script that only sleeps, so the dashboard's invocation can time out. */
async function withHangingGit<T>(fn: () => Promise<T>): Promise<T> {
  const bin = await tempDir("osd-bin-");
  await writeFile(join(bin, "git"), "#!/bin/sh\nsleep 30\n");
  await chmod(join(bin, "git"), 0o755);
  const previous = process.env.PATH;
  process.env.PATH = bin;
  try {
    return await fn();
  } finally {
    process.env.PATH = previous;
  }
}

/** Runs `fn` with no `git` on the PATH at all. */
async function withoutGit<T>(fn: () => Promise<T>): Promise<T> {
  const previous = process.env.PATH;
  process.env.PATH = await tempDir("osd-bin-");
  try {
    return await fn();
  } finally {
    process.env.PATH = previous;
  }
}

test("creates a change directory with .openspec.yaml only when no prompt", async () => {
  const root = await repoWithOpenspec();
  const result = await createChange(root, "add-audit-trail");
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.wrotePrompt).toBe(false);
  expect(result.staged).toBe(false); // a plain temp directory is not a git repository
  const marker = await readFile(join(root, "openspec", "changes", "add-audit-trail", ".openspec.yaml"), "utf8");
  expect(marker).toMatch(/^schema: spec-driven\ncreated: \d{4}-\d{2}-\d{2}\n$/);
  await expect(readFile(join(root, "openspec", "changes", "add-audit-trail", "prompt.md"), "utf8")).rejects.toThrow();
});

test("writes prompt.md when a non-empty prompt is given", async () => {
  const root = await repoWithOpenspec();
  const result = await createChange(root, "add-audit-trail", "Log every mutation to the audit table");
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.wrotePrompt).toBe(true);
  const prompt = await readFile(join(root, "openspec", "changes", "add-audit-trail", "prompt.md"), "utf8");
  expect(prompt).toBe("# Prompt\n\nLog every mutation to the audit table\n");
});

test("skips prompt.md when the prompt is only whitespace", async () => {
  const root = await repoWithOpenspec();
  const result = await createChange(root, "add-audit-trail", "   \n\t\n  ");
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.wrotePrompt).toBe(false);
  await expect(readFile(join(root, "openspec", "changes", "add-audit-trail", "prompt.md"), "utf8")).rejects.toThrow();
});

test("reads schema from openspec/config.yaml and falls back to spec-driven", async () => {
  const withSchema = await repoWithOpenspec("alpha");
  const withResult = await createChange(withSchema, "one");
  expect(withResult.ok).toBe(true);
  const withMarker = await readFile(join(withSchema, "openspec", "changes", "one", ".openspec.yaml"), "utf8");
  expect(withMarker).toContain("schema: alpha");

  const withoutSchema = await repoWithOpenspec();
  const withoutResult = await createChange(withoutSchema, "two");
  expect(withoutResult.ok).toBe(true);
  const withoutMarker = await readFile(join(withoutSchema, "openspec", "changes", "two", ".openspec.yaml"), "utf8");
  expect(withoutMarker).toContain("schema: spec-driven");
});

test("rejects an invalid change name", async () => {
  const root = await repoWithOpenspec();
  for (const name of ["", "foo/bar", "with space", "with;semicolon", "with$dollar"]) {
    const result = await createChange(root, name);
    expect([name, result.ok]).toEqual([name, false]);
    if (result.ok) continue;
    expect([name, result.reason]).toEqual([name, "invalid-name"]);
  }
});

test("rejects a non-string prompt", async () => {
  const root = await repoWithOpenspec();
  const result = await createChange(root, "add-audit-trail", 123 as unknown as string);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.reason).toBe("invalid-prompt");
});

test("rejects when openspec/changes/ is missing", async () => {
  const root = await tempDir();
  const result = await createChange(root, "add-audit-trail");
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.reason).toBe("no-openspec-dir");
});

test("rejects a duplicate active name", async () => {
  const root = await repoWithOpenspec();
  await mkdir(join(root, "openspec", "changes", "add-audit-trail"), { recursive: true });
  const result = await createChange(root, "add-audit-trail");
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.reason).toBe("duplicate-active");
});

test("rejects a duplicate archived name (with and without date prefix)", async () => {
  const root = await repoWithOpenspec();
  await mkdir(join(root, "openspec", "changes", "archive", "2026-06-18-old-thing"), { recursive: true });
  const dated = await createChange(root, "old-thing");
  expect(dated.ok).toBe(false);
  if (!dated.ok) expect(dated.reason).toBe("duplicate-archived");

  await mkdir(join(root, "openspec", "changes", "archive", "no-prefix"), { recursive: true });
  const undated = await createChange(root, "no-prefix");
  expect(undated.ok).toBe(false);
  if (!undated.ok) expect(undated.reason).toBe("duplicate-archived");
});

test("concurrent createChange for the same name: exactly one wins", async () => {
  const root = await repoWithOpenspec();
  const results = await Promise.all(Array.from({ length: 10 }, () => createChange(root, "race")));
  const wins = results.filter((r) => r.ok);
  const losses = results.filter((r) => !r.ok);
  expect(wins.length).toBe(1);
  expect(losses.length).toBe(9);
  for (const l of losses) if (!l.ok) expect(l.reason).toBe("duplicate-active");
  const entries = readdirSync(join(root, "openspec", "changes", "race"));
  expect(entries.sort()).toEqual([".openspec.yaml"]);
});

test("createChange's only subprocess is one `git add -- <dir>` (static check)", () => {
  const src = readFileSync(join(import.meta.dir, "..", "src", "server", "createChange.ts"), "utf8");
  for (const forbidden of ["child_process", "execSync", "execFile", "execFileSync", "Bun.$", "Bun.spawnSync"]) {
    expect([forbidden, src.includes(forbidden)]).toEqual([forbidden, false]);
  }
  expect(src.match(/Bun\.spawn\(/g)?.length).toBe(1);
  expect(src.match(/git\(repoPath, \[/g)?.length).toBe(1);
  expect(src).toMatch(/\["add", "--", `openspec\/changes\/\$\{name\}\/`\]/);
  for (const forbidden of ['"commit"', '"push"', '"stash"', '"reset"', '"checkout"', '"switch"', '"-A"', '"--all"', '"-p"', "-u"]) {
    expect([forbidden, src.includes(forbidden)]).toEqual([forbidden, false]);
  }
});

// --- Staging: `git add -- openspec/changes/<name>/` after the writes, best-effort, scoped to that directory ---

test("stageChangeDir returns false for a directory that is not a git repository and does not reject", async () => {
  const root = await repoWithOpenspec();
  await mkdir(join(root, "openspec", "changes", "plain"));
  await expect(stageChangeDir(root, "plain")).resolves.toBe(false);
  await expect(stageChangeDir(root, "does-not-exist")).resolves.toBe(false);
});

test("a change created in a git repository is staged: `A ` in git status, not `??`", async () => {
  const repo = await tempGitRepo();
  const result = await createChange(repo, "add-audit-trail", "Log every mutation");
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.staged).toBe(true);
  expect(porcelain(repo)).toEqual([
    "A  openspec/changes/add-audit-trail/.openspec.yaml",
    "A  openspec/changes/add-audit-trail/prompt.md",
  ]);
});

test("a change created outside any git repository is still created, with staged false", async () => {
  const root = await repoWithOpenspec();
  const result = await createChange(root, "add-audit-trail", "Log every mutation");
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.staged).toBe(false);
  expect(readdirSync(join(root, "openspec", "changes", "add-audit-trail")).sort()).toEqual([".openspec.yaml", "prompt.md"]);
});

test("a missing git binary leaves the change in place with staged false", async () => {
  const repo = await tempGitRepo();
  const result = await withoutGit(() => createChange(repo, "add-audit-trail", "Log every mutation"));
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.staged).toBe(false);
  expect(readdirSync(join(repo, "openspec", "changes", "add-audit-trail")).sort()).toEqual([".openspec.yaml", "prompt.md"]);
  expect(git(repo, "status", "--porcelain")).toContain("?? openspec/changes/add-audit-trail/");
});

test("a git add that hangs is killed after the timeout: staged false, change still on disk", async () => {
  const repo = await tempGitRepo();
  await mkdir(join(repo, "openspec", "changes", "slow"));
  await writeFile(join(repo, "openspec", "changes", "slow", ".openspec.yaml"), "schema: spec-driven\ncreated: 2026-09-22\n");
  const started = Date.now();
  const staged = await withHangingGit(() => stageChangeDir(repo, "slow", 300));
  expect(staged).toBe(false);
  expect(Date.now() - started).toBeLessThan(10_000);
  expect(readdirSync(join(repo, "openspec", "changes", "slow"))).toEqual([".openspec.yaml"]);
  expect(git(repo, "status", "--porcelain")).toContain("?? openspec/changes/slow/");
});

test("only the new directory is staged; unrelated dirty and untracked files, HEAD, the branch and the refs are untouched", async () => {
  const repo = await tempGitRepo();
  await writeFile(join(repo, "openspec", "config.yaml"), "schema: spec-driven\n# edited locally, not staged\n");
  await writeFile(join(repo, "scratch.txt"), "untracked and staying that way\n");
  const before = {
    head: git(repo, "rev-parse", "HEAD"),
    branch: git(repo, "symbolic-ref", "HEAD"),
    refs: git(repo, "for-each-ref"),
  };
  expect(porcelain(repo)).toEqual([" M openspec/config.yaml", "?? scratch.txt"]);

  const result = await createChange(repo, "add-audit-trail");
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.staged).toBe(true);

  expect(porcelain(repo)).toEqual([" M openspec/config.yaml", "?? scratch.txt", "A  openspec/changes/add-audit-trail/.openspec.yaml"]);
  expect(git(repo, "diff", "--cached", "--name-only").split("\n")).toEqual(["openspec/changes/add-audit-trail/.openspec.yaml"]);
  expect(git(repo, "rev-parse", "HEAD")).toBe(before.head);
  expect(git(repo, "symbolic-ref", "HEAD")).toBe(before.branch);
  expect(git(repo, "for-each-ref")).toBe(before.refs);
  expect(git(repo, "rev-list", "--all", "--count")).toBe("1");
});

test("a refused create runs no git: the index is byte-for-byte unchanged", async () => {
  const repo = await tempGitRepo();
  await mkdir(join(repo, "openspec", "changes", "taken"));
  const indexBefore = readFileSync(join(repo, ".git", "index"));
  for (const [name, reason] of [["taken", "duplicate-active"], ["foo/bar", "invalid-name"]] as const) {
    const result = await withoutGit(() => createChange(repo, name));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe(reason);
  }
  expect(readFileSync(join(repo, ".git", "index")).equals(indexBefore)).toBe(true);
  expect(porcelain(repo)).toEqual([]);
});
