// Agent sessions in the UI: a provider that polls the session list while the feature is on, and the controls a
// card shows (starter buttons, or a badge that opens the session panel).
import { createContext, type ComponentChildren } from "preact";
import { useCallback, useContext, useEffect, useMemo, useState } from "preact/hooks";
import type { AgentAvailability, ChangeSnapshot, Config, Session, SessionAction, SessionWorktree, Snapshot } from "../shared/types.ts";
import { api } from "./api.ts";
import { cdCommand, relTime } from "./format.ts";
import { agentForRepo, openWork, type SessionBadge, hideSession, nextStepFor, searchWithShown, sessionBadge, sessionsForChange, showSession, shownFromSearch, type Shown, sessionsEnabledFor, startersFor, workBadge, worktreeForChange } from "./sessionState.ts";
import { currentQuery, replaceQuery } from "./url.ts";

const POLL_MS = 3000;

interface SessionUi {
  config: Config | null;
  snapshot: Snapshot | null;
  sessions: Session[];
  agents: AgentAvailability[];
  /** Every session worktree with what became of its work; outlives session records. */
  worktrees: SessionWorktree[];
  /** Sessions with a pane in the dock, in pane order (at most three). */
  shown: string[];
  /** The pane that has, or last had, the keyboard. */
  panelId?: string;
  /** Removes a pane from the dock; the session itself is not touched. */
  hidePane(id: string): void;
  /** A pane took the keyboard. */
  focusPane(id: string): void;
  /** The session the end-session dialog is open for. */
  endingId?: string;
  /** Bumped whenever the terminal should take the keyboard (after something was typed into it for the user). */
  focusTick: { id?: string; tick: number };
  /** The session whose last text sent on the user's behalf was typed but not submitted; its panel says so. */
  unsentId?: string;
  reportUnsent(id: string | undefined): void;
  /** Opens the end-session dialog; nothing is ended before the user confirms there. */
  requestEnd(id: string | undefined): void;
  error?: string;
  openPanel(id: string | undefined): void;
  start(repoId: string, change: string, action: SessionAction): Promise<void>;
  refresh(): Promise<void>;
}

const noop = async () => {};
const Context = createContext<SessionUi>({ config: null, snapshot: null, sessions: [], agents: [], worktrees: [], shown: [], hidePane: () => {}, focusPane: () => {}, focusTick: { tick: 0 }, reportUnsent: () => {}, requestEnd: () => {}, openPanel: () => {}, start: noop, refresh: noop });

export const useSessionUi = () => useContext(Context);

export function SessionProvider({ config, snapshot = null, children }: { config: Config | null; snapshot?: Snapshot | null; children: ComponentChildren }) {
  const enabled = config?.agentSessions.enabled === true;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [agents, setAgents] = useState<AgentAvailability[]>([]);
  const [worktrees, setWorktrees] = useState<SessionWorktree[]>([]);
  const [error, setError] = useState<string>();
  const [panes, setPanes] = useState<Shown>(() => {
    const shown = shownFromSearch(currentQuery());
    return { shown, focusedId: shown[0] };
  });
  const [loaded, setLoaded] = useState(false);
  const { shown, focusedId: panelId } = panes;
  const anyShown = shown.length > 0;

  const refresh = useCallback(async () => {
    try {
      const result = await api.sessions();
      setSessions(result.sessions);
      setAgents(result.agents);
      setWorktrees(result.worktrees ?? []);
      setLoaded(true);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    if (!enabled && !anyShown) return;
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, anyShown, refresh]);

  // The URL follows the panes (works in both routing modes: path and hash).
  useEffect(() => {
    replaceQuery(searchWithShown(currentQuery(), shown));
  }, [shown]);

  // Ids from a link that match no session are dropped — once the list is known, or a reload would lose its panes.
  useEffect(() => {
    if (!loaded) return;
    setPanes((current) => {
      const known = current.shown.filter((id) => sessions.some((s) => s.id === id));
      if (known.length === current.shown.length) return current;
      return { shown: known, focusedId: known.includes(current.focusedId ?? "") ? current.focusedId : known[0] };
    });
  }, [loaded, sessions]);

  /** "Show this session" — every caller's way into the dock. `undefined` collapses the dock to its tab strip. */
  const openPanel = useCallback((id: string | undefined) => setPanes((current) => (id ? showSession(current, id) : { shown: [] })), []);
  const hidePane = useCallback((id: string) => setPanes((current) => hideSession(current, id)), []);
  const focusPane = useCallback((id: string) => setPanes((current) => (current.focusedId === id || !current.shown.includes(id) ? current : { ...current, focusedId: id })), []);

  const [endingId, requestEnd] = useState<string>();
  const [focusTick, setFocusTick] = useState<{ id?: string; tick: number }>({ tick: 0 });
  const [unsentId, reportUnsent] = useState<string>();

  const start = useCallback(
    async (repoId: string, change: string, action: SessionAction) => {
      try {
        const into = nextStepFor(sessions, repoId, change, action).promptSessionId;
        const session = into ? await api.promptSession(into, action) : await api.openSession(repoId, change, action);
        if (into) {
          // Sent under the rules for text sent on the user's behalf: say so when the agent never showed it.
          reportUnsent("submitted" in session && !session.submitted ? into : undefined);
          setFocusTick((t) => ({ id: into, tick: t.tick + 1 }));
        }
        await refresh();
        openPanel(session.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [refresh, openPanel, sessions, reportUnsent],
  );

  const value = useMemo(() => ({ config, snapshot, sessions, agents, worktrees, shown, hidePane, focusPane, panelId, endingId, focusTick, unsentId, reportUnsent, requestEnd, error, openPanel, start, refresh }), [config, snapshot, sessions, agents, worktrees, shown, hidePane, focusPane, panelId, endingId, focusTick, unsentId, error, openPanel, start, refresh]);
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
      <span class={`badge ${badge.tone}`} title={`${badge.title} · no session record is left; see Open work`}>
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

/** Top-bar control: every worktree whose work is not shipped yet, or is merged and still lying around. */
export function OpenWork() {
  const ui = useSessionUi();
  const [open, setOpen] = useState(false);
  const { items, unshipped } = useMemo(() => openWork(ui.worktrees, ui.sessions), [ui.worktrees, ui.sessions]);
  if (!ui.config?.agentSessions.enabled || items.length === 0) return null;
  const repoName = (id: string) => ui.config?.repos.find((r) => r.id === id)?.name ?? id;
  return (
    <div class="open-work">
      <button type="button" class={`btn sm ${unshipped > 0 ? "attention" : "ghost"}`} aria-expanded={open} title="Work in agent worktrees that has not ended in a merged pull request" onClick={() => setOpen(!open)}>
        Open work {unshipped > 0 ? unshipped : "✓"}
      </button>
      {open && (
        <div class="open-work-list" role="dialog" aria-label="Open work">
          <div class="hint">Read from local git only — “pushed” and “merged” are as of your last fetch.</div>
          {items.map((w) => (
            <div class="open-work-row" key={w.path}>
              <div class="open-work-what">
                <span class="hint">{repoName(w.repoId)}</span>
                <strong class="mono">{w.change}</strong>
                {w.branch && <span class="hint mono">{w.branch}</span>}
              </div>
              <WorkBadge worktree={w} />
              <span class="hint">{w.lastActivityAt ? `${relTime(w.lastActivityAt)} ago` : ""}</span>
              {w.sessionId ? (
                <button
                  type="button"
                  class="btn sm"
                  onClick={() => {
                    setOpen(false);
                    ui.openPanel(w.sessionId);
                  }}
                >
                  Open
                </button>
              ) : (
                <OrphanActions worktree={w} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const STARTER_LABEL: Record<SessionAction, string> = { draft: "Draft artifacts", implement: "Implement", archive: "Archive" };
const STARTER_HINT: Record<SessionAction, string> = {
  draft: "Start an agent in a terminal to write this change's missing artifacts",
  implement: "Start an agent in a terminal to implement this change's tasks",
  archive: "Start an agent in a terminal to sync the specs and archive this completed change",
};

/** Rendered inside a card. Shows nothing at all unless the feature is on and the card's repository has not been switched off. */
export function SessionControls({ card }: { card: Pick<ChangeSnapshot, "repoId" | "name" | "archived" | "artifacts" | "stage"> }) {
  const ui = useSessionUi();
  const [starting, setStarting] = useState<SessionAction>();
  if (!sessionsEnabledFor(ui.config, card.repoId)) return null;

  const worktree = worktreeForChange(ui.worktrees, card.repoId, card.name);
  const shown = sessionsForChange(ui.sessions, card.repoId, card.name);
  const agent = agentForRepo(ui.config, card.repoId);
  const found = ui.agents.find((a) => a.id === agent?.id);
  const unavailable = found && !found.available ? `${found.name} was not found on this machine — check its command in Settings` : undefined;
  return (
    <>
      {shown.map((session) => (
        <span class="session-chip" key={session.id}>
          <SessionBadgeView badge={sessionBadge(session)} onClick={() => ui.openPanel(session.id)} />
          {session.state === "running" && (
            <button type="button" class="badge-x" aria-label={`End the session for ${session.change}`} title="End this session…" onClick={() => ui.requestEnd(session.id)}>
              ✕
            </button>
          )}
        </span>
      ))}
      {worktree && <WorkBadge worktree={worktree} />}
      {startersFor(ui.config, card).map((action) => {
        // The change's running session is sent the next step; only archiving always starts its own.
        const step = nextStepFor(ui.sessions, card.repoId, card.name, action);
        if (step.blocked) return null;
        const intoRunning = step.promptSessionId !== undefined;
        const blockedBy = intoRunning ? undefined : unavailable;
        return (
          <button
            type="button"
            class="btn sm session-start"
            key={action}
            title={blockedBy ?? (intoRunning ? `Sends the “${STARTER_LABEL[action]}” prompt to the running session` : `${STARTER_HINT[action]} (${agent?.name})`)}
            disabled={Boolean(blockedBy) || starting !== undefined}
            onClick={async () => {
              setStarting(action);
              await ui.start(card.repoId, card.name, action);
              setStarting(undefined);
            }}
          >
            {starting === action ? "Starting…" : `${intoRunning ? "↳" : "▶"} ${STARTER_LABEL[action]}`}
          </button>
        );
      })}
    </>
  );
}
