// Where a repository's OpenSpec data comes from (design.md D3). v0 ships a
// local filesystem source; a remote source would implement the same interface.
import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import type { Worktree } from "../shared/types.ts";
import { currentBranch, isGitRepo, lastCommitDate, statusPaths, worktrees } from "./git.ts";

export const CHANGE_NAME = /^[A-Za-z0-9._-]+$/;
const ARCHIVE_PREFIX = /^(\d{4}-\d{2}-\d{2})-(.+)$/;
const CHANGES_DIR = "openspec/changes";
const ARCHIVE_DIR = "openspec/changes/archive";
const OPENSPEC_DIR = "openspec";

export interface ChangeDirEntry {
  name: string;
  /** Absolute directory of the change. */
  dir: string;
  /** ISO date when the entry lives under archive/. */
  archived?: string;
}

/** A file under `openspec/` that differs from HEAD; only these have a meaningful mtime (clean files get theirs from checkout). */
export interface DirtyFile {
  path: string;
  mtimeMs: number;
}

export interface ChangeListing {
  active: ChangeDirEntry[];
  archived: ChangeDirEntry[];
  warnings: string[];
}

export interface RepoSource {
  readonly path: string;
  exists(): Promise<boolean>;
  listChanges(): Promise<ChangeListing>;
  readText(absPath: string): Promise<string | undefined>;
  /** Names of the directories directly inside `absDir`; empty when it does not exist. */
  listDirs(absDir: string): Promise<string[]>;
  newestMtime(dir: string): Promise<string | undefined>;
  isGit(): Promise<boolean>;
  branch(): Promise<string | undefined>;
  worktrees(): Promise<Worktree[]>;
  /** Committer date of the last commit touching `absPath` inside the repo. */
  lastActivity(absPath: string): Promise<string | undefined>;
  /** Modified and untracked files under `openspec/`, per git. Empty for non-git repositories or on failure. */
  dirtyFiles(): Promise<DirtyFile[]>;
}

async function listDirs(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

export class LocalRepoSource implements RepoSource {
  constructor(readonly path: string) {}

  async exists(): Promise<boolean> {
    try {
      return (await stat(join(this.path, "openspec"))).isDirectory();
    } catch {
      return false;
    }
  }

  async listChanges(): Promise<ChangeListing> {
    const active: ChangeDirEntry[] = [];
    const archived: ChangeDirEntry[] = [];
    const warnings: string[] = [];
    const changesRoot = join(this.path, CHANGES_DIR);
    const archiveRoot = join(this.path, ARCHIVE_DIR);

    for (const name of await listDirs(changesRoot)) {
      if (name === "archive") continue;
      if (!CHANGE_NAME.test(name)) {
        warnings.push(`skipped change directory with unexpected name: ${JSON.stringify(name)}`);
        continue;
      }
      active.push({ name, dir: join(changesRoot, name) });
    }

    for (const dirName of await listDirs(archiveRoot)) {
      const dir = join(archiveRoot, dirName);
      const match = ARCHIVE_PREFIX.exec(dirName);
      const name = match ? match[2] : dirName;
      if (!CHANGE_NAME.test(name)) {
        warnings.push(`skipped archived directory with unexpected name: ${JSON.stringify(dirName)}`);
        continue;
      }
      const date = match ? match[1] : (await this.newestMtime(dir))?.slice(0, 10);
      archived.push({ name, dir, archived: date ?? "1970-01-01" });
    }
    archived.sort((a, b) => (b.archived ?? "").localeCompare(a.archived ?? ""));
    return { active, archived, warnings };
  }

  listDirs(absDir: string): Promise<string[]> {
    return listDirs(absDir);
  }

  async readText(absPath: string): Promise<string | undefined> {
    try {
      return await readFile(absPath, "utf8");
    } catch {
      return undefined;
    }
  }

  async newestMtime(dir: string): Promise<string | undefined> {
    let newest = 0;
    const visit = async (d: string): Promise<void> => {
      let entries: Dirent[];
      try {
        entries = await readdir(d, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const p = join(d, entry.name);
        if (entry.isDirectory()) {
          await visit(p);
        } else {
          try {
            newest = Math.max(newest, (await stat(p)).mtimeMs);
          } catch {
            // vanished between readdir and stat
          }
        }
      }
    };
    await visit(dir);
    return newest ? new Date(newest).toISOString() : undefined;
  }

  isGit(): Promise<boolean> {
    return isGitRepo(this.path);
  }

  branch(): Promise<string | undefined> {
    return currentBranch(this.path);
  }

  worktrees(): Promise<Worktree[]> {
    return worktrees(this.path);
  }

  lastActivity(absPath: string): Promise<string | undefined> {
    return lastCommitDate(this.path, relative(this.path, absPath));
  }

  async dirtyFiles(): Promise<DirtyFile[]> {
    const root = join(this.path, OPENSPEC_DIR);
    const result: DirtyFile[] = [];
    for (const entry of await statusPaths(this.path, OPENSPEC_DIR)) {
      // A deletion shows up as the mtime of the nearest directory that still exists.
      let p = entry.deleted ? dirname(entry.path) : entry.path;
      while (p.startsWith(root)) {
        try {
          result.push({ path: entry.path, mtimeMs: (await stat(p)).mtimeMs });
          break;
        } catch {
          p = dirname(p);
        }
      }
    }
    return result;
  }
}
