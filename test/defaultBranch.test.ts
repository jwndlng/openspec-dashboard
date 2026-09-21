import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { newRepoConfig } from "../src/server/config.ts";
import { scanRepo } from "../src/server/scanner.ts";
import { LocalRepoSource } from "../src/server/source.ts";
import { tempDir, useTempHome } from "./helpers.ts";
import { fixture, git } from "./pullHelpers.ts";

// These tests create git repositories, run real git against local remotes and wait on deliberately slow fake remotes;
// slow CI runners need more than the 5 s default.
setDefaultTimeout(60_000);

let cleanup: () => Promise<void>;
const bases: string[] = [];
beforeAll(async () => {
  ({ cleanup } = await useTempHome());
});
afterAll(async () => {
  for (const b of bases) await rm(b, { recursive: true, force: true });
  await cleanup();
});

const scan = async (path: string) => {
  const snap = await scanRepo(newRepoConfig(path, true));
  return [snap.ok, snap.currentBranch, snap.defaultBranch, snap.onDefaultBranch];
};

test("default branch from origin/HEAD: on it, off it, detached, and when it is not called main", async () => {
  const f = await fixture();
  bases.push(f.base);
  expect(await scan(f.repo)).toEqual([true, "main", "main", true]);
  git(f.repo, "checkout", "-q", "-b", "feat/redesign");
  expect(await scan(f.repo)).toEqual([true, "feat/redesign", "main", false]);
  git(f.repo, "checkout", "-q", "--detach");
  expect(await scan(f.repo)).toEqual([true, undefined, "main", false]);

  const trunk = await fixture("trunk");
  bases.push(trunk.base);
  expect(await scan(trunk.repo)).toEqual([true, "trunk", "trunk", true]);
});

test("without origin/HEAD: main, then master, then nothing is claimed", async () => {
  const make = async (branch: string) => {
    const root = join(await tempDir("osd-default-"), "demo-ops");
    bases.push(join(root, ".."));
    await mkdir(join(root, "openspec", "changes"), { recursive: true });
    await writeFile(join(root, "openspec", "config.yaml"), "schema: spec-driven\n");
    git(root, "init", "-q", "-b", branch);
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "init");
    return root;
  };
  const onMaster = await make("master");
  git(onMaster, "checkout", "-q", "-b", "develop");
  expect(await scan(onMaster)).toEqual([true, "develop", "master", false]);

  const both = await make("master");
  git(both, "branch", "main");
  expect(await scan(both)).toEqual([true, "master", "main", false]); // main wins over master

  const neither = await make("develop");
  expect(await scan(neither)).toEqual([true, "develop", undefined, undefined]);
});

test("a failing lookup does not fail the scan, and a non-git repository reports nothing", async () => {
  const f = await fixture();
  bases.push(f.base);
  class Broken extends LocalRepoSource {
    override defaultBranch(): Promise<string | undefined> {
      return Promise.reject(new Error("git exploded"));
    }
  }
  const snap = await scanRepo(newRepoConfig(f.repo, true), new Broken(f.repo));
  expect([snap.ok, snap.defaultBranch, snap.onDefaultBranch]).toEqual([true, undefined, undefined]);

  const plain = join(await tempDir("osd-plain-"), "plain");
  bases.push(join(plain, ".."));
  await mkdir(join(plain, "openspec", "changes"), { recursive: true });
  const plainSnap = await scanRepo(newRepoConfig(plain, true));
  if (!plainSnap.isGit) expect([plainSnap.defaultBranch, plainSnap.onDefaultBranch]).toEqual([undefined, undefined]);
});
