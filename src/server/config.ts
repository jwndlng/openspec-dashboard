import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute } from "node:path";
import { z } from "zod";
import { defaultAgentSessions } from "../shared/agentDefaults.ts";
import type { Config, RepoConfig } from "../shared/types.ts";
import { canonicalPath, configPath, dashboardHome, expandPath } from "./paths.ts";

export const DEFAULT_PORT = 4711;
export const DEFAULT_POLL_SECONDS = 60;
export const MIN_POLL_SECONDS = 10;

const absolutePath = z
  .string()
  .min(1)
  .transform(canonicalPath)
  .refine(isAbsolute, { message: "must be an absolute path" });

const scanRootsSchema = z.array(absolutePath);
const ignorePathsSchema = z.array(absolutePath);

// A profile is the user's own command line, but the dashboard never helps switching off an agent's permission checks.
const BYPASS = /bypassPermissions|dangerously|skip-permissions|--yolo/i;
const noBypass = (value: string) => !BYPASS.test(value);
const BYPASS_MESSAGE = "must not contain a permission-bypass mode or flag";

const placeholdersOnly = (allowed: string[]) => (v: string) => (v.match(/\{[^}]*\}/g) ?? []).every((ph) => allowed.includes(ph));

const commandSchema = z
  .array(z.string().min(1).refine(noBypass, { message: BYPASS_MESSAGE }).refine(placeholdersOnly(["{prompt}"]), { message: "unknown placeholder; only {prompt} is supported" }))
  .min(1, { message: "command must name an executable" })
  .refine((args) => args.length === 0 || !args[0].includes("{"), { message: "the executable cannot be a placeholder" });

const promptSchema = z
  .string()
  .trim()
  .min(1)
  .refine(placeholdersOnly(["{change}"]), { message: "unknown placeholder; only {change} is supported" })
  .refine((v) => v.includes("{change}"), { message: "must contain {change}" })
  .refine(noBypass, { message: BYPASS_MESSAGE });

// Ship is plain language about the worktree the agent already sits in, so it does not have to name the change.
const shipPromptSchema = z
  .string()
  .trim()
  .min(1)
  .refine(placeholdersOnly(["{change}"]), { message: "unknown placeholder; only {change} is supported" })
  .refine(noBypass, { message: BYPASS_MESSAGE });

const agentProfileSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/, { message: "lower-case letters, digits and dashes" }),
  name: z.string().trim().min(1),
  command: commandSchema,
  prompts: z.object({ draft: promptSchema.optional(), implement: promptSchema.optional(), archive: promptSchema.optional(), ship: shipPromptSchema.optional() }).default({}),
  resumeCommand: z.array(z.string().min(1).refine(noBypass, { message: BYPASS_MESSAGE })).min(1).optional(),
  unsetEnv: z.array(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/)).optional(),
});

// Older configs carried Claude-specific keys here (claudePath, commands, allowedTools, …); unknown keys are dropped.
export { defaultAgentSessions };

const agentSessionsSchema = z
  .object({
    enabled: z.boolean().default(false),
    agents: z.array(agentProfileSchema).min(1).default(() => defaultAgentSessions().agents),
    defaultAgent: z.string().default(() => defaultAgentSessions().defaultAgent),
  })
  .default({})
  .superRefine((cfg, ctx) => {
    const ids = cfg.agents.map((a) => a.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["agents"], message: "agent ids must be unique" });
    if (!ids.includes(cfg.defaultAgent)) ctx.addIssue({ code: "custom", path: ["defaultAgent"], message: "must be the id of a configured agent" });
  });

const repoSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{12}$/),
  path: absolutePath,
  name: z.string().trim().min(1),
  enabled: z.boolean(),
  agent: z.object({ enabled: z.boolean(), agentId: z.string().optional() }).optional(),
});

export const configSchema = z
  .object({
    version: z.literal(1),
    scanRoots: scanRootsSchema,
    ignorePaths: ignorePathsSchema.default([]),
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
      if (repo.agent?.agentId && !cfg.agentSessions.agents.some((a) => a.id === repo.agent?.agentId)) {
        ctx.addIssue({ code: "custom", path: ["repos", i, "agent", "agentId"], message: "unknown agent" });
      }
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
  return { version: 1, scanRoots: [], ignorePaths: [], repos: [], pollIntervalSeconds: DEFAULT_POLL_SECONDS, port: DEFAULT_PORT, agentSessions: defaultAgentSessions() };
}

/** Stable identity for a repository: 12 hex chars of the sha1 of its canonical path, so one directory has one id. */
export function repoId(path: string): string {
  return createHash("sha1").update(canonicalPath(path)).digest("hex").slice(0, 12);
}

export function repoNameFromPath(path: string): string {
  return basename(expandPath(path));
}

export function newRepoConfig(path: string, enabled = false): RepoConfig {
  const abs = canonicalPath(path);
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

/** Same rule as `Config.ignorePaths`. Used for ad-hoc discovery ignore paths. */
export function validateIgnorePaths(input: unknown): string[] {
  const result = ignorePathsSchema.safeParse(input);
  if (!result.success) {
    throw new ConfigValidationError(result.error.issues.map((i) => `ignorePaths${i.path.length ? `.${i.path.join(".")}` : ""}: ${i.message}`));
  }
  return result.data;
}

function canonicalList(input: unknown): unknown {
  if (!Array.isArray(input)) return input;
  return [...new Set(input.map((p) => (typeof p === "string" && p ? canonicalPath(p) : p)))];
}

/**
 * Brings a config written by an earlier version up to date before it is validated: `ignorePaths` defaults to empty,
 * stored paths become canonical, ids are recomputed, and repositories that turn out to be one directory are merged
 * (the enabled entry wins, else the first, together with its name). Anything it does not understand is left for
 * validation to report.
 */
export function migrateConfig(raw: unknown): { config: unknown; changed: boolean; warning?: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { config: raw, changed: false };
  const input = raw as Record<string, unknown>;
  const next: Record<string, unknown> = { ...input, scanRoots: canonicalList(input.scanRoots), ignorePaths: canonicalList(input.ignorePaths ?? []) };
  const merged: string[] = [];
  if (Array.isArray(input.repos)) {
    const byId = new Map<string, Record<string, unknown>>();
    const repos: unknown[] = [];
    for (const entry of input.repos) {
      if (!entry || typeof entry !== "object" || typeof (entry as { path?: unknown }).path !== "string" || !(entry as { path: string }).path) {
        repos.push(entry);
        continue;
      }
      const path = canonicalPath((entry as { path: string }).path);
      const repo: Record<string, unknown> = { ...(entry as Record<string, unknown>), id: repoId(path), path };
      const kept = byId.get(repo.id as string);
      if (!kept) {
        byId.set(repo.id as string, repo);
        repos.push(repo);
        continue;
      }
      const winner = kept.enabled !== true && repo.enabled === true ? repo : kept;
      const loser = winner === kept ? repo : kept;
      merged.push(`"${String(loser.name)}" into "${String(winner.name)}" (${path})`);
      if (winner !== kept) {
        byId.set(repo.id as string, repo);
        repos[repos.indexOf(kept)] = repo;
      }
    }
    next.repos = repos;
  }
  const changed = JSON.stringify(next) !== JSON.stringify(input);
  const warning = merged.length ? `config.json listed the same directory more than once; merged ${merged.join(", ")}` : undefined;
  return { config: next, changed, warning };
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
    const migrated = migrateConfig(JSON.parse(raw));
    const config = validateConfig(migrated.config);
    if (migrated.changed) await saveConfig(config);
    return { config, warning: migrated.warning };
  } catch (err) {
    const backup = `${path}.bak-${Date.now()}`;
    await rename(path, backup);
    const config = await saveConfig(defaultConfig());
    const reason = err instanceof Error ? err.message : String(err);
    return { config, warning: `config.json was invalid (${reason}); moved to ${backup} and reset to defaults` };
  }
}
