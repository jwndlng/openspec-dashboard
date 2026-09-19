import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { newRepoConfig } from "../src/server/config.ts";
import { findOpenSpecRepos, toCandidates } from "../src/server/discover.ts";
import { tempDir } from "./helpers.ts";

let root: string;

async function repoAt(...segments: string[]): Promise<string> {
  const dir = join(root, ...segments);
  await mkdir(join(dir, "openspec"), { recursive: true });
  await writeFile(join(dir, "openspec", "config.yaml"), "schema: spec-driven\n");
  return dir;
}

beforeAll(async () => {
  root = await tempDir();
  await repoAt("prvt", "alpha");
  await repoAt("acme", "beta");
  await repoAt("acme", "beta", "node_modules", "pkg"); // must be ignored
  await repoAt("deep", "a", "b", "c", "d", "too-deep"); // depth 6 > 4
  await repoAt("prvt", "alpha", "test", "fixtures", "nested"); // inside a repo: not its own project
  await repoAt("prvt", "alpha-wt"); // linked worktree: .git is a file
  await writeFile(join(root, "prvt", "alpha-wt", ".git"), "gitdir: /somewhere/.git/worktrees/alpha-wt\n");
});
afterAll(() => rm(root, { recursive: true, force: true }));

test("finds repos under multiple roots, skipping ignored dirs, nested repos, worktrees and depth limit", async () => {
  const { paths, errors } = await findOpenSpecRepos([join(root, "prvt"), join(root, "acme"), join(root, "deep")]);
  expect(errors).toEqual([]);
  expect(paths).toEqual([join(root, "acme", "beta"), join(root, "prvt", "alpha")]);
});

test("missing root is reported but other roots still scan", async () => {
  const { paths, errors } = await findOpenSpecRepos([join(root, "nope"), join(root, "prvt")]);
  expect(errors).toEqual([{ root: join(root, "nope"), message: "does not exist" }]);
  expect(paths).toEqual([join(root, "prvt", "alpha")]);
});

test("candidates exclude configured repos (enabled or not) and are untracked, sorted by path", () => {
  const enabled = { ...newRepoConfig("/w/alpha", true), name: "Alpha!" };
  const disabled = newRepoConfig("/w/beta", false);
  const candidates = toCandidates([enabled, disabled], ["/w/zeta", "/w/alpha", "/w/beta", "/w/gamma"]);
  expect(candidates).toEqual([newRepoConfig("/w/gamma", false), newRepoConfig("/w/zeta", false)]);
  expect(candidates[0]).toMatchObject({ name: "gamma", enabled: false });
});
