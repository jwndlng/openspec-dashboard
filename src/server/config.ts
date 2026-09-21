import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute } from "node:path";
import { z } from "zod";
import { CLAUDE_PROFILE, defaultAgentSessions, FORMER_ARCHIVE_PROMPTS } from "../shared/agentDefaults.ts";
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
  return upgradeFormerDefaults(result.data);
}

/**
 * Profiles are persisted from the first run on, so a reworded preconfigured prompt would never reach an existing
 * installation. Only a verbatim former default on the preconfigured profile is replaced: an edited prompt, a removed
 * one and other profiles are the user's. Nothing is written here; the value reaches the file with the next save.
 */
function upgradeFormerDefaults(config: Config): Config {
  const agents = config.agentSessions.agents.map((agent) =>
    agent.id === CLAUDE_PROFILE.id && agent.prompts.archive !== undefined && FORMER_ARCHIVE_PROMPTS.includes(agent.prompts.archive)
      ? { ...agent, prompts: { ...agent.prompts, archive: CLAUDE_PROFILE.prompts.archive } }
      : agent,
  );
  return { ...config, agentSessions: { ...config.agentSessions, agents } };
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
