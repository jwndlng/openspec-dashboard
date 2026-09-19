import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute } from "node:path";
import { z } from "zod";
import type { Config, RepoConfig } from "../shared/types.ts";
import { configPath, dashboardHome, expandPath } from "./paths.ts";

export const DEFAULT_PORT = 4711;
export const DEFAULT_POLL_SECONDS = 60;
export const MIN_POLL_SECONDS = 10;

const absolutePath = z
  .string()
  .min(1)
  .transform(expandPath)
  .refine(isAbsolute, { message: "must be an absolute path" });

const scanRootsSchema = z.array(absolutePath);

const repoSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{12}$/),
  path: absolutePath,
  name: z.string().trim().min(1),
  enabled: z.boolean(),
});

export const configSchema = z
  .object({
    version: z.literal(1),
    scanRoots: scanRootsSchema,
    repos: z.array(repoSchema),
    pollIntervalSeconds: z.number().int().min(MIN_POLL_SECONDS),
    port: z.number().int().min(1024).max(65535),
  })
  .superRefine((cfg, ctx) => {
    const ids = new Set<string>();
    for (const [i, repo] of cfg.repos.entries()) {
      if (ids.has(repo.id)) {
        ctx.addIssue({ code: "custom", path: ["repos", i, "id"], message: `duplicate repo id ${repo.id}` });
      }
      ids.add(repo.id);
      if (repo.id !== repoId(repo.path)) {
        ctx.addIssue({ code: "custom", path: ["repos", i, "id"], message: "id does not match path" });
      }
    }
  });

export class ConfigValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`invalid config: ${issues.join("; ")}`);
  }
}

export function defaultConfig(): Config {
  return { version: 1, scanRoots: [], repos: [], pollIntervalSeconds: DEFAULT_POLL_SECONDS, port: DEFAULT_PORT };
}

/** Stable identity for a repository: 12 hex chars of the sha1 of its absolute path. */
export function repoId(path: string): string {
  return createHash("sha1").update(expandPath(path)).digest("hex").slice(0, 12);
}

export function repoNameFromPath(path: string): string {
  return basename(expandPath(path));
}

export function newRepoConfig(path: string, enabled = false): RepoConfig {
  const abs = expandPath(path);
  return { id: repoId(abs), path: abs, name: repoNameFromPath(abs), enabled };
}

export function validateConfig(input: unknown): Config {
  const result = configSchema.safeParse(input);
  if (!result.success) {
    throw new ConfigValidationError(result.error.issues.map((i) => `${i.path.join(".") || "config"}: ${i.message}`));
  }
  return result.data;
}

/** Same rule as `Config.scanRoots`: absolute after `~` expansion. Used for ad-hoc discovery roots. */
export function validateScanRoots(input: unknown): string[] {
  const result = scanRootsSchema.safeParse(input);
  if (!result.success) {
    throw new ConfigValidationError(result.error.issues.map((i) => `scanRoots${i.path.length ? `.${i.path.join(".")}` : ""}: ${i.message}`));
  }
  return result.data;
}

/** Writes via a temp file + rename so a crash never leaves a half-written config. */
async function writeAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, content, "utf8");
  await rename(tmp, path);
}

export async function saveConfig(config: Config): Promise<Config> {
  const valid = validateConfig(config);
  await writeAtomic(configPath(), `${JSON.stringify(valid, null, 2)}\n`);
  return valid;
}

/**
 * Loads the config, creating defaults on first run. A corrupt file is moved
 * aside (`config.json.bak-<ts>`) and replaced by defaults so the dashboard
 * still starts; the returned `warning` says so.
 */
export async function loadConfig(): Promise<{ config: Config; warning?: string }> {
  await mkdir(dashboardHome(), { recursive: true });
  const path = configPath();
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    const config = await saveConfig(defaultConfig());
    return { config };
  }
  try {
    return { config: validateConfig(JSON.parse(raw)) };
  } catch (err) {
    const backup = `${path}.bak-${Date.now()}`;
    await rename(path, backup);
    const config = await saveConfig(defaultConfig());
    const reason = err instanceof Error ? err.message : String(err);
    return { config, warning: `config.json was invalid (${reason}); moved to ${backup} and reset to defaults` };
  }
}
