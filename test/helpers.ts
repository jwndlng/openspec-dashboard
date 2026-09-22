import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const FIXTURES = join(import.meta.dir, "fixtures");

/** Points OPENSPEC_DASHBOARD_HOME at a fresh temp dir for the duration of a test file. */
export async function useTempHome(): Promise<{ home: string; cleanup: () => Promise<void> }> {
  const home = await mkdtemp(join(tmpdir(), "osd-home-"));
  const previous = process.env.OPENSPEC_DASHBOARD_HOME;
  process.env.OPENSPEC_DASHBOARD_HOME = home;
  return {
    home,
    cleanup: async () => {
      if (previous === undefined) delete process.env.OPENSPEC_DASHBOARD_HOME;
      else process.env.OPENSPEC_DASHBOARD_HOME = previous;
      await rm(home, { recursive: true, force: true });
    },
  };
}

export async function tempDir(prefix = "osd-"): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

/** True for strings that contain something shaped like a real user's home directory (the demo's /home/demo is allowed). */
export function looksLikeRealHome(text: string): boolean {
  return /\/Users\/[^/\s"']+/.test(text) || /\/home\/(?!demo(?:\/|\b))[^/\s"']+/.test(text) || /[A-Za-z]:\\+Users\\+[^\\\s"']+/.test(text);
}

/** Runs git for test setup with a fixed identity and date; throws with git's message on failure. */
export async function gitIn(cwd: string, ...args: string[]): Promise<void> {
  const date = "2026-03-01T10:00:00+01:00";
  const proc = Bun.spawn(["git", "-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main", ...args], {
    cwd,
    stdout: "ignore",
    stderr: "pipe",
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
  });
  if ((await proc.exited) !== 0) throw new Error(`git ${args.join(" ")}: ${await new Response(proc.stderr).text()}`);
}
