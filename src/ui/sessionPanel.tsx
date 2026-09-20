// The session panel: a drawer over the board with the live transcript, an input box and the session's actions.
// Everything from the agent is rendered as text through JSX, so it is escaped; nothing is interpreted as HTML.
import { useEffect, useRef, useState } from "preact/hooks";
import { OPEN_SESSION_STATES, type Session, type SessionEvent } from "../shared/types.ts";
import { api, openEventStream } from "./api.ts";
import { cdCommand } from "./format.ts";
import { resumeCommand, sessionBadge } from "./sessionState.ts";
import { useSessionUi } from "./sessions.tsx";

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      class="btn sm ghost"
      title={text}
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        })
      }
    >
      {done ? "Copied" : label}
    </button>
  );
}

function EventRow({ event }: { event: SessionEvent }) {
  switch (event.kind) {
    case "user":
      return <div class="t-row t-user">{event.text}</div>;
    case "assistant":
      return <div class="t-row t-assistant">{event.text}</div>;
    case "tool_use":
      return (
        <details class="t-row t-tool">
          <summary>
            <span class="badge mono">tool</span> {event.tool?.name}
          </summary>
          <pre>{JSON.stringify(event.tool?.input ?? {}, null, 2)}</pre>
        </details>
      );
    case "tool_result":
      return (
        <details class={`t-row t-tool ${event.isError ? "t-error" : ""}`}>
          <summary>
            <span class={`badge mono ${event.isError ? "danger" : ""}`}>{event.isError ? "tool error" : "tool result"}</span>
          </summary>
          <pre>{event.text}</pre>
        </details>
      );
    case "denied":
      return (
        <div class="t-row t-denied">
          <span class="badge warn">denied</span> {event.tool?.name} was not allowed: <code>{JSON.stringify(event.tool?.input ?? {})}</code>
          <div class="hint">Not in this repository's allow-list. Rephrase, or widen the list in Settings (applies from the next process start).</div>
        </div>
      );
    case "result":
      return (
        <div class={`t-row t-result ${event.isError ? "t-error" : ""}`}>
          {event.isError ? `turn ended with an error: ${event.text ?? ""}` : "turn finished"}
          {event.costUsd !== undefined && ` · $${event.costUsd.toFixed(2)} so far`}
        </div>
      );
    case "error":
      return <div class="t-row t-error">⚠ {event.text}</div>;
    default:
      return <div class="t-row t-state">— {event.text ?? event.state} —</div>;
  }
}

function CloseDialog({ session, onDone, onCancel }: { session: Session; onDone: () => void; onCancel: () => void }) {
  const [status, setStatus] = useState<{ removable: boolean; reason?: string }>();
  const [remove, setRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.worktreeStatus(session.id).then(setStatus).catch(() => setStatus({ removable: false, reason: "could not check the worktree" }));
  }, [session.id]);
  return (
    <div class="session-confirm">
      <strong>Close this session?</strong> The conversation ends; the worktree and its branch stay unless removed.
      {status?.removable ? (
        <label class="check">
          <input type="checkbox" checked={remove} onChange={(e) => setRemove(e.currentTarget.checked)} /> also remove the worktree (clean and fully pushed)
        </label>
      ) : (
        <div class="hint">The worktree is kept{status?.reason ? `: ${status.reason}` : "…"}</div>
      )}
      <div class="row">
        <button
          type="button"
          class="btn primary sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await api.closeSession(session.id, remove).catch(() => undefined);
            onDone();
          }}
        >
          Close session
        </button>
        <button type="button" class="btn sm ghost" onClick={onCancel}>
          Keep open
        </button>
      </div>
    </div>
  );
}

export function SessionPanel() {
  const ui = useSessionUi();
  const id = ui.panelId;
  const session = ui.sessions.find((s) => s.id === id);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [error, setError] = useState<string>();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEvents([]);
    setConfirmClose(false);
    setError(undefined);
    if (!id) return;
    return openEventStream(id, 0, (event) => {
      setEvents((prev) => (prev.some((e) => e.seq === event.seq) ? prev : [...prev, event]));
      if (event.kind === "state" || event.kind === "result") void ui.refresh();
    });
  }, [id, ui.refresh]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [events.length]);

  if (!id) return null;
  const open = session ? OPEN_SESSION_STATES.includes(session.state) : false;
  const badge = session ? sessionBadge(session) : undefined;
  const repo = ui.config?.repos.find((r) => r.id === session?.repoId);
  const resume = session ? resumeCommand(session) : undefined;
  const windows = Object.entries(session?.rateLimit?.windows ?? {});

  const act = async (fn: () => Promise<unknown>) => {
    try {
      setError(undefined);
      await fn();
      await ui.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const send = async () => {
    const message = text.trim();
    if (!message || !session) return;
    setSending(true);
    await act(() => api.sendMessage(session.id, message));
    setText("");
    setSending(false);
  };

  return (
    <aside class="session-panel" aria-label="Agent session">
      <header class="session-head">
        <div class="row">
          <strong class="mono">{session?.change ?? "session"}</strong>
          {repo && <span class="hint">{repo.name}</span>}
          {badge && (
            <span class={`badge ${badge.tone}`} title={badge.title}>
              {badge.label}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" class="btn sm ghost" title="Hide the panel; the session keeps going" onClick={() => ui.openPanel(undefined)}>
            ✕
          </button>
        </div>
        {session && (
          <div class="row hint">
            <span title="the agent's own git worktree">{session.worktreePath ?? "worktree: not created yet"}</span>
          </div>
        )}
        {session && (
          <div class="row hint">
            <span>
              {session.turns} turn{session.turns === 1 ? "" : "s"} · ${session.costUsd.toFixed(2)}
            </span>
            {windows.map(([name, w]) => (
              <span key={name} title={`usage window resets ${new Date(w.resetsAt * 1000).toLocaleString()}`}>
                · {name.replace("_", " ")} {Math.round(w.utilization * 100)}%
              </span>
            ))}
            {session.apiKeySource && session.apiKeySource !== "none" && <span class="badge warn">using an API key, not the CLI login</span>}
          </div>
        )}
        {session && (
          <div class="row">
            {session.state === "running" && (
              <button type="button" class="btn sm" title="Interrupt the current turn; the conversation stays open" onClick={() => act(() => api.stopSession(session.id))}>
                ■ Stop
              </button>
            )}
            {open && (
              <button type="button" class="btn sm" onClick={() => setConfirmClose(true)}>
                Close
              </button>
            )}
            {(session.state === "running" || session.state === "queued") && (
              <button type="button" class="btn sm ghost" title="Kill the agent process immediately" onClick={() => act(() => api.cancelSession(session.id))}>
                Cancel
              </button>
            )}
            {!open && (
              <button
                type="button"
                class="btn sm ghost"
                title="Delete this session's record and transcript"
                onClick={() =>
                  act(async () => {
                    await api.deleteSession(session.id);
                    ui.openPanel(undefined);
                  })
                }
              >
                Delete record
              </button>
            )}
            {resume && <Copy text={resume} label="Copy resume command" />}
            {session.worktreePath && <Copy text={cdCommand(session.worktreePath)} label="Copy cd" />}
          </div>
        )}
        {confirmClose && session && (
          <CloseDialog
            session={session}
            onCancel={() => setConfirmClose(false)}
            onDone={() => {
              setConfirmClose(false);
              void ui.refresh();
            }}
          />
        )}
        {(error ?? session?.error) && <div class="notice danger">{error ?? session?.error}</div>}
      </header>

      <div class="session-transcript" aria-live="polite">
        {events.map((event) => (
          <EventRow key={event.seq} event={event} />
        ))}
        {!session && <div class="hint">Loading session…</div>}
        <div ref={bottom} />
      </div>

      <footer class="session-input">
        <textarea
          class="input"
          rows={3}
          placeholder={open ? "Tell the agent what to do next… (Enter sends, Shift+Enter for a new line)" : "This session has ended."}
          value={text}
          disabled={!open || sending}
          onInput={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="button" class="btn primary" disabled={!open || sending || !text.trim()} onClick={() => void send()}>
          {session?.state === "running" || session?.state === "queued" ? "Queue" : "Send"}
        </button>
      </footer>
    </aside>
  );
}
