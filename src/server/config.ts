import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute } from "node:path";
import { z } from "zod";
import { defaultAgentSessions } from "../shared/agentDefaults.ts";
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

// Anything that could switch off the agent CLI's permission checks must never come out of the config.
const BYPASS = /bypassPermissions|dangerously|skip-permissions|--permission-mode/i;
const noBypass = (value: string) => !BYPASS.test(value);

// Entries are joined with commas into a single CLI argument, so an entry may not contain one or look like a flag.
const allowedToolSchema = z
  .string()
  .trim()
  .min(1)
  .refine((v) => !v.includes(",") && !v.startsWith("-"), { message: "must be a single tool pattern" })
  .refine(noBypass, { message: "must not contain a permission-bypass mode or flag" });

const commandTemplateSchema = z
  .string()
  .trim()
  .min(1)
  .refine((v) => (v.match(/\{[^}]*\}/g) ?? []).every((p) => p === "{change}"), { message: "unknown placeholder; only {change} is supported" })
  .refine((v) => v.includes("{change}"), { message: "must contain {change}" })
  .refine(noBypass, { message: "must not contain a permission-bypass mode or flag" });


export { defaultAgentSessions };

const agentSessionsSchema = z
  .object({
    enabled: z.boolean().default(false),
    maxRunning: z.number().int().min(1).default(2),
    idleMinutes: z.number().int().min(1).default(30),
    claudePath: z.string().trim().min(1).refine(noBypass, { message: "must not contain a permission-bypass mode or flag" }).default("claude"),
    passApiKeyEnv: z.boolean().default(false),
    commands: z
      .object({ draft: commandTemplateSchema.default("/opsx:ff {change}"), implement: commandTemplateSchema.default("/opsx:apply {change}") })
      .default({}),
  })
  .default({});

const repoSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{12}$/),
  path: absolutePath,
  name: z.string().trim().min(1),
  enabled: z.boolean(),
  agent: z.object({ enabled: z.boolean(), allowedTools: z.array(allowedToolSchema).default([]) }).optional(),
});

export const configSchema = z
  .object({
    version: z.literal(1),
    scanRoots: scanRootsSchema,
    repos: z.array(repoSchema),
    pollIntervalSeconds: z.number().int().min(MIN_POLL_SECONDS),
    port: z.number().int().min(1024).max(65535),
    agentSessions: agentSessionsSchema,
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
  return { version: 1, scanRoots: [], repos: [], pollIntervalSeconds: DEFAULT_POLL_SECONDS, port: DEFAULT_PORT, agentSessions: defaultAgentSessions() };
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
