import { afterAll, afterEach, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync } from "node:fs";
import { chmod, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultConfig, newRepoConfig } from "../src/server/config.ts";
import { cloneFailureReason, GithubClones } from "../src/server/githubClone.ts";
import { confirmIntegration } from "../src/server/integration.ts";
import { NewFolderError } from "../src/server/newFolder.ts";
import type { Config } from "../src/shared/types.ts";
import { gitIn, tempDir, useTempHome } from "./helpers.ts";
import { redirectGithub, type GithubRedirect } from "./githubHelpers.ts";

setDefaultTimeout(30_000);

let cleanupHome: () => Promise<void>;
let github: GithubRedirect;

beforeAll(async () => {
  cleanupHome = (await useTempHome()).cleanup;
  github = await redirectGithub();
  await github.repo("acme/beta-soc", { openspec: true });
  await github.repo("acme/chat-groups", { openspec: false });
});
afterEach(() => {
  delete process.env.GIT_TEMPLATE_DIR;
});
afterAll(async () => {
  github.restore();
  await cleanupHome();
});

interface Harness {
  config: Config;
  root: string;
  clones: GithubClones;
  scans: number;
}

async function harness(options: { maxRunning?: number; timeoutMs?: number; repos?: Config["repos"] } = {}): Promise<Harness> {
  const root = await tempDir("osd-clone-root-");
  const h = { config: { ...defaultConfig(), scanRoots: [root], repos: options.repos ?? [] }, root, scans: 0 } as Harness;
  const app = {
    get config() {
      return h.config;
    },
    set config(value: Config) {
      h.config = value;
    },
    scanner: {
      trigger: () => {
        h.scans++;
        return { started: true };
      },
    },
  };
  h.clones = new GithubClones({ config: () => h.config, track: (path) => confirmIntegration(app, path) }, { maxRunning: options.maxRunning, timeoutMs: options.timeoutMs });
  return h;
}

const git = async (cwd: string, ...args: string[]) => {
  const proc = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return out.trim();
};

test("a clone is a full checkout of the default branch with origin pointing at github.com", async () => {
  const h = await harness();
  const clone = await h.clones.start({ repo: "acme/beta-soc", root: h.root, name: "beta-soc" });
  expect(clone.state).toBe("cloning");
  expect(clone.path).toBe(join(h.root, "beta-soc"));
  expect(h.clones.runningPaths()).toEqual([clone.path]);
  await h.clones.settled(clone.id);
  const [done] = h.clones.list();
  expect(done.state).toBe("tracked");
  expect(done.finishedAt).toBeDefined();
  expect(h.clones.runningPaths()).toEqual([]);
  expect(await git(clone.path, "config", "--get", "remote.origin.url")).toBe("https://github.com/acme/beta-soc.git");
  expect(await git(clone.path, "rev-parse", "--abbrev-ref", "HEAD")).toBe("main");
  expect(await git(clone.path, "status", "--porcelain")).toBe("");
  expect(existsSync(join(clone.path, "openspec", "config.yaml"))).toBe(true);
  expect(await readdir(h.root)).toEqual(["beta-soc"]);
});

test("a clone holding openspec/config.yaml is tracked enabled with its default name, and a scan starts", async () => {
  const h = await harness();
  const clone = await h.clones.start({ repo: "acme/beta-soc", root: h.root, name: "beta-soc" });
  await h.clones.settled(clone.id);
  expect(h.config.repos.map((r) => [r.path, r.name, r.enabled])).toEqual([[clone.path, "beta-soc", true]]);
  expect(h.scans).toBe(1);
});

test("a clone without the marker leaves the configuration alone", async () => {
  const h = await harness();
  const before = JSON.stringify(h.config);
  const clone = await h.clones.start({ repo: "acme/chat-groups", root: h.root, name: "chat-groups" });
  await h.clones.settled(clone.id);
  expect(h.clones.list()[0].state).toBe("integratable");
  expect(JSON.stringify(h.config)).toBe(before);
  expect(h.scans).toBe(0);
});

test("a name already tracked gets the parent folder in parentheses", async () => {
  const other = await tempDir("osd-other-");
  const h = await harness({ repos: [{ ...newRepoConfig(join(other, "beta-soc"), true), name: "beta-soc" }] });
  const clone = await h.clones.start({ repo: "acme/beta-soc", root: h.root, name: "beta-soc" });
  await h.clones.settled(clone.id);
  const added = h.config.repos.find((r) => r.path === clone.path);
  expect(added?.name).toBe(`beta-soc (${h.root.split("/").at(-1)})`);
});

test("a failed clone removes the empty folder and reports a masked reason with the credentials hint", async () => {
  const h = await harness();
  const clone = await h.clones.start({ repo: "acme/missing-repo", root: h.root, name: "missing-repo" });
  await h.clones.settled(clone.id);
  const [failed] = h.clones.list();
  expect(failed.state).toBe("failed");
  expect(failed.reason).toBeTruthy();
  expect(existsSync(clone.path)).toBe(false);
  expect(await readdir(h.root)).toEqual([]);
  expect(h.config.repos).toEqual([]);
});

test("the credentials hint names gh auth setup-git and no secret reaches the reason", () => {
  const notFound = cloneFailureReason("Cloning into '/w/acme/beta-soc'...\nremote: Repository not found.\nfatal: repository 'https://github.com/acme/beta-soc.git/' not found\n");
  expect(notFound).toContain("gh auth setup-git");
  const prompt = cloneFailureReason("fatal: could not read Username for 'https://github.com': terminal prompts disabled\n");
  expect(prompt).toContain("gh auth setup-git");
  const masked = cloneFailureReason("fatal: unable to access 'https://jdoe:ghp_secret123@github.com/acme/beta-soc.git/': Could not resolve host: github.com\n");
  expect(masked).not.toContain("ghp_secret123");
  expect(masked).not.toContain("gh auth setup-git");
});

test("a clone that runs too long is stopped and its folder removed", async () => {
  const h = await harness({ timeoutMs: 500 });
  const clone = await h.clones.start({ repo: github.slowRepo, root: h.root, name: "slow" });
  await h.clones.settled(clone.id);
  const [failed] = h.clones.list();
  expect(failed.state).toBe("failed");
  expect(failed.reason).toContain("did not finish");
  expect(existsSync(clone.path)).toBe(false);
});

test("a hook from the git template directory does not run", async () => {
  const template = await tempDir("osd-template-");
  const marker = join(template, "hook-ran");
  await mkdir(join(template, "hooks"));
  await writeFile(join(template, "hooks", "post-checkout"), `#!/bin/sh\necho ran > ${JSON.stringify(marker)}\n`);
  await chmod(join(template, "hooks", "post-checkout"), 0o755);
  process.env.GIT_TEMPLATE_DIR = template;
  const h = await harness();
  const clone = await h.clones.start({ repo: "acme/chat-groups", root: h.root, name: "chat-groups" });
  await h.clones.settled(clone.id);
  expect(h.clones.list()[0].state).toBe("integratable");
  // The template was used — the hook was copied — yet never ran.
  expect(existsSync(join(clone.path, ".git", "hooks", "post-checkout"))).toBe(true);
  expect(existsSync(marker)).toBe(false);
});

test("two requests for one target make one clone and one folder", async () => {
  const h = await harness();
  const results = await Promise.allSettled([
    h.clones.start({ repo: "acme/beta-soc", root: h.root, name: "beta-soc" }),
    h.clones.start({ repo: "acme/beta-soc", root: h.root, name: "beta-soc" }),
  ]);
  const ok = results.filter((r) => r.status === "fulfilled");
  const refused = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  expect(ok).toHaveLength(1);
  expect(refused).toHaveLength(1);
  expect(refused[0].reason).toBeInstanceOf(NewFolderError);
  expect((refused[0].reason as NewFolderError).status).toBe(409);
  await h.clones.settled(h.clones.list()[0].id);
  expect(h.clones.list()).toHaveLength(1);
  expect(await readdir(h.root)).toEqual(["beta-soc"]);
});

test("a third clone waits while two run", async () => {
  const h = await harness({ maxRunning: 2, timeoutMs: 1500 });
  const first = await h.clones.start({ repo: github.slowRepo, root: h.root, name: "slow-1" });
  const second = await h.clones.start({ repo: github.slowRepo, root: h.root, name: "slow-2" });
  const third = await h.clones.start({ repo: "acme/chat-groups", root: h.root, name: "chat-groups" });
  // The third is listed as cloning and its folder exists, but git has not started: the folder stays empty.
  await Bun.sleep(700);
  expect(h.clones.list().find((c) => c.id === third.id)?.state).toBe("cloning");
  expect(await readdir(third.path)).toEqual([]);
  await h.clones.settled(first.id);
  await h.clones.settled(second.id);
  await h.clones.settled(third.id);
  expect(h.clones.list().map((c) => c.state)).toEqual(["failed", "failed", "integratable"]);
});

test("refusals create nothing; retry replaces the failed entry; only finished entries can be dismissed", async () => {
  const h = await harness();
  const refusal = async (input: Record<string, unknown>) => {
    const err = await h.clones.start(input).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(NewFolderError);
    return (err as NewFolderError).status;
  };
  expect(await refusal({ repo: "https://example.test/acme/beta-soc", root: h.root, name: "beta-soc" })).toBe(400);
  expect(await refusal({ repo: "acme/../../etc", root: h.root, name: "etc" })).toBe(400);
  expect(await refusal({ repo: "acme/beta-soc", root: h.root, name: "../x" })).toBe(400);
  expect(await refusal({ repo: "acme/beta-soc", root: "/w/other", name: "beta-soc" })).toBe(404);
  await mkdir(join(h.root, "taken"));
  expect(await refusal({ repo: "acme/beta-soc", root: h.root, name: "taken" })).toBe(409);
  expect(await readdir(h.root)).toEqual(["taken"]);
  expect(h.clones.list()).toEqual([]);

  const failed = await h.clones.start({ repo: "acme/later-repo", root: h.root, name: "later-repo" });
  await h.clones.settled(failed.id);
  await github.repo("acme/later-repo", { openspec: false });
  const retried = await h.clones.start({ repo: "acme/later-repo", root: h.root, name: "later-repo" });
  expect(h.clones.list().map((c) => c.id)).toEqual([retried.id]);
  expect(() => h.clones.dismiss(retried.id)).toThrow("still running");
  await h.clones.settled(retried.id);
  expect(h.clones.list()[0].state).toBe("integratable");
  h.clones.dismiss(retried.id);
  expect(h.clones.list()).toEqual([]);
  expect(() => h.clones.dismiss("clone-404")).toThrow("no such clone");
  // Dismissing forgets the entry, never the folder.
  expect(existsSync(join(h.root, "later-repo", ".git"))).toBe(true);
  expect(await readFile(join(h.root, "later-repo", "README.md"), "utf8")).toContain("later-repo");
});

test("clones write nothing but the target folder", async () => {
  const h = await harness();
  await mkdir(join(h.root, "neighbour"));
  await gitIn(join(h.root, "neighbour"), "init", "-q");
  const before = await readdir(join(h.root, "neighbour", ".git"));
  const clone = await h.clones.start({ repo: "acme/chat-groups", root: h.root, name: "chat-groups" });
  await h.clones.settled(clone.id);
  expect((await readdir(h.root)).sort()).toEqual(["chat-groups", "neighbour"]);
  expect(await readdir(join(h.root, "neighbour", ".git"))).toEqual(before);
});
