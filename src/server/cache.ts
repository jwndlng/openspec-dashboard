import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { deriveStage } from "../shared/columns.ts";
import type { Snapshot } from "../shared/types.ts";
import { cachePath } from "./paths.ts";

export function emptySnapshot(): Snapshot {
  return { generatedAt: new Date().toISOString(), repos: [] };
}

/**
 * Returns the cached snapshot, or null when missing or unreadable. Stage and column are re-derived with today's rules,
 * so a cache written by a version with other columns is not taken for changes that moved (activity-feed).
 */
export async function readSnapshot(): Promise<Snapshot | null> {
  try {
    const raw = await readFile(cachePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<Snapshot>;
    if (typeof parsed.generatedAt !== "string" || !Array.isArray(parsed.repos)) return null;
    return rederive(parsed as Snapshot);
  } catch {
    return null;
  }
}

export function rederive(snapshot: Snapshot): Snapshot {
  const repos = snapshot.repos.map((repo) => ({
    ...repo,
    changes: repo.changes.map((c) => ({ ...c, ...deriveStage({ archived: Boolean(c.archived), artifacts: c.artifacts ?? [], tasks: c.tasks ?? null }) })),
  }));
  return { ...snapshot, repos };
}

export async function writeSnapshot(snapshot: Snapshot): Promise<void> {
  const path = cachePath();
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(snapshot), "utf8");
  await rename(tmp, path);
}
