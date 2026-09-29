// Setting a repository up for OpenSpec: an agent session in a repository the dashboard does not track yet. It runs
// **in place** in that repository's main checkout — no worktree, no branch — because the marker it writes has to land
// where discovery looks for it. That is the one thing this view has to say plainly, so it does, before anything else.
import { useEffect, useRef, useState } from "preact/hooks";
import { api } from "./api.ts";
import { CloseButton, closeOnEscape, DetailOverlay } from "./changeDetail.tsx";
import { cdCommand } from "./format.ts";
import { IconTerminal } from "./icons.tsx";
import { Copy, TerminalView, useTerminalGeneration } from "./sessionPanel.tsx";
import { sessionBadge } from "./sessionState.ts";
import { SessionBadgeView, useSessionUi } from "./sessions.tsx";

export const IN_PLACE_WARNING = "The agent edits this folder directly — no branch, no commit and no undo. What it changes is up to its own permission prompts.";

/** Mounted by the app shell outside the part that goes inert, next to the console overlay. */
export function IntegrationOverlay() {
  const ui = useSessionUi();
  if (!ui.integrationId) return null;
  return <IntegrationView id={ui.integrationId} onClose={() => ui.showIntegration(undefined)} />;
}

function IntegrationView({ id, onClose }: { id: string; onClose: () => void }) {
  const ui = useSessionUi();
  const panel = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const session = ui.integrations.find((s) => s.id === id);
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

  useEffect(() => {
    const onKey = closeOnEscape(onClose);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Focus into the panel on open, back to whatever opened it on close (see ChangeDetail for why it waits a tick).
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
    <DetailOverlay label="Set up for OpenSpec" onClose={onClose} panelRef={panel}>
      <div class="repo-head detail-head console-head">
        <div class="row">
          <h1 class="crumbs">
            <IconTerminal size={18} />
            <span>Set up for OpenSpec</span>
          </h1>
          <CloseButton onClose={onClose} />
        </div>
        <p class="hint">
          Your agent is running <code>openspec init</code> in this repository. The dashboard starts tracking it once{" "}
          <code>openspec/config.yaml</code> is there — not before, and never on the agent's word alone.
        </p>
      </div>
      <section class="console-pane main-console" aria-label="OpenSpec setup session">
        <header class="session-head">
          <div class="row">
            {session && <span class="hint">{session.agentName}</span>}
            {session && (
              <span class="hint mono" title="The repository the agent is setting up">
                · {session.folder}
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
              <button type="button" class="btn sm ghost" disabled={busy} title="Delete this session's record and stored output" onClick={() => act(async () => {
                await api.deleteSession(session.id);
                onClose();
              })}>
                Delete record
              </button>
            )}
            {session && <Copy text={cdCommand(session.folder)} label="Copy cd" />}
          </div>
          {/* The one thing that is different from every other session, so it is said where the terminal is, not only once. */}
          <div class="notice warn in-place-note">{IN_PLACE_WARNING}</div>
          {(error ?? session?.error) && <div class="notice danger">{error ?? session?.error}</div>}
        </header>
        {session ? (
          <TerminalView key={`${session.id}:${generation}`} sessionId={session.id} running={running} onExit={ui.refresh} />
        ) : (
          <div class="console-empty">
            <p class="detail-hint">This session is no longer listed.</p>
          </div>
        )}
      </section>
    </DetailOverlay>
  );
}
