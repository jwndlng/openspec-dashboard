// Clones from github.com without the network: git's own `url.<base>.insteadOf`, set through `GIT_CONFIG_COUNT`, sends
// `https://github.com/<owner>/<name>.git` to a local bare repository, so the dashboard's real clone code runs against
// made-up repositories. One repository, `acme/slow-repo`, is sent to a transport that never answers, for timeouts.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gitIn, tempDir } from "./helpers.ts";

export interface GithubRedirect {
  /** Where the bare repositories live: `<base>/<owner>/<name>.git`. */
  base: string;
  /** `owner/name` whose clone hangs until it is killed. */
  slowRepo: string;
  /** Creates a bare repository with one commit on `main`; with `openspec`, a tracked OpenSpec project with one change. */
  repo(repo: string, options: { openspec: boolean }): Promise<string>;
  restore(): void;
}

const KEYS = ["GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0", "GIT_CONFIG_KEY_1", "GIT_CONFIG_VALUE_1", "GIT_CONFIG_KEY_2", "GIT_CONFIG_VALUE_2"];

export async function redirectGithub(): Promise<GithubRedirect> {
  const base = await tempDir("osd-github-");
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  const slowRepo = "acme/slow-repo";
  Object.assign(process.env, {
    GIT_CONFIG_COUNT: "3",
    GIT_CONFIG_KEY_0: `url.file://${base}/.insteadOf`,
    GIT_CONFIG_VALUE_0: "https://github.com/",
    // Longer than the one above, so it wins for this repository: a "remote" that sleeps instead of answering.
    GIT_CONFIG_KEY_1: "url.ext::sh -c sleep% 10 #.insteadOf",
    GIT_CONFIG_VALUE_1: `https://github.com/${slowRepo}`,
    GIT_CONFIG_KEY_2: "protocol.ext.allow",
    GIT_CONFIG_VALUE_2: "always",
  });
  return {
    base,
    slowRepo,
    repo: async (repo, { openspec }) => {
      const work = await tempDir("osd-github-work-");
      await writeFile(join(work, "README.md"), `# ${repo.split("/")[1]}\n`);
      if (openspec) {
        await mkdir(join(work, "openspec", "changes", "add-login"), { recursive: true });
        await writeFile(join(work, "openspec", "config.yaml"), "schema: spec-driven\n");
        await writeFile(join(work, "openspec", "changes", "add-login", "proposal.md"), "# Add login\n\n## Why\n\nSo people can sign in.\n");
      }
      await gitIn(work, "init", "-q", "-b", "main");
      await gitIn(work, "add", "-A");
      await gitIn(work, "commit", "-q", "-m", "init");
      const bare = join(base, `${repo}.git`);
      await mkdir(join(base, repo.split("/")[0]), { recursive: true });
      await gitIn(base, "clone", "-q", "--bare", work, bare);
      return bare;
    },
    restore: () => {
      for (const key of KEYS) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
      }
    },
  };
}
