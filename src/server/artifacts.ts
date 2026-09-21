// Artifact files of one change, for the detail view: which files exist, and the bounded, validated read of one of
// them. A request only ever contributes a change name and a relative path; the directory comes from `listChanges()`.
import { isAbsolute, join, normalize, relative, sep } from "node:path";
import type { ArtifactFileContent, ChangeArtifactEntry, ChangeArtifactFile, ChangeArtifacts } from "../shared/types.ts";
import { readChangeArtifacts } from "./openspecAdapter.ts";
import { parseMarker } from "./scanner.ts";
import { CHANGE_NAME, type ChangeDirEntry, type RepoSource } from "./source.ts";

export const MAX_ARTIFACT_BYTES = 1024 * 1024;

export type ChangeDirResult = { ok: true; entry: ChangeDirEntry } | { ok: false; reason: "invalid-name" | "unknown-change" };

/** Active changes win over archived ones of the same name; among archives the most recent. */
export async function changeDirFor(source: RepoSource, changeName: string): Promise<ChangeDirResult> {
  if (!CHANGE_NAME.test(changeName)) return { ok: false, reason: "invalid-name" };
  const { active, archived } = await source.listChanges();
  const entry = active.find((c) => c.name === changeName) ?? archived.find((c) => c.name === changeName);
  return entry ? { ok: true, entry } : { ok: false, reason: "unknown-change" };
}

function inside(dir: string, candidate: string): boolean {
  return candidate.startsWith(dir.endsWith(sep) ? dir : dir + sep);
}

export async function listArtifactFiles(source: RepoSource, repoId: string, entry: ChangeDirEntry): Promise<ChangeArtifacts> {
  const marker = parseMarker(await source.readText(join(entry.dir, ".openspec.yaml")));
  const projectSchema = parseMarker(await source.readText(join(source.path, "openspec", "config.yaml"))).schema;
  const change = { repoId, name: entry.name, dir: entry.dir, archived: Boolean(entry.archived) };
  let info: ReturnType<typeof readChangeArtifacts>;
  try {
    info = readChangeArtifacts(source.path, entry.name, { changeDir: entry.dir, schemaName: marker.schema ?? projectSchema, skipSpecs: marker.skipSpecs });
  } catch {
    // An unknown schema: the snapshot already carries the warning, and there is no artifact list to offer.
    return { change: { ...change, schema: marker.schema ?? projectSchema ?? "unknown" }, artifacts: [] };
  }

  // Glob outputs come back with symbolic links resolved (on macOS a temp dir is one), so paths are made relative
  // between real paths; that also leaves out a link that points out of the change directory.
  const realDir = (await source.readFileInfo(entry.dir))?.realPath ?? entry.dir;
  const artifacts: ChangeArtifactEntry[] = [];
  for (const artifact of info.artifacts) {
    const files: ChangeArtifactFile[] = [];
    for (const abs of info.outputs[artifact.id] ?? []) {
      const file = await source.readFileInfo(abs);
      if (!file?.isFile || !inside(realDir, file.realPath)) continue;
      files.push({ path: relative(realDir, file.realPath).split(sep).join("/"), bytes: file.size });
    }
    files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    artifacts.push({ ...artifact, files });
  }
  return { change: { ...change, schema: info.schema }, artifacts };
}

export type ArtifactFileResult =
  | { ok: true; file: ArtifactFileContent }
  | { ok: false; reason: "bad-path" | "not-found" | "too-large"; message: string };

/** design.md D2: string checks first, then containment of the real path, then the size cap — all before any content is read. */
export async function readArtifactFile(source: RepoSource, changeDir: string, path: string | null | undefined): Promise<ArtifactFileResult> {
  if (!path) return { ok: false, reason: "bad-path", message: "path is required" };
  if (path.includes("\0") || isAbsolute(path) || /^[A-Za-z]:/.test(path) || path.startsWith("\\")) return { ok: false, reason: "bad-path", message: "path must be relative to the change directory" };
  const normalized = normalize(path);
  if (normalized === ".." || normalized.startsWith(`..${sep}`) || normalized.startsWith("../")) return { ok: false, reason: "bad-path", message: "path escapes the change directory" };
  const candidate = join(changeDir, normalized);
  if (!inside(changeDir, candidate)) return { ok: false, reason: "bad-path", message: "path escapes the change directory" };

  const notFound: ArtifactFileResult = { ok: false, reason: "not-found", message: "no such file in this change" };
  const info = await source.readFileInfo(candidate);
  // The change directory itself may sit behind a link (a worktree, /tmp on macOS), so compare real paths on both sides.
  const realDir = (await source.readFileInfo(changeDir))?.realPath;
  if (!info || !realDir || !info.isFile || !inside(realDir, info.realPath)) return notFound;
  if (info.size > MAX_ARTIFACT_BYTES) return { ok: false, reason: "too-large", message: `file is larger than ${MAX_ARTIFACT_BYTES} bytes` };
  const text = await source.readText(info.realPath);
  if (text === undefined) return notFound;
  return { ok: true, file: { path: normalized.split(sep).join("/"), bytes: info.size, text } };
}
