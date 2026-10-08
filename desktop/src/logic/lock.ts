// One app at a time (design D3). Electrobun has no single-instance lock, and LaunchServices misses a second copy of
// the bundle or a launch from a terminal, so the app holds `<home>/desktop/app.lock`, created exclusively and holding
// its PID. A lock whose PID no longer runs is stale and taken over.
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type LockResult = { kind: "acquired"; release: () => Promise<void> } | { kind: "held"; pid: number };

export function lockPath(home: string): string {
  return join(home, "desktop", "app.lock");
}

export function pidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: it runs, as someone else.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function readPid(path: string): Promise<number | undefined> {
  try {
    const pid = Number((await readFile(path, "utf8")).trim());
    return Number.isInteger(pid) ? pid : undefined;
  } catch {
    return undefined;
  }
}

export async function acquireLock(home: string, pid = process.pid): Promise<LockResult> {
  const path = lockPath(home);
  await mkdir(join(home, "desktop"), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await writeFile(path, `${pid}\n`, { flag: "wx", mode: 0o600 });
      return {
        kind: "acquired",
        // Only our own lock: a later app may have taken over one we left behind.
        release: async () => {
          if ((await readPid(path)) === pid) await unlink(path).catch(() => undefined);
        },
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
    const holder = await readPid(path);
    if (holder !== undefined && holder !== pid && pidAlive(holder)) return { kind: "held", pid: holder };
    await unlink(path).catch(() => undefined); // stale: its app is gone
  }
  const holder = await readPid(path);
  return { kind: "held", pid: holder ?? 0 };
}
