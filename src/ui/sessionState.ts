// Pure helpers for the agent-session UI; free of DOM access at import time so they can be unit-tested.
import { availableActions, isChangeless, repoAgentEnabled, SHIPPABLE_WORK, type AgentProfile, type ChangeSnapshot, type Config, type RepoSnapshot, type ChangeSession, changeSessions, type ConsoleSession, type Session, type SessionAction, type SessionWorktree, type WorkStatus } from "../shared/types.ts";

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
export function startersFor(config: Config | null, card: Pick<ChangeSnapshot, "repoId" | "archived" | "artifacts" | "stage" | "subState">): SessionAction[] {
  const agent = agentForRepo(config, card.repoId);
  if (!agent) return [];
  return availableActions(card).filter((action) => Boolean(agent.prompts[action]));
}

/**
 * The sessions a card shows: the running one (a change has at most one), otherwise the most recent one if it did not
 * end cleanly. A list, not a single session, because records from before the one-session-per-change rule may still
 * show two running for one change until they end.
 */
export function sessionsForChange(sessions: ChangeSession[], repoId: string, change: string): ChangeSession[] {
  const mine = sessions.filter((s) => s.repoId === repoId && s.change === change).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const running = mine.filter((s) => s.state === "running");
  if (running.length > 0) return running;
  const latest = mine[0];
  return latest && (latest.state === "failed" || (latest.exitCode ?? 0) !== 0) ? [latest] : [];
}

/**
 * What a card offers about its change's sessions: the sessions to show a badge for, and the starters to offer beside
 * them. While any of the change's sessions runs the badge stands in for the starters and there are none — the badge
 * opens the terminal, which is where the next step and **End session** live. A badge that is not running is the failure
 * case `sessionsForChange` keeps, so it comes with the starters and the next attempt stays one activation away.
 *
 * Pure, because this is the rule the card and the console's empty state must agree on, and a component that uses hooks
 * cannot be asserted on without a renderer.
 */
export function cardSessionControls(
  config: Config | null,
  sessions: ChangeSession[],
  card: Pick<ChangeSnapshot, "repoId" | "name" | "archived" | "artifacts" | "stage" | "subState">,
): { shown: ChangeSession[]; starters: SessionAction[] } {
  if (!sessionsEnabledFor(config, card.repoId)) return { shown: [], starters: [] };
  const shown = sessionsForChange(sessions, card.repoId, card.name);
  return { shown, starters: shown.some((s) => s.state === "running") ? [] : startersFor(config, card) };
}

/** Where a starter is rendered: in a card's footer on a board, or in a change's Console tab. */
export type StarterPlace = "card" | "console";

/**
 * Whether starting a session shows its console afterwards. A card never navigates: the user starts work and stays on
 * the board, where the card's badge takes the starter's place and opens the console on demand. In the Console tab the
 * user is already looking at the console, so the started session is shown there.
 */
export function startShowsConsole(place: StarterPlace): boolean {
  return place === "console";
}

/**
 * Where a starter goes: into the change's running session (the prompt is typed there), or into a new session. The
 * action does not enter into it — one change has one console, and every action the stage allows is sent to it,
 * Archive included. Only the console's next-step buttons ask: a card offers no starter while a session runs (see
 * `cardSessionControls`).
 */
export function nextStepFor(sessions: ChangeSession[], repoId: string, change: string): { promptSessionId?: string } {
  return { promptSessionId: sessions.find((s) => s.repoId === repoId && s.change === change && s.state === "running")?.id };
}

/** When a session was last doing something: what it printed, else what happened to the record. */
const activityAt = (s: Session) => s.lastOutputAt ?? s.updatedAt ?? s.createdAt;

/**
 * Every session of one change, most recently active first: what the detail view's Console tab lists. Ended sessions
 * stay listed — their output is still readable and their worktree may still hold work.
 */
export function consoleSessions(sessions: ChangeSession[], repoId: string, change: string): ChangeSession[] {
  return sessions.filter((s) => s.repoId === repoId && s.change === change).sort((a, b) => activityAt(b).localeCompare(activityAt(a)));
}

/** The session the Console tab shows: the one the URL names while it is one of the change's, else the most recent. */
export function consoleSession(sessions: ChangeSession[], wanted: string | undefined): ChangeSession | undefined {
  return sessions.find((s) => s.id === wanted) ?? sessions[0];
}

/**
 * Whether a change has a console with something in it: a session record, or a worktree — which counts even without one
 * and outlives the change itself, and is why a change the snapshot no longer carries is shown rather than reported as
 * not found. Not the same question as `consoleTabAvailable`: this one has to stay narrow, or every name that is in no
 * snapshot would render an empty console frame instead of "not found".
 */
export function consoleAvailable(config: Config | null, sessions: ChangeSession[], worktrees: SessionWorktree[], repoId: string, change: string): boolean {
  if (!sessionsEnabledFor(config, repoId)) return false;
  return sessions.some((s) => s.repoId === repoId && s.change === change) || worktrees.some((w) => w.repoId === repoId && w.change === change);
}

/**
 * Whether a change gets a Console tab, and its card the console quick link: one question, asked per repository, because
 * the tab now exists before any agent has run — with nothing to show it offers the change's starters. Deliberately
 * independent of the change: the way into a terminal is in the same place on every card.
 */
export function consoleTabAvailable(config: Config | null, repoId: string): boolean {
  return sessionsEnabledFor(config, repoId);
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

/**
 * The worktree a session's panel and dialogs speak for. An in-place session runs in the repository folder itself,
 * which is not a worktree: it has no work status, nothing to ship and nothing to remove, so it has none.
 */
export function worktreeOfSession(session: Pick<Session, "inPlace" | "worktreePath"> | undefined, worktrees: SessionWorktree[]): SessionWorktree | undefined {
  if (!session || session.inPlace) return undefined;
  return worktrees.find((w) => w.path === session.worktreePath);
}

/** Whether ending a session may offer to remove its worktree at all: an in-place session has none to remove. */
export function worktreeRemovalPossible(session: Pick<Session, "inPlace"> | undefined): boolean {
  return session !== undefined && !session.inPlace;
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
export function sessionForChange(sessions: ChangeSession[], repoId: string, change: string): ChangeSession | undefined {
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

/** Unshipped work nobody is working on: past its age limit and without a running session. */
export function staleAge(worktree: SessionWorktree, sessions: readonly Session[], now = Date.now()): string | undefined {
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
export function workBadge(worktree: SessionWorktree, sessions: readonly Session[], now = Date.now()): SessionBadge | undefined {
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

/**
 * The conflict badge, beside the work badge rather than replacing it: "pushed" and "no longer merges" are two different
 * facts about the same branch, and the user needs both. Warning, not danger: nothing is lost, the branch needs work.
 *
 * The wording always carries the freshness caveat, because the base is whatever the user last fetched (design D4).
 */
export function conflictBadge(worktree: SessionWorktree | undefined): SessionBadge | undefined {
  const conflicts = worktree?.work.conflicts;
  if (!conflicts) return undefined;
  const count = conflicts.files.length;
  const listed = conflicts.truncated ? `${count}+ files` : plural(count, "file");
  const names = conflicts.files.join(", ");
  return {
    icon: "⚠",
    label: `conflicts with ${conflicts.base}`,
    tone: "warning",
    title: `this branch no longer merges into ${conflicts.base} as of your last fetch — ${listed}: ${names}${conflicts.truncated ? ", and more" : ""}. Pull to refresh the base.`,
  };
}

/**
 * Whether Resolve conflicts is offered. The same predicate the server refuses by, expressed where the control lives —
 * an in-place session has no branch, and a worktree with no conflict signal has nothing to resolve.
 */
export function resolvable(session: Session | undefined, worktree: SessionWorktree | undefined): boolean {
  if (!session || isChangeless(session) || session.inPlace) return false;
  return worktree?.work.conflicts !== undefined;
}

/** The worktree a card stands for: the change's own one; its archive worktree only matters once that holds work. */
export function worktreeForChange(worktrees: SessionWorktree[], repoId: string, change: string): SessionWorktree | undefined {
  const mine = worktrees.filter((w) => w.repoId === repoId && w.change === change);
  return mine.find((w) => SHIPPABLE_WORK.includes(w.work.state)) ?? mine.find((w) => w.work.state === "merged");
}

/**
 * An archived change that still has to be pushed or merged: its agent worktree holds unshipped work, or its archive is
 * only in a linked worktree that is not known to be merged. Everything else — the main checkout holds the archive, or
 * there is no git — is wrapped up. From local git only, so "merged" is as of the user's last fetch or pull.
 */
export function archivePending(card: Pick<ChangeSnapshot, "repoId" | "name" | "checkout">, worktrees: readonly SessionWorktree[]): boolean {
  const mine = worktrees.filter((w) => w.repoId === card.repoId && w.change === card.name);
  if (mine.some((w) => SHIPPABLE_WORK.includes(w.work.state))) return true;
  return card.checkout?.isMain === false && !mine.some((w) => w.work.state === "merged");
}

/** One row of the Open work list: a running session, or a worktree that still holds something. */
export interface OpenWorkItem {
  key: string;
  repoId: string;
  change: string;
  /** Absent for an in-place session, which runs in the folder itself and has no worktree. */
  worktree?: SessionWorktree;
  session?: ChangeSession;
  /** Running sessions come first, then stale work, then the rest, then merged. */
  rank: number;
}

/**
 * The Open work list — the only view of agent activity that spans repositories now that terminals live in each
 * change's detail view, so it has to carry both kinds of thing.
 *
 * Sessions first, by session and not by worktree: an in-place session (a tracked folder that is not a git repository)
 * has no worktree at all, and would otherwise be missing from the one list that is supposed to find it. Then every
 * worktree that still holds work and has no running session — including worktrees whose change is gone from the board,
 * which no card can offer.
 */
export function openWork(worktrees: SessionWorktree[], all: readonly Session[], now = Date.now()): { items: OpenWorkItem[]; unshipped: number; running: number } {
  // The main console belongs to no repository and no change: it is never open work.
  const sessions = changeSessions(all);
  const live = sessions.filter((s) => s.state === "running").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const items: OpenWorkItem[] = live.map((session) => ({
    key: session.id,
    repoId: session.repoId,
    change: session.change,
    worktree: worktreeOfSession(session, worktrees),
    session,
    rank: 0,
  }));

  const taken = new Set(items.map((i) => i.worktree?.path).filter(Boolean));
  const left = worktrees
    .filter((w) => !taken.has(w.path) && (SHIPPABLE_WORK.includes(w.work.state) || w.work.state === "merged"))
    .map<OpenWorkItem>((worktree) => ({
      key: worktree.path,
      repoId: worktree.repoId,
      change: worktree.change,
      worktree,
      session: sessions.find((s) => s.id === worktree.sessionId),
      rank: staleAge(worktree, sessions, now) ? 1 : worktree.work.state === "merged" ? 3 : 2,
    }));
  left.sort((a, b) => a.rank - b.rank || (a.worktree?.lastActivityAt ?? "").localeCompare(b.worktree?.lastActivityAt ?? ""));

  // Each row counts once: a running session is "running", never also "unshipped", so the badge matches the rows.
  return { items: [...items, ...left], unshipped: left.filter((i) => i.worktree?.work.state !== "merged").length, running: items.length };
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

/**
 * The main console the overlay shows: the running one (there is at most one), else the one the overlay just opened or
 * last showed, else the most recent. An ended console stays readable until the user starts a new one.
 */
export function consoleToShow(consoles: readonly ConsoleSession[], preferred?: string): ConsoleSession | undefined {
  return consoles.find((s) => s.state === "running") ?? consoles.find((s) => s.id === preferred) ?? [...consoles].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export const CONSOLE_CONTROL_NAME = "Open the agent console";

/**
 * The top-bar console control's name and state. The state is the running console's badge — the same two running states
 * as every session, decided the same way — and is part of the name, so it is never shown by colour or motion alone.
 */
export function consoleControl(consoles: readonly ConsoleSession[], now = Date.now()): { name: string; title: string; badge?: SessionBadge } {
  const running = consoles.find((s) => s.state === "running");
  if (!running) return { name: CONSOLE_CONTROL_NAME, title: `${CONSOLE_CONTROL_NAME}: talk to your agent about anything that is not a change` };
  const badge = sessionBadge(running, now);
  return { name: `${CONSOLE_CONTROL_NAME} — ${badge.label}`, title: `${CONSOLE_CONTROL_NAME} — ${badge.title}`, badge };
}
