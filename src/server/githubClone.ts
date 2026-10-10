// Add from GitHub (openspec/specs/github-repositories): on the user's confirmation, one new folder directly inside a
// workspace root, made with an exclusive create under New project's placement rules (`newFolder.ts`), and `git clone`
// into it from a URL built here from a validated `owner/name` — never one taken from a request. This is the only place
// that runs `git clone`; it writes nothing into the clone, adds or changes no remote and configures nothing in it.
//
// The clone runs under the pull action's rules: git's own credentials, no terminal prompt, SSH in batch mode, no stdin,
// no hooks, no automatic maintenance, a timeout, and credentials masked in every reason. When it fails, the folder is
// removed only if git left it empty — a non-recursive `rmdir`, so nothing else can ever be deleted. Clones run in the
// background, at most two at a time; their outcomes live in memory until the dashboard restarts (never history,
// invariant 5) and are never an input to scanning, columns or actions.
import { mkdir, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { defaultCloneFolder, githubCloneUrl, parseGithubRepo } from "../shared/github.ts";
import type { GithubClone } from "../shared/types.ts";
import { REDIRECTING_GIT_ENV } from "./createProject.ts";
import { isSpecProject } from "./discover.ts";
import { checkNewFolder, makeNewFolder, NewFolderError } from "./newFolder.ts";
import { canonicalPath, dashboardHome, whichOnPath } from "./paths.ts";
import { reasonFrom } from "./pull.ts";

export const CLONE_TIMEOUT_MS = 10 * 60_000;
export const MAX_RUNNING_CLONES = 2;

const CREDENTIALS_HINT = "a private repository needs git credentials for github.com, for example through `gh auth setup-git`";

/** git's own words for "it would have needed credentials" — GitHub answers a private repository without them as "not found". */
function needsCredentials(stderr: string): boolean {
  return /authentication failed|could not read (username|password)|terminal prompts disabled|repository not found|permission denied|403/i.test(stderr);
}

/** What a failed clone reports: git's own reason, masked, and for a likely credentials problem what to do about it. */
export function cloneFailureReason(stderr: string): string {
  const reason = reasonFrom(stderr);
  return needsCredentials(stderr) ? `${reason} — ${CREDENTIALS_HINT}` : reason;
}

/** An empty directory under the home that `core.hooksPath` points at: no hook — not even a template's — can run. */
async function emptyHooksDir(): Promise<string> {
  const dir = join(dashboardHome(), "clone-hooks");
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * `git clone` of `repo` into the existing, empty `target`. Resolves to the masked reason on failure, `undefined` on
 * success. Its working directory is the dashboard home, so git never starts inside a repository.
 */
export async function cloneInto(repo: string, target: string, timeoutMs = CLONE_TIMEOUT_MS): Promise<string | undefined> {
  const home = dashboardHome();
  const hooks = await emptyHooksDir();
  const env: Record<string, string | undefined> = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" };
  for (const key of REDIRECTING_GIT_ENV) delete env[key];
  if (!env.GIT_SSH_COMMAND) env.GIT_SSH_COMMAND = "ssh -o BatchMode=yes";
  const argv = ["git", "-c", `core.hooksPath=${hooks}`, "-c", "maintenance.auto=false", "-c", "gc.auto=0", "clone", "--no-recurse-submodules", "--origin", "origin", "--", githubCloneUrl(repo), target];
  let timedOut = false;
  try {
    const proc = Bun.spawn(argv, { cwd: home, stdout: "ignore", stderr: "pipe", stdin: "ignore", env });
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, timeoutMs);
    try {
      // The exit decides, not the pipe: a transport helper git started could outlive a killed git and hold it open.
      const code = await proc.exited;
      if (timedOut) return `the clone did not finish within ${Math.round(timeoutMs / 60_000) || 1} minutes`;
      if (code === 0) return undefined;
      return cloneFailureReason(await new Response(proc.stderr).text());
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/** The part of the app clones need. `AppState` satisfies it through `api.ts`'s wiring. */
export interface CloneContext {
  config: () => Parameters<typeof checkNewFolder>[0];
  /** Adds a clone holding the project marker through the serialised track path; resolves to whether it was added. */
  track: (path: string) => Promise<boolean>;
}

/** A failed clone's entry, kept so it can be shown, retried and dismissed. */
interface Job extends GithubClone {
  done?: Promise<void>;
}

/**
 * The clones started since the dashboard started. `start` checks everything first, so a refusal creates nothing and
 * starts no process; the folder exists by the time it returns, and git runs once one of the two slots is free.
 */
export class GithubClones {
  private readonly jobs: Job[] = [];
  private running = 0;
  private readonly waiting: (() => void)[] = [];
  private nextId = 1;
  private readonly timeoutMs: number;
  private readonly maxRunning: number;
  private readonly now: () => number;

  constructor(
    private readonly context: CloneContext,
    options: { timeoutMs?: number; maxRunning?: number; now?: () => number } = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? CLONE_TIMEOUT_MS;
    this.maxRunning = options.maxRunning ?? MAX_RUNNING_CLONES;
    this.now = options.now ?? Date.now;
  }

  list(): GithubClone[] {
    return this.jobs.map(({ done: _, ...clone }) => ({ ...clone }));
  }

  /** Target folders of clones still running (or waiting for a slot): discovery leaves them out. */
  runningPaths(): string[] {
    return this.jobs.filter((j) => j.state === "cloning").map((j) => j.path);
  }

  /** Resolves once the clone has an outcome; tests wait on it. */
  settled(id: string): Promise<void> {
    return this.jobs.find((j) => j.id === id)?.done ?? Promise.resolve();
  }

  async start(input: { repo?: unknown; root?: unknown; name?: unknown }): Promise<GithubClone> {
    const parsed = parseGithubRepo(input.repo);
    if (!parsed.ok) throw new NewFolderError(400, parsed.reason);
    const name = input.name === undefined ? defaultCloneFolder(parsed.repo) : input.name;
    if (!whichOnPath("git")) throw new NewFolderError(503, "git was not found on this machine");
    const { root, path } = await checkNewFolder(this.context.config(), input.root, name);
    await makeNewFolder(path);

    // A retry is a new request for the same target: it replaces the failed entry rather than listing it twice.
    const previous = this.jobs.findIndex((j) => j.path === path && j.state !== "cloning");
    if (previous >= 0) this.jobs.splice(previous, 1);
    const job: Job = { id: `clone-${this.nextId++}`, repo: parsed.repo, root, name: name as string, path, state: "cloning", startedAt: new Date(this.now()).toISOString() };
    this.jobs.push(job);
    job.done = this.run(job);
    const { done: _, ...clone } = job;
    return { ...clone };
  }

  /** Drops a finished entry. `409` for a clone still running, `404` for an unknown id. */
  dismiss(id: unknown): void {
    const at = this.jobs.findIndex((j) => j.id === id);
    if (at < 0) throw new NewFolderError(404, "no such clone");
    if (this.jobs[at].state === "cloning") throw new NewFolderError(409, "the clone is still running");
    this.jobs.splice(at, 1);
  }

  private async slot(): Promise<void> {
    if (this.running < this.maxRunning) {
      this.running++;
      return;
    }
    // Handed over by `release` without decrementing, so no third clone can slip in between.
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.running--;
  }

  private async run(job: Job): Promise<void> {
    await this.slot();
    let failure: string | undefined;
    try {
      failure = await cloneInto(job.repo, job.path, this.timeoutMs);
    } finally {
      this.release();
    }
    if (failure) {
      // Non-recursive: succeeds only when git left the folder empty, and can never delete anything else.
      const removed = await rmdir(job.path).then(
        () => true,
        () => false,
      );
      this.finish(job, "failed", removed ? failure : `${failure} (the folder ${job.path} was left in place)`);
      return;
    }
    const folder = canonicalPath(job.path);
    const tracked =
      (await isSpecProject(folder)) &&
      (await this.context.track(folder).then(
        () => true,
        (err) => {
          console.warn(`could not track ${folder}:`, err instanceof Error ? err.message : err);
          return false;
        },
      ));
    this.finish(job, tracked ? "tracked" : "integratable");
  }

  private finish(job: Job, state: GithubClone["state"], reason?: string): void {
    job.state = state;
    if (reason) job.reason = reason;
    job.finishedAt = new Date(this.now()).toISOString();
  }
}
