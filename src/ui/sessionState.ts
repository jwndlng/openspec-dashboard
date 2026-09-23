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

/** When a session was last doing something: what it printed, else what happened to the record. */
const activityAt = (s: Session) => s.lastOutputAt ?? s.updatedAt ?? s.createdAt;

/**
 * Every session of one change, most recently active first: what the detail view's Console tab lists. Ended sessions
 * stay listed — their output is still readable and their worktree may still hold work.
 */
export function consoleSessions(sessions: Session[], repoId: string, change: string): Session[] {
  return sessions.filter((s) => s.repoId === repoId && s.change === change).sort((a, b) => activityAt(b).localeCompare(activityAt(a)));
}

/** The session the Console tab shows: the one the URL names while it is one of the change's, else the most recent. */
export function consoleSession(sessions: Session[], wanted: string | undefined): Session | undefined {
  return sessions.find((s) => s.id === wanted) ?? sessions[0];
}

/**
 * Whether a change gets a Console tab at all. A worktree counts even without a session record, and outlives the change
 * itself — which is why a change the snapshot no longer carries is shown rather than reported as not found.
 */
export function consoleAvailable(config: Config | null, sessions: Session[], worktrees: SessionWorktree[], repoId: string, change: string): boolean {
  if (!sessionsEnabledFor(config, repoId)) return false;
  return sessions.some((s) => s.repoId === repoId && s.change === change) || worktrees.some((w) => w.repoId === repoId && w.change === change);
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

/**
 * The Open work list — the only view of agent activity that spans repositories now that terminals live in each
 * change's detail view. It holds every running session's worktree (whatever its work status, so a running agent is
 * always findable), everything unshipped, and merged worktrees still lying around. Running first, then stale, then the
 * rest, then merged; oldest first within each rank.
 */
export function openWork(worktrees: SessionWorktree[], sessions: Session[], now = Date.now()): { items: SessionWorktree[]; unshipped: number; running: number } {
  const runningIds = new Set(sessions.filter((s) => s.state === "running").map((s) => s.id));
  const isRunning = (w: SessionWorktree) => w.sessionId !== undefined && runningIds.has(w.sessionId);
  const items = worktrees.filter((w) => isRunning(w) || SHIPPABLE_WORK.includes(w.work.state) || w.work.state === "merged");
  const rank = (w: SessionWorktree) => (isRunning(w) ? 0 : staleAge(w, sessions, now) ? 1 : w.work.state === "merged" ? 3 : 2);
  items.sort((a, b) => rank(a) - rank(b) || (a.lastActivityAt ?? "").localeCompare(b.lastActivityAt ?? ""));
  // A running session's own worktree is counted as running, never a second time as unshipped: the count matches the rows.
  return { items, unshipped: items.filter((w) => !isRunning(w) && w.work.state !== "merged").length, running: items.filter(isRunning).length };
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
