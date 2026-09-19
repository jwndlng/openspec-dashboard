import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Snapshot } from "../shared/types.ts";
import { cachePath } from "./paths.ts";

export function emptySnapshot(): Snapshot {
  return { generatedAt: new Date().toISOString(), repos: [] };
}

/** Returns the cached snapshot, or null when missing or unreadable. */
export async function readSnapshot(): Promise<Snapshot | null> {
  try {
    const raw = await readFile(cachePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<Snapshot>;
    if (typeof parsed.generatedAt !== "string" || !Array.isArray(parsed.repos)) return null;
    return parsed as Snapshot;
  } catch {
    return null;
  }
}

export async function writeSnapshot(snapshot: Snapshot): Promise<void> {
  const path = cachePath();
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(snapshot), "utf8");
  await rename(tmp, path);
}
