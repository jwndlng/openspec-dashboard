// Pure helpers for the agent-session UI; free of DOM access at import time so they can be unit-tested.
import { availableActions, repoAgentEnabled, SHIPPABLE_WORK, type AgentProfile, type ChangeSnapshot, type Config, type Session, type SessionAction, type SessionWorktree } from "../shared/types.ts";

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
  /** Leading glyph, kept apart from the words so it can be styled (and hidden from assistive technology) on its own. */
  icon?: string;
  /** True only while an agent is visibly working: the one state that is shown with motion. */
  live?: boolean;
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
    if (quiet > QUIET_AFTER_MS) return { icon: "◆", label: `quiet ${Math.floor(quiet / 60_000)}m`, tone: "warn", title: "the terminal has printed nothing for a while — the agent is probably waiting for you" };
    return { icon: "●", label: "running", live: true, tone: "brand", title: `${session.agentName} is running in its terminal` };
  }
  if (session.state === "failed") return { icon: "⚠", label: "failed", tone: "danger", title: session.error ?? "the agent could not be started" };
  const code = session.exitCode;
  if (session.error || (code ?? 0) !== 0) return { icon: "⚠", label: `ended${code ? ` (${code})` : ""}`, tone: "danger", title: session.error ?? `the agent exited with code ${code}` };
  return { label: "ended", tone: "", title: "the agent exited" };
}

const HOUR = 3_600_000;
/** Work that is not even pushed is forgotten fastest; a pushed branch may simply wait for review. */
const STALE_AFTER_MS: Partial<Record<SessionWorktree["work"]["state"], number>> = { uncommitted: 24 * HOUR, unpushed: 24 * HOUR, pushed: 7 * 24 * HOUR };

/** Open work nobody is working on: past its age limit and without a running session. */
export function staleAge(worktree: SessionWorktree, sessions: Session[], now = Date.now()): string | undefined {
  const limit = STALE_AFTER_MS[worktree.work.state];
  const last = worktree.lastActivityAt ? Date.parse(worktree.lastActivityAt) : Number.NaN;
  if (limit === undefined || Number.isNaN(last) || now - last < limit) return undefined;
  if (sessions.some((s) => s.id === worktree.sessionId && s.state === "running")) return undefined;
  const hours = Math.floor((now - last) / HOUR);
  return hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Text plus colour, never colour alone. Nothing for `clean` and `missing`: there is nothing to say about them. */
export function workBadge(worktree: SessionWorktree, sessions: Session[], now = Date.now()): SessionBadge | undefined {
  const { state, count = 0, base } = worktree.work;
  const stale = staleAge(worktree, sessions, now);
  const tail = stale ? ` · ${stale}` : "";
  const waiting = stale ? ` — untouched for ${stale}` : "";
  if (state === "uncommitted") return { label: `✎ ${count} uncommitted${tail}`, tone: stale ? "danger" : "warn", title: `${plural(count, "file")} in the worktree ${count === 1 ? "is" : "are"} not committed${waiting}` };
  if (state === "unpushed") return { label: `↑ ${count} not pushed${tail}`, tone: stale ? "danger" : "warn", title: `${plural(count, "commit")} exist only on this machine${waiting}` };
  if (state === "pushed") return { label: `⇡ pushed${tail}`, tone: stale ? "warn" : "brand", title: `pushed, but not in ${base ?? "the default branch"} as of your last fetch${waiting}` };
  if (state === "merged") return { label: "✓ merged", tone: "", title: `merged into ${base ?? "the default branch"} as of your last fetch — the worktree can be removed` };
  return undefined;
}

/** The worktree a card stands for: the change's own one; its archive worktree only matters once that holds work. */
export function worktreeForChange(worktrees: SessionWorktree[], repoId: string, change: string): SessionWorktree | undefined {
  const mine = worktrees.filter((w) => w.repoId === repoId && w.change === change);
  return mine.find((w) => SHIPPABLE_WORK.includes(w.work.state)) ?? mine.find((w) => w.work.state === "merged");
}

/** The Open work list: everything unshipped plus merged worktrees still lying around; stale first, then oldest first. */
export function openWork(worktrees: SessionWorktree[], sessions: Session[], now = Date.now()): { items: SessionWorktree[]; unshipped: number } {
  const items = worktrees.filter((w) => SHIPPABLE_WORK.includes(w.work.state) || w.work.state === "merged");
  const rank = (w: SessionWorktree) => (staleAge(w, sessions, now) ? 0 : w.work.state === "merged" ? 2 : 1);
  items.sort((a, b) => rank(a) - rank(b) || (a.lastActivityAt ?? "").localeCompare(b.lastActivityAt ?? ""));
  return { items, unshipped: items.filter((w) => w.work.state !== "merged").length };
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
