// Pure helpers for the agent-session UI; free of DOM access at import time so they can be unit-tested.
import { availableActions, repoAgentEnabled, type AgentProfile, type ChangeSnapshot, type Config, type Session, type SessionAction } from "../shared/types.ts";

/** Session starters are shown when the feature is on, for every tracked repository that has not been switched off. */
export function sessionsEnabledFor(config: Config | null, repoId: string): boolean {
  if (!config?.agentSessions.enabled) return false;
  return config.repos.some((r) => r.id === repoId && repoAgentEnabled(r));
}

export function agentForRepo(config: Config | null, repoId: string): AgentProfile | undefined {
  if (!config) return undefined;
  const wanted = config.repos.find((r) => r.id === repoId)?.agent?.agentId;
  const agents = config.agentSessions.agents;
  return agents.find((a) => a.id === wanted) ?? agents.find((a) => a.id === config.agentSessions.defaultAgent);
}

/** What the change's stage allows, narrowed to what this repository's agent has an opening prompt for. */
export function startersFor(config: Config | null, card: Pick<ChangeSnapshot, "repoId" | "archived" | "artifacts" | "stage">): SessionAction[] {
  const agent = agentForRepo(config, card.repoId);
  if (!agent) return [];
  return availableActions(card).filter((action) => Boolean(agent.prompts[action]));
}

/** The session a card represents: the running one, otherwise the most recent one if it did not end cleanly. */
export function sessionForChange(sessions: Session[], repoId: string, change: string): Session | undefined {
  const mine = sessions.filter((s) => s.repoId === repoId && s.change === change).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = mine[0];
  return mine.find((s) => s.state === "running") ?? (latest && (latest.state === "failed" || (latest.exitCode ?? 0) !== 0) ? latest : undefined);
}

export interface SessionBadge {
  label: string;
  tone: "brand" | "warn" | "danger" | "";
  title: string;
}

const QUIET_AFTER_MS = 60_000;

/**
 * A terminal is a byte stream, so the dashboard cannot know that an agent "waits for you". It can say that the
 * terminal has been quiet for a while, which in practice is the same hint. Status is always text plus colour.
 */
export function sessionBadge(session: Session, now = Date.now()): SessionBadge {
  if (session.state === "running") {
    const last = session.lastOutputAt ? Date.parse(session.lastOutputAt) : Number.NaN;
    const quiet = Number.isNaN(last) ? 0 : now - last;
    if (quiet > QUIET_AFTER_MS) return { label: `◆ quiet ${Math.floor(quiet / 60_000)}m`, tone: "warn", title: "the terminal has printed nothing for a while — the agent is probably waiting for you" };
    return { label: "● running", tone: "brand", title: `${session.agentName} is running in its terminal` };
  }
  if (session.state === "failed") return { label: "⚠ failed", tone: "danger", title: session.error ?? "the agent could not be started" };
  const code = session.exitCode;
  if (session.error || (code ?? 0) !== 0) return { label: `⚠ ended${code ? ` (${code})` : ""}`, tone: "danger", title: session.error ?? `the agent exited with code ${code}` };
  return { label: "ended", tone: "", title: "the agent exited" };
}

const PARAM = "session";

export function sessionIdFromSearch(search: string): string | undefined {
  return new URLSearchParams(search).get(PARAM) || undefined;
}

/** Sets or clears `?session=` and keeps every other query parameter (board filters live there too). */
export function searchWithSession(search: string, id: string | undefined): string {
  const params = new URLSearchParams(search);
  if (id) params.set(PARAM, id);
  else params.delete(PARAM);
  const out = params.toString();
  return out ? `?${out}` : "";
}

/** One argument per line; blank lines are dropped. A command is an argument list, never a shell string. */
export function parseArgLines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

export function slugId(name: string, taken: string[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "agent";
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}
