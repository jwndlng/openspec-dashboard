// Agent sessions in the UI: a provider that polls the session list while the feature is on, and the controls a
// card shows (starter buttons, or a badge that opens the session panel).
import { createContext, type ComponentChildren } from "preact";
import { useCallback, useContext, useEffect, useMemo, useState } from "preact/hooks";
import type { AgentAvailability, ChangeSnapshot, Config, Session, SessionAction } from "../shared/types.ts";
import { api } from "./api.ts";
import { agentForRepo, searchWithSession, sessionBadge, sessionForChange, sessionIdFromSearch, sessionsEnabledFor, startersFor } from "./sessionState.ts";
import { currentQuery, replaceQuery } from "./url.ts";

const POLL_MS = 3000;

interface SessionUi {
  config: Config | null;
  sessions: Session[];
  agents: AgentAvailability[];
  panelId?: string;
  error?: string;
  openPanel(id: string | undefined): void;
  start(repoId: string, change: string, action: SessionAction): Promise<void>;
  refresh(): Promise<void>;
}

const noop = async () => {};
const Context = createContext<SessionUi>({ config: null, sessions: [], agents: [], openPanel: () => {}, start: noop, refresh: noop });

export const useSessionUi = () => useContext(Context);

export function SessionProvider({ config, children }: { config: Config | null; children: ComponentChildren }) {
  const enabled = config?.agentSessions.enabled === true;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [agents, setAgents] = useState<AgentAvailability[]>([]);
  const [error, setError] = useState<string>();
  const [panelId, setPanelId] = useState<string | undefined>(() => sessionIdFromSearch(currentQuery()));

  const refresh = useCallback(async () => {
    try {
      const result = await api.sessions();
      setSessions(result.sessions);
      setAgents(result.agents);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    if (!enabled && !panelId) return;
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, panelId, refresh]);

  const openPanel = useCallback((id: string | undefined) => {
    setPanelId(id);
    replaceQuery(searchWithSession(currentQuery(), id)); // works in both routing modes (path and hash)
  }, []);

  const start = useCallback(
    async (repoId: string, change: string, action: SessionAction) => {
      try {
        const session = await api.openSession(repoId, change, action);
        await refresh();
        openPanel(session.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [refresh, openPanel],
  );

  const value = useMemo(() => ({ config, sessions, agents, panelId, error, openPanel, start, refresh }), [config, sessions, agents, panelId, error, openPanel, start, refresh]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

const STARTER_LABEL: Record<SessionAction, string> = { draft: "Draft artifacts", implement: "Implement", archive: "Archive" };
const STARTER_HINT: Record<SessionAction, string> = {
  draft: "Start an agent in a terminal to write this change's missing artifacts",
  implement: "Start an agent in a terminal to implement this change's tasks",
  archive: "Start an agent in a terminal to archive this completed change",
};

/** Rendered inside a card. Shows nothing at all unless the feature is on and the card's repository has not been switched off. */
export function SessionControls({ card }: { card: Pick<ChangeSnapshot, "repoId" | "name" | "archived" | "artifacts" | "stage"> }) {
  const ui = useSessionUi();
  const [starting, setStarting] = useState<SessionAction>();
  if (!sessionsEnabledFor(ui.config, card.repoId)) return null;

  const session = sessionForChange(ui.sessions, card.repoId, card.name);
  if (session) {
    const badge = sessionBadge(session);
    return (
      <button type="button" class={`badge session-badge ${badge.tone}`} title={badge.title} onClick={() => ui.openPanel(session.id)}>
        {badge.label}
      </button>
    );
  }

  const actions = startersFor(ui.config, card);
  if (actions.length === 0) return null;
  const agent = agentForRepo(ui.config, card.repoId);
  const found = ui.agents.find((a) => a.id === agent?.id);
  const unavailable = found && !found.available ? `${found.name} was not found on this machine — check its command in Settings` : undefined;
  return (
    <>
      {actions.map((action) => (
        <button
          type="button"
          class="btn sm session-start"
          key={action}
          title={unavailable ?? `${STARTER_HINT[action]} (${agent?.name})`}
          disabled={Boolean(unavailable) || starting !== undefined}
          onClick={async () => {
            setStarting(action);
            await ui.start(card.repoId, card.name, action);
            setStarting(undefined);
          }}
        >
          {starting === action ? "Starting…" : `▶ ${STARTER_LABEL[action]}`}
        </button>
      ))}
    </>
  );
}
