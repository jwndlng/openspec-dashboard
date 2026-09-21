// Temporary git repositories with a local bare "remote": everything the pull tests need, with no network.
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tempDir } from "./helpers.ts";

export function git(cwd: string, ...args: string[]): string {
  const proc = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main", "-c", "protocol.file.allow=always", ...args], {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  if (proc.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${proc.stderr.toString()}`);
  return proc.stdout.toString().trim();
}

export interface Fixture {
  base: string;
  /** The bare repository playing the remote. */
  remote: string;
  /** The tracked repository: a clone with `openspec/` in it, on `main`, level with the remote. */
  repo: string;
  /** A second clone, used to put new commits on the remote. */
  other: string;
}

/** `defaultName`: the branch the remote's HEAD points to. */
export async function fixture(defaultName = "main"): Promise<Fixture> {
  const base = await realpath(await tempDir("osd-pull-"));
  const remote = join(base, "remote.git");
  const seed = join(base, "seed");
  await mkdir(join(seed, "openspec", "changes"), { recursive: true });
  await writeFile(join(seed, "openspec", "config.yaml"), "schema: spec-driven\n");
  await writeFile(join(seed, "openspec", "changes", ".gitkeep"), "");
  await writeFile(join(seed, "app.txt"), "one\n");
  await writeFile(join(seed, "notes.txt"), "notes\n");
  git(base, "init", "-q", "--bare", "-b", defaultName, remote);
  git(seed, "init", "-q", "-b", defaultName);
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "init");
  git(seed, "push", "-q", remote, defaultName);
  const repo = join(base, "alpha-infra");
  const other = join(base, "other");
  git(base, "clone", "-q", remote, repo);
  git(base, "clone", "-q", remote, other);
  return { base, remote, repo, other };
}

/** Adds `count` commits to the remote's default branch, each changing `file`. */
export async function remoteCommits(f: Fixture, count: number, file = "app.txt"): Promise<void> {
  git(f.other, "pull", "-q", "--ff-only");
  for (let i = 0; i < count; i++) {
    await writeFile(join(f.other, file), `${file} remote change ${Date.now()}-${i}-${Math.random()}\n`, { flag: "a" });
    git(f.other, "commit", "-q", "-am", `remote ${i}`);
  }
  git(f.other, "push", "-q");
}
