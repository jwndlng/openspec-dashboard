// The setup wizard's decisions (openspec/specs/setup-wizard), pure so they are tested without a DOM: when it opens by
// itself, which agents are checked and preselected, what each step saves, and what the Done step says. Every save is
// built from the configuration as it is when the user continues, and only adds or changes what the user touched.
import { AGENT_PRESETS } from "../shared/agentDefaults.ts";
import { PROJECT_SETTINGS, type ProjectSetting, settingApplies, withAutoFetch, withPrTitleConvention, withRepoAgent } from "../shared/repoSettings.ts";
import { type AgentAvailability, type AutoFetchSeconds, autoFetchInterval, type Config, type EnvironmentReport, type PrTitleConvention, type RepoConfig, repoAgentEnabled } from "../shared/types.ts";
import { newAgentProfile, parseArgLines } from "./sessionState.ts";

export const SETUP_STEPS = ["Welcome", "Workspace", "Agents", "Console", "Project settings", "System check", "Done"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

let autoOpen = true;

/** The demo build turns this off, so its first view and screenshots show the dashboard without the wizard. */
export function setSetupAutoOpen(on: boolean): void {
  autoOpen = on;
}

export function setupAutoOpens(): boolean {
  return autoOpen;
}

/** Whether the wizard opens by itself now: once per load, while setup is pending, with no other overlay in the way. */
export function shouldOpenSetup(state: { enabled: boolean; pending: boolean; alreadyOpened: boolean; ready: boolean; overlayOpen: boolean }): boolean {
  return state.enabled && state.pending && !state.alreadyOpened && state.ready && !state.overlayOpen;
}

/** `~` and `~/…` against the server's home directory, without a trailing separator — the spelling discovery reports. */
export function expandHome(path: string, home: string): string {
  const trimmed = path.trim();
  const expanded = trimmed === "~" ? home : trimmed.startsWith("~/") ? `${home.replace(/\/+$/, "")}/${trimmed.slice(2)}` : trimmed;
  return expanded.length > 1 ? expanded.replace(/[\\/]+$/, "") : expanded;
}

/** Absolute after `~` expansion, on POSIX or Windows; anything else is refused before discovery is asked. */
export function isAbsoluteRoot(path: string): boolean {
  const trimmed = path.trim();
  return trimmed === "~" || trimmed.startsWith("~/") || trimmed.startsWith("/") || /^[A-Za-z]:[\\/]/.test(trimmed);
}

/**
 * The Workspace step's save: the entered roots appended to the configured ones, without those discovery reported
 * missing and without duplicates. `null` when nothing would change, so continuing without entries sends nothing.
 */
export function workspaceSave(current: Config, entered: readonly string[], missing: ReadonlySet<string>): Config | null {
  const roots = [...current.scanRoots];
  for (const root of entered) {
    if (missing.has(root) || roots.includes(root)) continue;
    roots.push(root);
  }
  return roots.length === current.scanRoots.length ? null : { ...current, scanRoots: roots };
}

/** One agent the Agents step offers: a configured profile (always kept, so never unchecked), or a preset not configured yet. */
export interface AgentChoice {
  id: string;
  name: string;
  configured: boolean;
  available: boolean;
}

/** The configured profiles and the presets not configured yet, found ones first, otherwise in their given order. */
export function agentChoices(config: Config, agents: readonly AgentAvailability[], presets: readonly AgentAvailability[]): AgentChoice[] {
  const found = new Map([...agents, ...presets].map((a) => [a.id, a.available]));
  const configured = config.agentSessions.agents.map((a) => ({ id: a.id, name: a.name, configured: true, available: found.get(a.id) ?? false }));
  const ids = new Set(configured.map((a) => a.id));
  const offered = AGENT_PRESETS.filter(({ profile }) => !ids.has(profile.id)).map(({ profile }) => ({
    id: profile.id,
    name: profile.name,
    configured: false,
    available: found.get(profile.id) ?? false,
  }));
  const all = [...configured, ...offered];
  return [...all.filter((a) => a.available), ...all.filter((a) => !a.available)];
}

/** Checked before the user touches anything: every configured profile, and every preset found on this machine. */
export function initiallyChecked(choices: readonly AgentChoice[]): string[] {
  return choices.filter((c) => c.configured || c.available).map((c) => c.id);
}

/** An agent the user describes in the step: a name and a command, one argument per line. `key` is the step's own. */
export interface CustomAgent {
  key: string;
  name: string;
  command: string;
}

/** The id a custom agent is referred to by until it is saved, as the default agent for instance. */
export const customAgentRef = (agent: Pick<CustomAgent, "key">) => `custom:${agent.key}`;

/** What a custom agent still lacks, or `undefined` when it can be saved. */
export function customAgentProblem(agent: CustomAgent): string | undefined {
  if (!agent.name.trim()) return "Enter a name for this agent.";
  if (parseArgLines(agent.command).length === 0) return "Enter the command that starts this agent.";
  return undefined;
}

/** The agents the default can be chosen from: the checked ones, in list order, then every complete custom agent. */
export function defaultAgentOptions(choices: readonly AgentChoice[], checked: readonly string[], custom: readonly CustomAgent[]): { id: string; name: string; available?: boolean }[] {
  return [
    ...choices.filter((c) => checked.includes(c.id)).map((c) => ({ id: c.id, name: c.name, available: c.available })),
    ...custom.filter((a) => customAgentProblem(a) === undefined).map((a) => ({ id: customAgentRef(a), name: a.name.trim() })),
  ];
}

/**
 * The configured default when it is checked and installed, else the first checked agent that is installed, else the
 * configured default anyway. Without `checked`, every choice counts as checked.
 */
export function preselectedAgent(config: Config, choices: readonly AgentChoice[], checked?: readonly string[]): string {
  const fallback = config.agentSessions.defaultAgent;
  const candidates = checked ? choices.filter((c) => checked.includes(c.id)) : choices;
  if (candidates.find((c) => c.id === fallback)?.available) return fallback;
  return candidates.find((c) => c.available)?.id ?? fallback;
}

/** What the user chose in the Agents step. `checked` lists choice ids in the order they are listed. */
export interface AgentsChoice {
  enable: boolean;
  checked: readonly string[];
  custom: readonly CustomAgent[];
  /** A choice id or a {@link customAgentRef}. */
  defaultAgent: string;
}

/**
 * The Agents step's save: agent sessions switched on if asked, every checked preset and every complete custom agent
 * not configured yet added in the order listed, and the chosen agent made the default. Never switches agent sessions
 * off, and never removes or edits a configured profile or touches a repository. `null` when nothing would change.
 */
export function agentsSave(current: Config, choice: AgentsChoice): Config | null {
  const sessions = current.agentSessions;
  const agents = [...sessions.agents];
  for (const id of choice.checked) {
    if (agents.some((a) => a.id === id)) continue;
    const preset = AGENT_PRESETS.find(({ profile }) => profile.id === id)?.profile;
    if (preset) agents.push(structuredClone(preset));
  }
  const customIds = new Map<string, string>();
  for (const agent of choice.custom) {
    if (customAgentProblem(agent) !== undefined) continue;
    const profile = newAgentProfile({ name: agent.name.trim(), command: parseArgLines(agent.command), taken: agents.map((a) => a.id) });
    agents.push(profile);
    customIds.set(customAgentRef(agent), profile.id);
  }
  const wanted = customIds.get(choice.defaultAgent) ?? choice.defaultAgent;
  const defaultAgent = agents.some((a) => a.id === wanted) ? wanted : sessions.defaultAgent;
  const enabled = sessions.enabled || choice.enable;
  if (enabled === sessions.enabled && agents.length === sessions.agents.length && defaultAgent === sessions.defaultAgent) return null;
  return { ...current, agentSessions: { ...sessions, enabled, agents, defaultAgent } };
}

/** The Console step's save: only the console agent, `undefined` (follow the default) stored as no choice. */
export function consoleSave(current: Config, consoleAgent: string | undefined): Config | null {
  const sessions = current.agentSessions;
  const wanted = consoleAgent && sessions.agents.some((a) => a.id === consoleAgent) ? consoleAgent : undefined;
  if (wanted === sessions.consoleAgent) return null;
  const { consoleAgent: _old, ...rest } = sessions;
  return { ...current, agentSessions: wanted ? { ...rest, consoleAgent: wanted } : rest };
}

/** The Project settings step's two ways of working. */
export type ProjectSettingsMode = "all" | "individual";

/**
 * The settings the user changed in the step, as the values its controls show: `agentSessions` "enabled" | "disabled",
 * `agent` "" (default agent) or a profile id, `prTitles` "" | "conventional-commits", `autoMergeDocs` "on" | "off",
 * `autoFetch` "0" (Off) or an interval in seconds. A setting the user did not touch has no key.
 */
export type SettingsDraft = Partial<Record<ProjectSetting, string>>;

/** A project's setting as its control shows it. */
export function settingValue(repo: RepoConfig, setting: ProjectSetting): string {
  switch (setting) {
    case "agentSessions":
      return repoAgentEnabled(repo) ? "enabled" : "disabled";
    case "agent":
      return repo.agent?.agentId ?? "";
    case "prTitles":
      return repo.prTitleConvention ?? "";
    case "autoMergeDocs":
      return repo.agent?.autoMergeDocs === true ? "on" : "off";
    case "autoFetch":
      return String(autoFetchInterval(repo) ?? 0);
  }
}

/** What a fresh project shows, which the step names as each setting's default. */
export const SETTING_DEFAULTS: Record<ProjectSetting, string> = { agentSessions: "enabled", agent: "", prTitles: "", autoMergeDocs: "off", autoFetch: "60" };

/** `repo` with `setting` set to `value`, stored as the settings dialog stores it. */
export function applySetting(repo: RepoConfig, setting: ProjectSetting, value: string): RepoConfig {
  switch (setting) {
    case "agentSessions":
      return withRepoAgent(repo, { enabled: value === "enabled" });
    case "agent":
      return withRepoAgent(repo, { agentId: value || null });
    case "prTitles":
      return withPrTitleConvention(repo, (value || null) as PrTitleConvention | null);
    case "autoMergeDocs":
      return withRepoAgent(repo, { autoMergeDocs: value === "on" });
    case "autoFetch":
      return withAutoFetch(repo, Number(value) as AutoFetchSeconds | 0);
  }
}

/** `repo` with `draft` applied in the dialog's order, each setting only where it applies once the earlier ones are. */
export function withDraft(repo: RepoConfig, draft: SettingsDraft, config: Config, isGit: boolean): RepoConfig {
  let next = repo;
  for (const setting of PROJECT_SETTINGS) {
    const value = draft[setting];
    // A value the project already shows is left alone, so a repository without agent settings does not gain them.
    if (value !== undefined && value !== settingValue(next, setting) && settingApplies(setting, next, config, isGit)) next = applySetting(next, setting, value);
  }
  return next;
}

/** The enabled projects the step covers, in the configuration's order. */
export function settingsProjects(config: Config): RepoConfig[] {
  return config.repos.filter((r) => r.enabled);
}

/**
 * For the one form of "Same settings for all projects": the projects `setting` applies to (with the draft's earlier
 * settings applied, so switching sessions off hides Docs auto-merge) and the value they share, `undefined` when they
 * disagree.
 */
export function sharedSetting(projects: readonly RepoConfig[], setting: ProjectSetting, draft: SettingsDraft, config: Config, isGit: (id: string) => boolean): { applies: number; value?: string } {
  const before: SettingsDraft = {};
  for (const s of PROJECT_SETTINGS) {
    if (s === setting) break;
    if (draft[s] !== undefined) before[s] = draft[s];
  }
  const values = projects.map((r) => withDraft(r, before, config, isGit(r.id))).filter((r) => settingApplies(setting, r, config, isGit(r.id))).map((r) => settingValue(r, setting));
  const value = values.length > 0 && values.every((v) => v === values[0]) ? values[0] : undefined;
  return { applies: values.length, value };
}

/**
 * The Project settings step's save, built from the configuration as it is now: in "all" mode `all` is applied to every
 * enabled project, in "individual" mode `each` per project — only touched settings, only where they apply. `null` when
 * nothing would change; otherwise the configuration and how many projects it changed.
 */
export function projectSettingsSave(
  current: Config,
  mode: ProjectSettingsMode,
  drafts: { all: SettingsDraft; each: ReadonlyMap<string, SettingsDraft> },
  isGit: (id: string) => boolean,
): { config: Config; changed: number } | null {
  let changed = 0;
  const repos = current.repos.map((repo) => {
    if (!repo.enabled) return repo;
    const draft = mode === "all" ? drafts.all : drafts.each.get(repo.id);
    if (!draft) return repo;
    const next = withDraft(repo, draft, current, isGit(repo.id));
    if (JSON.stringify(next) === JSON.stringify(repo)) return repo;
    changed++;
    return next;
  });
  return changed === 0 ? null : { config: { ...current, repos }, changed };
}

/** What setup saved so far, collected step by step for the Done step. */
export interface SetupSaved {
  rootsAdded: string[];
  tracked: number;
  agentsAdded: string[];
  projectsChanged: number;
}

export const NOTHING_SAVED: SetupSaved = { rootsAdded: [], tracked: 0, agentsAdded: [], projectsChanged: 0 };

/** What the Done step reports: what setup saved, and the checks still needing attention. */
export interface SetupSummary extends SetupSaved {
  agentSessions: boolean;
  defaultAgent?: string;
  /** The console agent's name; absent when the console follows the default agent. */
  consoleAgent?: string;
  remaining: string[];
}

export function setupSummary(config: Config | null, saved: SetupSaved, report?: EnvironmentReport): SetupSummary {
  const sessions = config?.agentSessions;
  return {
    rootsAdded: [...saved.rootsAdded],
    tracked: saved.tracked,
    agentsAdded: [...saved.agentsAdded],
    projectsChanged: saved.projectsChanged,
    agentSessions: sessions?.enabled === true,
    defaultAgent: sessions?.agents.find((a) => a.id === sessions.defaultAgent)?.name,
    consoleAgent: sessions?.consoleAgent ? sessions.agents.find((a) => a.id === sessions.consoleAgent)?.name : undefined,
    remaining: (report?.checks ?? []).filter((c) => c.status === "problem" || c.status === "warning").map((c) => c.label),
  };
}

/** Whether every check is `ok` or `not-needed`, which the System check step says plainly. */
export function allInPlace(report: EnvironmentReport | undefined): boolean {
  return report?.checks.every((c) => c.status === "ok" || c.status === "not-needed") === true;
}
