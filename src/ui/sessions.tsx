// Agent sessions in the UI: a provider that polls the session list while the feature is on, and the controls a
// card shows (starter buttons, or a badge that opens the session panel).
import { createContext, type ComponentChildren } from "preact";
import { useCallback, useContext, useEffect, useMemo, useState } from "preact/hooks";
import { changeSessions, isConsole, isIntegration, type AgentAvailability, type ChangeSession, type ChangeSnapshot, type Config, type ConsoleSession, type IntegrationSession, type SessionAction, type SessionWorktree, type Snapshot } from "../shared/types.ts";
import { api } from "./api.ts";
import { cdCommand, relTime } from "./format.ts";
import { assignRepoHues, repoTint } from "./repoGroups.ts";
import { agentForRepo, cardSessionControls, openWork, type SessionBadge, nextStepFor, sessionBadge, sessionsEnabledFor, workBadge, worktreeForChange } from "./sessionState.ts";
import { boardFrom, changePath, CONSOLE_TAB, parseDetailQuery, routeFromPath, serializeDetailQuery } from "./routes.ts";
import { currentPath, currentQuery, navigate } from "./url.ts";

const POLL_MS = 3000;

interface SessionUi {
  config: Config | null;
  snapshot: Snapshot | null;
  /** Sessions of changes: everything about repositories, cards and Open work reads these and only these. */
  sessions: ChangeSession[];
  /** Main console sessions, newest first; they belong to no repository and are shown only in the console overlay. */
  consoles: ConsoleSession[];
  /** Whether the main console overlay is open. Not part of the route: the console is not a place in the app. */
  consoleOpen: boolean;
  showConsole(open: boolean): void;
  /** Sessions setting a repository up for OpenSpec, newest first; they belong to no repository in the config. */
  integrations: IntegrationSession[];
  /** The integration session whose overlay is open, if any. Like the console, not part of the route. */
  integrationId?: string;
  showIntegration(id: string | undefined): void;
  agents: AgentAvailability[];
  /** Every session worktree with what became of its work; outlives session records. */
  worktrees: SessionWorktree[];
  /** The session the end-session dialog is open for. */
  endingId?: string;
  /** Bumped whenever the terminal should take the keyboard (after something was typed into it for the user). */
  focusTick: { id?: string; tick: number };
  /** The session whose last text sent on the user's behalf was typed but not submitted; its panel says so. */
  unsentId?: string;
  reportUnsent(id: string | undefined): void;
  /** Opens the end-session dialog; nothing is ended before the user confirms there. */
  requestEnd(id: string | undefined): void;
  /** The polling error, if the session list could not be read. */
  error?: string;
  /** Shows a session: navigates to its change's detail view with the Console tab selected. */
  openPanel(id: string | undefined): void;
  /**
   * Starts a session, or sends the next step into the change's running one. Resolves with the reason when the request
   * was refused and no session exists to report it — the caller shows it where the starter was activated.
   */
  start(repoId: string, change: string, action: SessionAction): Promise<string | undefined>;
  refresh(): Promise<void>;
}

const noop = async () => undefined;
const Context = createContext<SessionUi>({ config: null, snapshot: null, sessions: [], consoles: [], consoleOpen: false, showConsole: () => {}, integrations: [], showIntegration: () => {}, agents: [], worktrees: [], focusTick: { tick: 0 }, reportUnsent: () => {}, requestEnd: () => {}, openPanel: () => {}, start: noop, refresh: noop });

export const useSessionUi = () => useContext(Context);

/**
 * `consoleOpen` is owned by the app shell, which also has to make the page behind the console overlay inert; it is
 * passed through here so the top-bar control and the overlay can reach it.
 */
export function SessionProvider({
  config,
  snapshot = null,
  consoleOpen = false,
  showConsole = () => {},
  integrationId,
  showIntegration = () => {},
  children,
}: {
  config: Config | null;
  snapshot?: Snapshot | null;
  consoleOpen?: boolean;
  showConsole?: (open: boolean) => void;
  integrationId?: string;
  showIntegration?: (id: string | undefined) => void;
  children: ComponentChildren;
}) {
  const enabled = config?.agentSessions.enabled === true;
  const [sessions, setSessions] = useState<ChangeSession[]>([]);
  const [consoles, setConsoles] = useState<ConsoleSession[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationSession[]>([]);
  const [agents, setAgents] = useState<AgentAvailability[]>([]);
  const [worktrees, setWorktrees] = useState<SessionWorktree[]>([]);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const result = await api.sessions();
      setSessions(changeSessions(result.sessions));
      setConsoles(result.sessions.filter(isConsole));
      setIntegrations(result.sessions.filter(isIntegration));
      setAgents(result.agents);
      setWorktrees(result.worktrees ?? []);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, refresh]);

  /**
   * A session belongs to one change, so showing a terminal is a navigation to that change's detail view with its
   * Console tab selected. `from` keeps the board to return to: the one on screen, or — when another change's detail
   * view is already open — whatever board that one was opened from.
   */
  const openConsole = useCallback((repoId: string, change: string, sessionId: string) => {
    const path = currentPath();
    const view = routeFromPath(path).view;
    const from = view === "board" || view === "repo" ? boardFrom(path, currentQuery()) : parseDetailQuery(currentQuery()).from;
    navigate(changePath(repoId, change), serializeDetailQuery({ raw: false, artifact: CONSOLE_TAB, session: sessionId, from }));
  }, []);

  /** "Show this session" — every caller's way to a terminal, by id. */
  const openPanel = useCallback(
    (id: string | undefined) => {
      const session = id ? sessions.find((s) => s.id === id) : undefined;
      if (session) openConsole(session.repoId, session.change, session.id);
    },
    [sessions, openConsole],
  );

  const [endingId, requestEnd] = useState<string>();
  const [focusTick, setFocusTick] = useState<{ id?: string; tick: number }>({ tick: 0 });
  const [unsentId, reportUnsent] = useState<string>();

  const start = useCallback(
    async (repoId: string, change: string, action: SessionAction) => {
      try {
        const into = nextStepFor(sessions, repoId, change).promptSessionId;
        const session = into ? await api.promptSession(into, action) : await api.openSession(repoId, change, action);
        if (into) {
          // Sent under the rules for text sent on the user's behalf: say so when the agent never showed it.
          reportUnsent("submitted" in session && !session.submitted ? into : undefined);
          setFocusTick((t) => ({ id: into, tick: t.tick + 1 }));
        }
        await refresh();
        // By id and place, not through `openPanel`: a session just started is not in this closure's list yet.
        openConsole(repoId, change, session.id);
        return undefined;
      } catch (err) {
        // A start that failed has no session and so no panel to report itself in: the reason goes back to the caller,
        // which shows it next to the starter. Not the provider's `error` — the poll clears that within seconds.
        return err instanceof Error ? err.message : String(err);
      }
    },
    [refresh, openConsole, sessions, reportUnsent],
  );

  const shown = consoleOpen && enabled;
  const value = useMemo(
    () => ({ config, snapshot, sessions, consoles, consoleOpen: shown, showConsole, integrations, integrationId, showIntegration, agents, worktrees, endingId, focusTick, unsentId, reportUnsent, requestEnd, error, openPanel, start, refresh }),
    [config, snapshot, sessions, consoles, shown, integrations, integrationId, showIntegration, agents, worktrees, endingId, focusTick, unsentId, error, openPanel, start, refresh],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/**
 * The one place a session badge is drawn, so cards and the panel cannot drift apart. `live` adds the motion that means
 * "an agent is working now"; the glyph is decoration, the words carry the status.
 */
export function SessionBadgeView({ badge, onClick }: { badge: SessionBadge; onClick?: () => void }) {
  const cls = `badge ${onClick ? "session-badge " : ""}${badge.tone}${badge.live ? " live" : ""}`;
  const content = (
    <>
      {badge.icon && (
        <span class="dot" aria-hidden="true">
          {badge.icon}
        </span>
      )}
      <span class="text">{badge.label}</span>
    </>
  );
  return onClick ? (
    <button type="button" class={cls} title={badge.title} onClick={onClick}>
      {content}
    </button>
  ) : (
    <span class={cls} title={badge.title}>
      {content}
    </span>
  );
}

/** What became of the work in a worktree. Opens the worktree's latest session when its record still exists. */
export function WorkBadge({ worktree }: { worktree: SessionWorktree }) {
  const ui = useSessionUi();
  const badge = workBadge(worktree, ui.sessions);
  if (!badge) return null;
  const id = worktree.sessionId;
  if (!id)
    return (
      <span class={`badge ${badge.tone}`} title={`${badge.title} · no session record is left`}>
        {badge.label}
      </span>
    );
  return (
    <button type="button" class={`badge session-badge ${badge.tone}`} title={badge.title} onClick={() => ui.openPanel(id)}>
      {badge.label}
    </button>
  );
}

function OrphanActions({ worktree }: { worktree: SessionWorktree }) {
  const ui = useSessionUi();
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<string>();
  const remove = async () => {
    try {
      const result = await api.removeWorktree(worktree.repoId, worktree.name);
      setNote(result.removable ? undefined : `kept: ${result.reason ?? "not safe to remove"}`);
      await ui.refresh();
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err));
    }
    setConfirming(false);
  };
  return (
    <>
      <button type="button" class="btn sm ghost" title={worktree.path} onClick={() => void navigator.clipboard.writeText(cdCommand(worktree.path))}>
        Copy cd
      </button>
      {confirming ? (
        <button type="button" class="btn sm primary" title="Removed only if it is clean and its work is merged or exists elsewhere; the branch stays" onClick={() => void remove()}>
          Confirm remove
        </button>
      ) : (
        <button type="button" class="btn sm ghost" onClick={() => setConfirming(true)}>
          Remove…
        </button>
      )}
      {note && <span class="hint">{note}</span>}
    </>
  );
}

/**
 * Top-bar control, and the only view of agent activity that spans repositories now that each terminal lives in its
 * change's detail view. It lists the sessions running right now — including in-place ones, which have no worktree —
 * and then every worktree that still holds work with no session running, which is the only way to reach a worktree
 * whose change has left the board. Every row with a session opens that change's Console tab.
 */
export function OpenWork() {
  const ui = useSessionUi();
  const [open, setOpen] = useState(false);
  const { items, unshipped, running } = useMemo(() => openWork(ui.worktrees, ui.sessions), [ui.worktrees, ui.sessions]);
  const hues = useMemo(() => assignRepoHues((ui.snapshot?.repos ?? []).map((r) => r.id)), [ui.snapshot]);
  if (!ui.config?.agentSessions.enabled || items.length === 0) return null;
  const repoName = (id: string) => ui.config?.repos.find((r) => r.id === id)?.name ?? id;
  return (
    <div class="open-work">
      <button
        type="button"
        class={`btn sm ${unshipped > 0 ? "attention" : running > 0 ? "" : "ghost"}`}
        aria-expanded={open}
        title="Agents running right now, and work in agent worktrees that has not ended in a merged pull request"
        onClick={() => setOpen(!open)}
      >
        Open work {running + unshipped > 0 ? running + unshipped : "✓"}
      </button>
      {open && (
        <div class="open-work-list" role="dialog" aria-label="Open work">
          <div class="hint">Read from local git only — “pushed” and “merged” are as of your last fetch.</div>
          {items.map((item) => {
            const { session, worktree } = item;
            const tint = repoTint(hues, item.repoId);
            const age = session ? relTime(session.createdAt) : worktree?.lastActivityAt ? relTime(worktree.lastActivityAt) : undefined;
            return (
              <div class={`open-work-row${tint.class ? ` ${tint.class}` : ""}`} style={tint.style} key={item.key}>
                <div class="open-work-what">
                  <span class="hint repo-name">
                    {repoName(item.repoId)}
                    {session && ` · ${session.action} · ${session.agentName}`}
                  </span>
                  <strong class="mono">{item.change}</strong>
                  {(session?.inPlace ? undefined : (session?.branch ?? worktree?.branch)) && <span class="hint mono">{session?.branch ?? worktree?.branch}</span>}
                </div>
                {session?.state === "running" && <SessionBadgeView badge={sessionBadge(session)} />}
                {worktree && <WorkBadge worktree={worktree} />}
                <span class="hint">{age === undefined ? "" : session ? (age === "just now" ? "started just now" : `started ${age} ago`) : `${age} ago`}</span>
                {session ? (
                  <button
                    type="button"
                    class="btn sm"
                    title={`Opens ${item.change} in its detail view, on the Console tab`}
                    onClick={() => {
                      setOpen(false);
                      ui.openPanel(session.id);
                    }}
                  >
                    Open
                  </button>
                ) : (
                  worktree && <OrphanActions worktree={worktree} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const STARTER_LABEL: Record<SessionAction, string> = { draft: "Draft artifacts", implement: "Implement", validate: "Validate", archive: "Archive" };
const STARTER_HINT: Record<SessionAction, string> = {
  draft: "Start an agent in a terminal to write this change's missing artifacts",
  implement: "Start an agent in a terminal to implement this change's tasks",
  validate: "Start an agent in a terminal to walk you through this change's tasks awaiting validation",
  archive: "Start an agent in a terminal to sync the specs and archive this completed change",
};

/**
 * A change's session state and its next step, in one place so the two can never disagree: the session badge (working,
 * may need you, failed) and the starters. Rendered in a card's footer, and in the Console tab of a change no agent has
 * worked on yet. Shows nothing at all unless the feature is on and the repository has not been switched off.
 *
 * While any of the change's sessions runs, the badge stands in for the starters and nothing else is offered: the badge
 * opens the terminal, which is where the next step and **End session** live. A badge that is not running is the failure
 * case, so it keeps its starters — the next attempt stays one activation away. The work status is the detail view's
 * (see `WorkStatus`), never a card's.
 */
export function SessionControls({ card }: { card: Pick<ChangeSnapshot, "repoId" | "name" | "archived" | "artifacts" | "stage" | "subState"> }) {
  const ui = useSessionUi();
  const [starting, setStarting] = useState<SessionAction>();
  const [failure, setFailure] = useState<string>();
  if (!sessionsEnabledFor(ui.config, card.repoId)) return null;

  const { shown, starters } = cardSessionControls(ui.config, ui.sessions, card);
  const agent = agentForRepo(ui.config, card.repoId);
  const found = ui.agents.find((a) => a.id === agent?.id);
  const unavailable = found && !found.available ? `${found.name} was not found on this machine — check its command in Settings` : undefined;
  return (
    <>
      {shown.map((session) => (
        <SessionBadgeView key={session.id} badge={sessionBadge(session)} onClick={() => ui.openPanel(session.id)} />
      ))}
      {starters.map((action) => (
        // Always an opening: a card offers no starter while a session runs, so `start` never types into one from here.
        <button
          type="button"
          class="btn sm session-start"
          key={action}
          title={unavailable ?? `${STARTER_HINT[action]} (${agent?.name})`}
          disabled={Boolean(unavailable) || starting !== undefined}
          onClick={async () => {
            setStarting(action);
            setFailure(undefined);
            setFailure(await ui.start(card.repoId, card.name, action));
            setStarting(undefined);
          }}
        >
          {starting === action ? "Starting…" : `▶ ${STARTER_LABEL[action]}`}
        </button>
      ))}
      {failure && (
        <span class="notice danger session-failure" role="status">
          {failure}
        </span>
      )}
    </>
  );
}

/** The work status of a change's session worktree, for the detail view's header; nothing when there is none to show. */
export function WorkStatus({ repoId, name }: { repoId: string; name: string }) {
  const ui = useSessionUi();
  if (!sessionsEnabledFor(ui.config, repoId)) return null;
  const worktree = worktreeForChange(ui.worktrees, repoId, name);
  return worktree ? <WorkBadge worktree={worktree} /> : null;
}
