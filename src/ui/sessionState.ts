// Pure helpers for the agent-session UI; free of DOM access at import time so they can be unit-tested.
import { availableActions, repoAgentEnabled, SHIPPABLE_WORK, type AgentProfile, type ChangeSnapshot, type Config, type RepoSnapshot, type Session, type SessionAction, type SessionWorktree, type WorkStatus } from "../shared/types.ts";

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

/**
 * The sessions a card shows: every running one (archiving may run next to the change's other session), otherwise the
 * most recent one if it did not end cleanly.
 */
export function sessionsForChange(sessions: Session[], repoId: string, change: string): Session[] {
  const mine = sessions.filter((s) => s.repoId === repoId && s.change === change).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const running = mine.filter((s) => s.state === "running");
  if (running.length > 0) return running;
  const latest = mine[0];
  return latest && (latest.state === "failed" || (latest.exitCode ?? 0) !== 0) ? [latest] : [];
}

/**
 * Where a starter goes: into the change's running session (the prompt is typed there), or into a new session.
 * Archive always gets its own, and nothing is typed into an archive session.
 */
export function nextStepFor(sessions: Session[], repoId: string, change: string, action: SessionAction): { promptSessionId?: string; blocked?: boolean } {
  const running = sessions.filter((s) => s.repoId === repoId && s.change === change && s.state === "running");
  if (action === "archive") return { blocked: running.some((s) => s.action === "archive") };
  return { promptSessionId: running.find((s) => s.action !== "archive")?.id };
}

/** Dock tabs: every running session, oldest first so tabs do not jump, plus shown ones that have ended. */
export function sessionTabs(sessions: Session[], shown: readonly string[]): Session[] {
  return sessions.filter((s) => s.state === "running" || shown.includes(s.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export type EndSeverity = "plain" | "notice" | "danger";

/** How loudly ending a session has to be questioned: work that exists only in the worktree is the loud case. */
export function endSeverity(work: Pick<WorkStatus, "state"> | undefined): EndSeverity {
  if (work?.state === "uncommitted" || work?.state === "unpushed") return "danger";
  return work?.state === "pushed" ? "notice" : "plain";
}

export function endWarning(work: WorkStatus | undefined): string | undefined {
  const n = work?.count ?? 0;
  if (work?.state === "uncommitted") return `${n} uncommitted file${n === 1 ? "" : "s"} exist${n === 1 ? "s" : ""} only in this worktree. Nothing has been shipped.`;
  if (work?.state === "unpushed") return `${n} commit${n === 1 ? "" : "s"} exist${n === 1 ? "s" : ""} only on this machine. Nothing has been pushed.`;
  if (work?.state === "pushed") return `The work is pushed but not merged into ${work.base ?? "the default branch"} as of your last fetch.`;
  return undefined;
}

export interface PullOffer {
  /** Whether the end-session dialog offers to pull at all: only a repository the pull action can run in. */
  offered: boolean;
  /** Whether that offer starts ticked. Merged work is the case the offer exists for. */
  preselected: boolean;
}

/**
 * Ending a session is the moment the user knows the work landed, so the dialog offers to bring the main checkout —
 * what archives, specs and progress are read from — up to date with it. Deliberately independent of whether the
 * worktree can be removed: a worktree kept for a reason should still let the checkout catch up.
 */
export function pullOffer(repo: Pick<RepoSnapshot, "isGit" | "ok"> | undefined, work: Pick<WorkStatus, "state"> | undefined): PullOffer {
  const offered = repo?.isGit === true && repo.ok === true;
  return { offered, preselected: offered && work?.state === "merged" };
}

/** The one session a card stands for, where only one fits (see `sessionsForChange`). */
export function sessionForChange(sessions: Session[], repoId: string, change: string): Session | undefined {
  return sessionsForChange(sessions, repoId, change)[0];
}

export interface SessionBadge {
  /** Leading glyph, kept apart from the words so it can be styled (and hidden from assistive technology) on its own. */
  icon?: string;
  /** True only while the terminal is producing output: the one state that is shown with motion. */
  live?: boolean;
  label: string;
  tone: "info" | "branch" | "success" | "warning" | "danger" | "";
  title: string;
}

/** How long a running session's terminal may stay silent before the badge says the session may need the user. */
export const NEEDS_YOU_AFTER_MS = 20_000;

/** A silence as the badge states it: seconds under a minute (`45s`), whole minutes from there on (`3m`). */
export function silenceDuration(ms: number): string {
  return ms < 60_000 ? `${Math.floor(ms / 1000)}s` : `${Math.floor(ms / 60_000)}m`;
}

/**
 * A terminal is a byte stream, so the dashboard cannot know that an agent works or waits for you. It can say whether
 * the terminal is printing or has fallen silent — decided by the time of its last output alone — and, when silent,
 * that the session may need you. Status is always words plus colour, so the two running states differ in their words.
 */
export function sessionBadge(session: Session, now = Date.now()): SessionBadge {
  if (session.state === "running") {
    const last = session.lastOutputAt ? Date.parse(session.lastOutputAt) : Number.NaN;
    const silent = Number.isNaN(last) ? 0 : now - last;
    if (silent > NEEDS_YOU_AFTER_MS) {
      const duration = silenceDuration(silent);
      return { icon: "◆", label: `may need you ${duration}`, tone: "warning", title: `the terminal has printed nothing for ${duration} — ${session.agentName} may be waiting for you` };
    }
    return { icon: "●", label: "working", live: true, tone: "info", title: `the terminal of ${session.agentName} is producing output` };
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

/**
 * Text plus colour, never colour alone. Nothing for `clean` and `missing`: there is nothing to say about them.
 * Everything short of merged is work in a branch, so it wears the branch role; stale overrides that with danger.
 */
export function workBadge(worktree: SessionWorktree, sessions: Session[], now = Date.now()): SessionBadge | undefined {
  const { state, count = 0, base } = worktree.work;
  const stale = staleAge(worktree, sessions, now);
  const tail = stale ? ` · ${stale}` : "";
  const waiting = stale ? ` — untouched for ${stale}` : "";
  if (state === "uncommitted") return { label: `✎ ${count} uncommitted${tail}`, tone: stale ? "danger" : "branch", title: `${plural(count, "file")} in the worktree ${count === 1 ? "is" : "are"} not committed${waiting}` };
  if (state === "unpushed") return { label: `↑ ${count} not pushed${tail}`, tone: stale ? "danger" : "branch", title: `${plural(count, "commit")} exist only on this machine${waiting}` };
  if (state === "pushed") return { label: `⇡ pushed${tail}`, tone: stale ? "warning" : "branch", title: `pushed, but not in ${base ?? "the default branch"} as of your last fetch${waiting}` };
  if (state === "merged") return { label: "✓ merged", tone: "success", title: `merged into ${base ?? "the default branch"} as of your last fetch — the worktree can be removed` };
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

/** The dock shows at most this many sessions side by side; the tab strip can hold more. */
export const MAX_SHOWN = 3;

/** `?session=a,b,c` in pane order: the first three distinct ids. A single id — the format of older links — is one pane. */
export function shownFromSearch(search: string): string[] {
  const ids = (new URLSearchParams(search).get(PARAM) ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  return [...new Set(ids)].slice(0, MAX_SHOWN);
}

/** Sets or clears `?session=` and keeps every other query parameter (board filters live there too). */
export function searchWithShown(search: string, shown: readonly string[]): string {
  const params = new URLSearchParams(search);
  if (shown.length > 0) params.set(PARAM, shown.join(","));
  else params.delete(PARAM);
  // Ids are UUIDs; a readable comma keeps deep links legible.
  const out = params.toString().replaceAll("%2C", ",");
  return out ? `?${out}` : "";
}

/** Dock geometry, in one place: the dock never gets too small for a terminal, the board above it never too small to use. */
export const DOCK_MIN_HEIGHT = 160;
export const DOCK_MIN_BOARD = 120;
export const DOCK_TABS_HEIGHT = 36;
export const DOCK_DEFAULT_RATIO = 0.42;

export function clampDockHeight(height: number, windowHeight: number): number {
  return Math.round(Math.min(Math.max(height, DOCK_MIN_HEIGHT), Math.max(DOCK_MIN_HEIGHT, windowHeight - DOCK_MIN_BOARD)));
}

export interface Shown {
  shown: string[];
  focusedId?: string;
}

/**
 * "Show this session": focus it if it has a pane already, give it a new pane while there is room, otherwise replace the
 * pane the user is in (the one they are looking at when asking for another session) — the last one if none has focus.
 */
export function showSession({ shown, focusedId }: Shown, id: string): Shown {
  if (shown.includes(id)) return { shown, focusedId: id };
  if (shown.length < MAX_SHOWN) return { shown: [...shown, id], focusedId: id };
  const at = focusedId !== undefined && shown.includes(focusedId) ? shown.indexOf(focusedId) : shown.length - 1;
  return { shown: shown.map((other, i) => (i === at ? id : other)), focusedId: id };
}

/** Removes a pane (never a session); the keyboard moves to the pane that takes its place, else the one before. */
export function hideSession({ shown, focusedId }: Shown, id: string): Shown {
  const at = shown.indexOf(id);
  if (at < 0) return { shown, focusedId };
  const rest = shown.filter((other) => other !== id);
  return { shown: rest, focusedId: focusedId === id ? (rest[at] ?? rest[at - 1]) : focusedId };
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
