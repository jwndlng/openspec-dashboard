// The environment report (openspec/specs/environment-check): what this machine is missing, stated before an agent runs
// into it. Local and read-only by contract — it opens no network connection, reads nothing in a tracked repository, and
// the only process it starts is `git config --get`, already enumerated as read-only in the dashboard-api spec.
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, sep } from "node:path";
import { ENVIRONMENT_STATUS_ORDER, type Config, type EnvironmentCheck, type EnvironmentReport, type EnvironmentStatus, type Snapshot } from "../shared/types.ts";
import { describeStep, migrationOutcome } from "./homeMigration.ts";
import { dashboardHome, whichOnPath } from "./paths.ts";
import { availability } from "./sessions/agents.ts";

/** Reused for at most this long, so a double mount costs one computation. **Re-check** asks for a fresh one. */
const CACHE_MS = 10_000;
const GIT_TIMEOUT_MS = 5_000;

/** Said in the check itself, so a disabled feature reads as "nothing was looked at" rather than as a pass. */
const AGENTS_OFF = "not needed while agent sessions are off";

/** What a local check cannot know. Stated in the report because the alternative is implying that a credential works. */
const CAVEAT = "GitHub credentials are only checked for being configured — whether they are still valid is known when the agent uses them.";

/** Whether a missing prerequisite matters, derived from the configuration rather than fixed per check. */
interface Relevance {
  /** Set when the configuration switched off the feature needing it: the check is `not-needed` and looks at nothing. */
  disabled?: string;
  /** Status for a prerequisite that is needed and missing. */
  missing: "warning" | "problem";
}

function notNeeded(id: string, label: string, reason: string): EnvironmentCheck {
  return { id, label, status: "not-needed", found: reason };
}

function reason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * The one writing git command… is not here: this runs `git config --get`, which reads. Deliberately not `git.ts`'s
 * runner, whose contract is "always in a repository": this one must run outside every tracked repository.
 */
async function gitConfigGet(cwd: string, key: string): Promise<string | undefined> {
  try {
    const proc = Bun.spawn(["git", "config", "--get", key], {
      cwd,
      stdout: "pipe",
      stderr: "ignore",
      stdin: "ignore",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" },
    });
    const timer = setTimeout(() => proc.kill(), GIT_TIMEOUT_MS);
    try {
      const out = await new Response(proc.stdout).text();
      return (await proc.exited) === 0 ? out.trim() || undefined : undefined;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return undefined;
  }
}

/** True when `path` is the repository itself or below it; `sep` so `/w/acme-old` is not read as inside `/w/acme`. */
function insideAnyRepo(path: string, config: Config): boolean {
  return config.repos.some((repo) => path === repo.path || path.startsWith(repo.path + sep));
}

/**
 * Where the identity is read: the dashboard's own home, which holds no repository, so `git config --get` reports the
 * system, XDG and global scopes — "configured for this user". A home that somehow lies inside a tracked repository
 * would add that repository's own config, so a directory that certainly does not is used instead.
 */
function identityCwd(config: Config): string {
  const home = dashboardHome();
  return insideAnyRepo(home, config) ? tmpdir() : home;
}

/** What the home migration left unfinished, as a warning on an otherwise writable home; nothing once it is done. */
function migrationWarning(id: string, label: string, dir: string): EnvironmentCheck | undefined {
  const outcome = migrationOutcome();
  if (outcome.kind === "refused") {
    return {
      id,
      label,
      status: "warning",
      found: `writable: ${dir}, the former home — it could not be moved to its new name: ${outcome.reason}`,
      remedy: "Nothing is lost; Spec Control tries to move it again on the next start. Restart it once nothing else uses that folder.",
    };
  }
  if (outcome.kind === "both") {
    return {
      id,
      label,
      status: "warning",
      found: `writable: ${dir}; the former home ${outcome.old} is still there and no longer used`,
      remedy: `Move anything you still need out of ${outcome.old}, then delete it.`,
    };
  }
  if ((outcome.kind === "migrated" || outcome.kind === "retried") && outcome.pending.length > 0) {
    return {
      id,
      label,
      status: "warning",
      found: `writable: ${dir}; moving the home left ${outcome.pending.length === 1 ? "one step" : `${outcome.pending.length} steps`} to finish: ${outcome.pending.map(describeStep).join("; ")}`,
      remedy: "Spec Control retries these on the next start; the link at the former home keeps everything usable meanwhile.",
    };
  }
  return undefined;
}

async function checkDashboardHome(): Promise<EnvironmentCheck> {
  const id = "dashboard-home";
  const label = "Dashboard home";
  const dir = dashboardHome();
  // Unique, so two dashboards probing at once never collide, and removed again: a check leaves nothing behind.
  const probe = join(dir, `.env-check-${Math.random().toString(36).slice(2, 10)}`);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(probe, "");
    return migrationWarning(id, label, dir) ?? { id, label, status: "ok", found: `writable: ${dir}` };
  } catch (err) {
    return {
      id,
      label,
      status: "problem",
      found: `${dir} cannot be written: ${reason(err)}`,
      remedy: "Make that directory writable, or point SPEC_CONTROL_HOME at one that is.",
    };
  } finally {
    await rm(probe, { force: true }).catch(() => {});
  }
}

function checkGit(relevance: Relevance): EnvironmentCheck {
  const id = "git";
  const label = "git";
  const path = whichOnPath("git");
  if (path) return { id, label, status: "ok", found: path };
  return {
    id,
    label,
    status: relevance.missing,
    found: "not found on the PATH",
    remedy: "Install git — worktrees, pull, cleanup and every work status need it.",
  };
}

async function checkGitIdentity(relevance: Relevance, config: Config): Promise<EnvironmentCheck> {
  const id = "git-identity";
  const label = "Git committer identity";
  if (relevance.disabled) return notNeeded(id, label, relevance.disabled);
  const remedy = 'Run `git config --global user.name "…"` and `git config --global user.email "…"`; a repository may also set its own.';
  if (!whichOnPath("git")) return { id, label, status: relevance.missing, found: "could not be read: git was not found", remedy };
  const cwd = identityCwd(config);
  const [name, email] = await Promise.all([gitConfigGet(cwd, "user.name"), gitConfigGet(cwd, "user.email")]);
  if (name && email) return { id, label, status: "ok", found: `${name} <${email}>` };
  const missing = [name ? undefined : "user.name", email ? undefined : "user.email"].filter((k) => k !== undefined);
  return { id, label, status: relevance.missing, found: `${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} not configured for this user`, remedy };
}

function checkOpenspecCli(relevance: Relevance): EnvironmentCheck {
  const id = "openspec-cli";
  const label = "OpenSpec CLI";
  const path = whichOnPath("openspec");
  if (path) return { id, label, status: "ok", found: path };
  return {
    id,
    label,
    status: relevance.missing,
    found: "not found on the PATH",
    remedy: "Install it (`bun add -g @fission-ai/openspec`); the agent's own commands and `openspec init` need it.",
  };
}

/** Names only, never a value: a token must not pass through the report. */
const GH_TOKEN_VARS = ["GH_TOKEN", "GITHUB_TOKEN"] as const;

function ghTokenVar(): string | undefined {
  return GH_TOKEN_VARS.find((name) => (process.env[name]?.length ?? 0) > 0);
}

/** `gh`'s own precedence, so the report looks exactly where `gh` itself would: an explicit directory wins outright. */
function ghConfigDirs(): string[] {
  if (process.env.GH_CONFIG_DIR) return [process.env.GH_CONFIG_DIR];
  if (process.env.XDG_CONFIG_HOME) return [join(process.env.XDG_CONFIG_HOME, "gh")];
  const dirs = [join(homedir(), ".config", "gh")];
  const appData = process.env.APPDATA ?? process.env.AppData;
  if (appData) dirs.push(join(appData, "GitHub CLI"));
  return dirs;
}

/** Established by `stat` alone: the file holds the token, so its contents are never opened. */
async function ghHostsFile(): Promise<string | undefined> {
  for (const dir of ghConfigDirs()) {
    const file = join(dir, "hosts.yml");
    try {
      const info = await stat(file);
      if (info.isFile() && info.size > 0) return file;
    } catch {
      // Not in this location; try the next.
    }
  }
  return undefined;
}

async function checkGithubCli(relevance: Relevance): Promise<EnvironmentCheck> {
  const id = "github-cli";
  const label = "GitHub CLI";
  if (relevance.disabled) return notNeeded(id, label, relevance.disabled);
  const path = whichOnPath("gh");
  if (!path) {
    return {
      id,
      label,
      status: relevance.missing,
      found: "`gh` not found on the PATH",
      remedy: "Install the GitHub CLI; Ship asks the agent to open a pull request with it.",
    };
  }
  const variable = ghTokenVar();
  if (variable) return { id, label, status: "ok", found: `${path}, ${variable} is set` };
  const hosts = await ghHostsFile();
  if (hosts) return { id, label, status: "ok", found: `${path}, credentials configured in ${hosts}` };
  return {
    id,
    label,
    status: relevance.missing,
    found: `${path}, but no credentials were found for it`,
    remedy: "Run `gh auth login`, or set GH_TOKEN in the environment the dashboard starts in.",
  };
}

function checkAgents(config: Config, enabled: boolean): EnvironmentCheck[] {
  const used = new Set<string>();
  if (config.agentSessions.defaultAgent) used.add(config.agentSessions.defaultAgent);
  // The main console runs its own agent when one is chosen (else the default, already in the set).
  if (config.agentSessions.consoleAgent) used.add(config.agentSessions.consoleAgent);
  for (const repo of config.repos) {
    // Absent agent settings mean "included", so such a repository uses the default agent, which is already in the set.
    if (repo.enabled && repo.agent?.enabled !== false && repo.agent?.agentId) used.add(repo.agent.agentId);
  }
  return availability(config).map((agent) => {
    const id = `agent:${agent.id}`;
    const isDefault = agent.id === config.agentSessions.defaultAgent;
    const label = `Agent: ${agent.name}${isDefault ? " (default)" : ""}`;
    if (!enabled) return notNeeded(id, label, AGENTS_OFF);
    if (agent.available) return { id, label, status: "ok" as const, found: agent.path ?? "found on the PATH" };
    const command = config.agentSessions.agents.find((a) => a.id === agent.id)?.command[0] ?? agent.id;
    return {
      id,
      label,
      status: used.has(agent.id) ? ("problem" as const) : ("warning" as const),
      found: `${command} not found on the PATH`,
      remedy: `Install ${agent.name}, or change its command in Settings → Agent sessions.`,
    };
  });
}

function worst(checks: readonly EnvironmentCheck[]): EnvironmentStatus {
  for (const status of ENVIRONMENT_STATUS_ORDER) {
    if (checks.some((check) => check.status === status)) return status;
  }
  return "ok";
}

async function compute(config: Config, snapshot: Snapshot): Promise<EnvironmentReport> {
  const sessions = config.agentSessions.enabled;
  const enabledIds = new Set(config.repos.filter((repo) => repo.enabled).map((repo) => repo.id));
  // From the scan, never from letting a git command fail — the same rule in-place sessions are decided by.
  const anyGitRepo = snapshot.repos.some((repo) => enabledIds.has(repo.id) && repo.isGit);
  const forAgents: Relevance = sessions ? { missing: "warning" } : { disabled: AGENTS_OFF, missing: "warning" };

  const home = await checkDashboardHome();
  const git = checkGit({ missing: anyGitRepo ? "problem" : "warning" });
  const identity = await checkGitIdentity(forAgents, config);
  const openspec = checkOpenspecCli({ missing: "warning" });
  const agents = checkAgents(config, sessions);
  const github = await checkGithubCli(forAgents);

  const checks = [home, git, identity, openspec, ...agents, github];
  return {
    checkedAt: new Date().toISOString(),
    status: worst(checks),
    checks,
    ...(github.status === "not-needed" ? {} : { caveat: CAVEAT }),
  };
}

/** Everything the cached report was computed from; a saved configuration is therefore always reflected by the next one. */
function cacheKey(config: Config, snapshot: Snapshot): string {
  const repos = config.repos.filter((repo) => repo.enabled);
  return JSON.stringify([
    config.agentSessions,
    repos.map((repo) => [repo.id, repo.agent?.enabled !== false, repo.agent?.agentId ?? null]),
    snapshot.repos.map((repo) => [repo.id, repo.isGit]),
  ]);
}

let cached: { key: string; at: number; report: EnvironmentReport } | undefined;

/**
 * The report, recomputed unless an identical one was made in the last {@link CACHE_MS}. Pass `force` for **Re-check**:
 * the user has just changed something on the machine, which no cache key can see.
 */
export async function environmentReport(config: Config, snapshot: Snapshot, options: { force?: boolean } = {}): Promise<EnvironmentReport> {
  const key = cacheKey(config, snapshot);
  if (!options.force && cached && cached.key === key && Date.now() - cached.at < CACHE_MS) return cached.report;
  const report = await compute(config, snapshot);
  cached = { key, at: Date.now(), report };
  return report;
}

/** For tests, which change the PATH between reports — something no cache key can observe. */
export function resetEnvironmentCache(): void {
  cached = undefined;
}
