// The setup wizard's decisions (openspec/specs/setup-wizard), pure so they are tested without a DOM: when it opens by
// itself, which agent is preselected, what each step saves, and what the Done step says. Every save is built from the
// configuration as it is when the user continues and only ever adds to it.
import { AGENT_PRESETS } from "../shared/agentDefaults.ts";
import type { AgentAvailability, Config, EnvironmentReport } from "../shared/types.ts";

export const SETUP_STEPS = ["Welcome", "Workspace", "Agents", "System check", "Done"] as const;
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

/** One agent the Agents step offers: a configured profile, or a preset not configured yet. */
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

/** The configured default when it is installed, else the first agent that is, else the configured default anyway. */
export function preselectedAgent(config: Config, choices: readonly AgentChoice[]): string {
  const fallback = config.agentSessions.defaultAgent;
  if (choices.find((c) => c.id === fallback)?.available) return fallback;
  return choices.find((c) => c.available)?.id ?? fallback;
}

/**
 * The Agents step's save: agent sessions switched on if asked, the chosen preset added if it is not configured, and the
 * chosen agent made the default. Never switches agent sessions off, and touches no other profile or repository.
 */
export function agentsSave(current: Config, choice: { enable: boolean; agentId: string }): Config | null {
  const sessions = current.agentSessions;
  const configured = sessions.agents.some((a) => a.id === choice.agentId);
  const preset = configured ? undefined : AGENT_PRESETS.find(({ profile }) => profile.id === choice.agentId)?.profile;
  if (!configured && !preset) return null;
  const enable = choice.enable && !sessions.enabled;
  if (!enable && configured && sessions.defaultAgent === choice.agentId) return null;
  return {
    ...current,
    agentSessions: {
      ...sessions,
      enabled: sessions.enabled || choice.enable,
      agents: preset ? [...sessions.agents, structuredClone(preset)] : sessions.agents,
      defaultAgent: choice.agentId,
    },
  };
}

/** What the Done step reports: what setup saved, and the checks still needing attention. */
export interface SetupSummary {
  rootsAdded: string[];
  tracked: number;
  agentSessions: boolean;
  defaultAgent?: string;
  remaining: string[];
}

export function setupSummary(config: Config | null, saved: { rootsAdded: readonly string[]; tracked: number }, report?: EnvironmentReport): SetupSummary {
  const sessions = config?.agentSessions;
  return {
    rootsAdded: [...saved.rootsAdded],
    tracked: saved.tracked,
    agentSessions: sessions?.enabled === true,
    defaultAgent: sessions?.agents.find((a) => a.id === sessions.defaultAgent)?.name,
    remaining: (report?.checks ?? []).filter((c) => c.status === "problem" || c.status === "warning").map((c) => c.label),
  };
}

/** Whether every check is `ok` or `not-needed`, which the System check step says plainly. */
export function allInPlace(report: EnvironmentReport | undefined): boolean {
  return report?.checks.every((c) => c.status === "ok" || c.status === "not-needed") === true;
}
