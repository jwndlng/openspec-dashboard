import { lstat, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
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

/** Every file and directory under `root` with size, mtime and content hash — equal before and after means nothing was created, modified or deleted. */
export async function treeFingerprint(root: string): Promise<string> {
  const lines: string[] = [];
  const visit = async (dir: string): Promise<void> => {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = join(dir, entry.name);
      const info = await lstat(p);
      if (entry.isDirectory()) {
        lines.push(`d ${p} ${info.mtimeMs}`);
        await visit(p);
      } else {
        lines.push(`f ${p} ${info.size} ${info.mtimeMs} ${entry.isFile() ? Bun.hash(await readFile(p)) : "link"}`);
      }
    }
  };
  await visit(root);
  return lines.join("\n");
}
