// Pure helpers for the agent-session UI; free of DOM access at import time so they can be unit-tested.
import { OPEN_SESSION_STATES, repoAgentEnabled, type Config, type Session } from "../shared/types.ts";
import { cdCommand } from "./format.ts";

/** Session starters are shown when the feature is on, for every tracked repository that has not been switched off. */
export function sessionsEnabledFor(config: Config | null, repoId: string): boolean {
  if (!config?.agentSessions.enabled) return false;
  return config.repos.some((r) => r.id === repoId && repoAgentEnabled(r));
}

/** The session a card should represent: the open one, otherwise the most recent failure (so its reason stays visible). */
export function sessionForChange(sessions: Session[], repoId: string, change: string): Session | undefined {
  const mine = sessions.filter((s) => s.repoId === repoId && s.change === change).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return mine.find((s) => OPEN_SESSION_STATES.includes(s.state)) ?? (mine[0]?.state === "failed" ? mine[0] : undefined);
}

export interface SessionBadge {
  label: string;
  tone: "brand" | "warn" | "danger" | "";
  title: string;
}

/** Status is always text plus colour, never colour alone. */
export function sessionBadge(session: Session): SessionBadge {
  switch (session.state) {
    case "running":
      return { label: "● working", tone: "brand", title: "the agent is working" };
    case "queued":
      return { label: "◌ queued", tone: "brand", title: "waiting for a free slot" };
    case "waiting":
      return { label: "◆ waiting for you", tone: "warn", title: "the agent finished its turn; open the session to continue" };
    case "interrupted":
      return { label: "◆ interrupted", tone: "warn", title: "the dashboard stopped while this session was working; send a message to continue" };
    case "failed":
      return { label: "⚠ failed", tone: "danger", title: session.error ?? session.failure ?? "the session failed" };
    default:
      return { label: session.state, tone: "", title: "" };
  }
}

/** Continue the same conversation in a terminal, from the session's own worktree. */
export function resumeCommand(session: Session): string | undefined {
  if (!session.worktreePath) return undefined;
  return `${cdCommand(session.worktreePath)} && claude --resume ${session.cliSessionId}`;
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

export function parseToolList(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}
