// The main console: one agent session that belongs to no repository and no change, opened from the top bar. It runs
// the default agent without a prompt in the console folder; the user says what it is for. Everything change-related —
// Ship, work status, next steps, worktree removal, pull — is absent on purpose.
import { useEffect, useRef, useState } from "preact/hooks";
import type { ConsoleSession } from "../shared/types.ts";
import { api } from "./api.ts";
import { CloseButton, closeOnEscape, DetailOverlay } from "./changeDetail.tsx";
import { cdCommand } from "./format.ts";
import { IconTerminal } from "./icons.tsx";
import { Copy, TerminalView, useTerminalGeneration } from "./sessionPanel.tsx";
import { consoleControl, consoleToShow, sessionBadge } from "./sessionState.ts";
import { SessionBadgeView, useSessionUi } from "./sessions.tsx";

/** Top-bar control, beside the theme control. Shown only while agent sessions are enabled. */
export function ConsoleButton() {
  const ui = useSessionUi();
  if (!ui.config?.agentSessions.enabled) return null;
  const control = consoleControl(ui.consoles);
  const badge = control.badge;
  return (
    <button type="button" class="btn sm ghost console-btn" aria-label={control.name} title={control.title} onClick={() => ui.showConsole(true)}>
      <IconTerminal size={15} />
      {badge && <span class={`console-dot ${badge.tone}${badge.live ? " live" : ""}`} aria-hidden="true" />}
    </button>
  );
}

/** The overlay, in the same frame as a change's detail view. Mounted by the app shell outside the part that goes inert. */
export function ConsoleOverlay() {
  const ui = useSessionUi();
  if (!ui.consoleOpen) return null;
  return <ConsoleView onClose={() => ui.showConsole(false)} />;
}

function ConsoleView({ onClose }: { onClose: () => void }) {
  const ui = useSessionUi();
  const panel = useRef<HTMLDivElement>(null);
  // The session this overlay opened or showed, so a fresh one is shown before the next poll lists it.
  const [shownId, setShownId] = useState<string>();
  const [opened, setOpened] = useState<ConsoleSession>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const listed = consoleToShow(ui.consoles, shownId);
  const session = listed ?? (opened && opened.id === shownId ? opened : undefined);
  const generation = useTerminalGeneration(session);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
      await ui.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const start = () =>
    act(async () => {
      const started = await api.openConsole();
      setOpened(started);
      setShownId(started.id);
    });

  // Nothing to show at all: start one. A console that ended stays on screen until the user asks for a new one.
  const startedOnce = useRef(false);
  useEffect(() => {
    if (startedOnce.current || ui.consoles.length > 0) return;
    startedOnce.current = true;
    void start();
  }, []);

  useEffect(() => {
    const onKey = closeOnEscape(onClose);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Focus into the panel on open, back to the top-bar control on close (see ChangeDetail for why it waits a tick).
  const [opener] = useState(() => document.activeElement);
  useEffect(() => {
    panel.current?.focus();
    return () => {
      setTimeout(() => {
        if (opener instanceof HTMLElement && opener.isConnected && !opener.closest("[inert]")) opener.focus();
      }, 0);
    };
  }, [opener]);

  const running = session?.state === "running";
  return (
    <DetailOverlay label="Agent console" onClose={onClose} panelRef={panel}>
      <div class="repo-head detail-head console-head">
        <div class="row">
          <h1 class="crumbs">
            <IconTerminal size={18} />
            <span>Console</span>
          </h1>
          <CloseButton onClose={onClose} />
        </div>
        <p class="hint">Your default agent, outside every change — ask it anything, or have it spin off new work.</p>
      </div>
      <section class="console-pane main-console" aria-label="Agent console">
        <header class="session-head">
          <div class="row">
            {session && <span class="hint">{session.agentName}</span>}
            {session && (
              <span class="hint mono" title="The console folder: set it in Settings → Agent sessions">
                · {session.worktreePath}
              </span>
            )}
            {session && <SessionBadgeView badge={sessionBadge(session)} />}
          </div>
          <div class="row">
            {session && !running && session.resumable && (
              <button type="button" class="btn sm" disabled={busy} title="Start the agent again in the same folder, continuing its latest conversation" onClick={() => act(() => api.resumeSession(session.id))}>
                ▶ Resume
              </button>
            )}
            {session && !running && (
              <button type="button" class="btn sm" disabled={busy} title="Start a new console in the console folder" onClick={() => void start()}>
                New console
              </button>
            )}
            {running && !confirmEnd && (
              <button type="button" class="btn sm" onClick={() => setConfirmEnd(true)}>
                End session
              </button>
            )}
            {running && confirmEnd && (
              <>
                <span class="hint">End {session.agentName}? Closing this overlay would keep it running.</span>
                <button
                  type="button"
                  class="btn sm primary"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await api.closeSession(session.id, false);
                      setConfirmEnd(false);
                    })
                  }
                >
                  End it
                </button>
                <button type="button" class="btn sm ghost" onClick={() => setConfirmEnd(false)}>
                  Cancel
                </button>
              </>
            )}
            {session && !running && (
              <button type="button" class="btn sm ghost" disabled={busy} title="Delete this console's record and stored output" onClick={() => act(() => api.deleteSession(session.id))}>
                Delete record
              </button>
            )}
            {session && <Copy text={cdCommand(session.worktreePath)} label="Copy cd" />}
          </div>
          {(error ?? session?.error) && <div class="notice danger">{error ?? session?.error}</div>}
        </header>
        {session ? (
          <TerminalView key={`${session.id}:${generation}`} sessionId={session.id} running={running} onExit={ui.refresh} />
        ) : (
          <div class="console-empty">
            <p class="detail-hint">{busy ? "Starting the console…" : error ? "The console could not be started." : "No console is running."}</p>
            {!busy && (
              <button type="button" class="btn sm primary" onClick={() => void start()}>
                Start console
              </button>
            )}
          </div>
        )}
      </section>
    </DetailOverlay>
  );
}
