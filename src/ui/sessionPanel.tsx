// The session panel: the agent's own terminal, streamed from the dashboard server. The dashboard adds nothing to what
// the agent shows and interprets none of it; keystrokes go straight to the agent, exactly as in a terminal window.
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "preact/hooks";
import { SHIPPABLE_WORK, type Session } from "../shared/types.ts";
import { api, terminalSocketUrl } from "./api.ts";
import { cdCommand } from "./format.ts";
import { sessionBadge, workBadge } from "./sessionState.ts";
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

/** Terminal colours follow the dashboard theme by reading its tokens. */
function terminalTheme(el: HTMLElement) {
  const css = getComputedStyle(el);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return { background: token("--bg-base", "#0b0d10"), foreground: token("--fg-heading", "#f3f5f7"), cursor: token("--brand", "#71c7c5"), selectionBackground: token("--bg-elevated", "#313437") };
}

function TerminalView({ sessionId, onExit }: { sessionId: string; onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const term = new Terminal({ fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace', fontSize: 12, cursorBlink: true, scrollback: 10_000, theme: terminalTheme(el) });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    fit.fit();

    const socket = new WebSocket(terminalSocketUrl(sessionId));
    socket.binaryType = "arraybuffer";
    const send = (message: object) => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify(message));
    const sendSize = () => send({ type: "resize", cols: term.cols, rows: term.rows });

    socket.onopen = () => {
      setStatus("open");
      sendSize();
      term.focus();
    };
    socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        if (JSON.parse(event.data).type === "exit") onExit();
      } else {
        term.write(new Uint8Array(event.data as ArrayBuffer));
      }
    };
    socket.onclose = () => setStatus("closed");

    const input = term.onData((data) => send({ type: "input", data }));
    const resized = term.onResize(sendSize);
    const observer = new ResizeObserver(() => fit.fit());
    observer.observe(el);

    return () => {
      observer.disconnect();
      input.dispose();
      resized.dispose();
      socket.close();
      term.dispose();
    };
  }, [sessionId, onExit]);

  return (
    <div class="session-terminal">
      <div ref={host} class="session-terminal-host" />
      {status !== "open" && <div class="session-terminal-note">{status === "connecting" ? "connecting to the terminal…" : "terminal disconnected"}</div>}
    </div>
  );
}

function CloseDialog({ session, merged, onDone, onCancel }: { session: Session; merged: boolean; onDone: () => void; onCancel: () => void }) {
  const [status, setStatus] = useState<{ removable: boolean; reason?: string }>();
  const [remove, setRemove] = useState(merged); // merged work: removing the worktree is what is left to do
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.worktreeStatus(session.id).then(setStatus).catch(() => setStatus({ removable: false, reason: "could not check the worktree" }));
  }, [session.id]);
  return (
    <div class="session-confirm">
      <strong>{session.state === "running" ? "End this session?" : "Clean up this session?"}</strong>
      {session.state === "running" && " The agent is stopped, as if you closed its terminal window."} The worktree and its branch stay unless removed.
      {status?.removable ? (
        <label class="check">
          <input type="checkbox" checked={remove} onChange={(e) => setRemove(e.currentTarget.checked)} /> also remove the worktree (clean, and nothing in it exists only there)
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
            await api.closeSession(session.id, remove && status?.removable === true).catch(() => undefined);
            onDone();
          }}
        >
          {session.state === "running" ? "End session" : "Done"}
        </button>
        <button type="button" class="btn sm ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function SessionPanel() {
  const ui = useSessionUi();
  const id = ui.panelId;
  const session = ui.sessions.find((s) => s.id === id);
  const [confirmClose, setConfirmClose] = useState(false);
  const [error, setError] = useState<string>();
  const [generation, setGeneration] = useState(0); // a resumed session gets a fresh terminal view

  useEffect(() => {
    setConfirmClose(false);
    setError(undefined);
  }, [id]);

  if (!id) return null;
  const badge = session ? sessionBadge(session) : undefined;
  const repo = ui.config?.repos.find((r) => r.id === session?.repoId);
  const worktree = session && ui.worktrees.find((w) => w.path === session.worktreePath);
  const work = worktree && workBadge(worktree, ui.sessions);
  const shippable = worktree !== undefined && SHIPPABLE_WORK.includes(worktree.work.state);
  const merged = worktree?.work.state === "merged";

  const act = async (fn: () => Promise<unknown>) => {
    try {
      setError(undefined);
      await fn();
      await ui.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <aside class="session-panel" aria-label="Agent session">
      <header class="session-head">
        <div class="row">
          <strong class="mono">{session?.change ?? "session"}</strong>
          {repo && <span class="hint">{repo.name}</span>}
          {session && <span class="hint">· {session.agentName}</span>}
          {badge && (
            <span class={`badge ${badge.tone}`} title={badge.title}>
              {badge.label}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" class="btn sm ghost" title="Hide the panel; the session keeps running" onClick={() => ui.openPanel(undefined)}>
            ✕
          </button>
        </div>
        {session && (
          <div class="row hint">
            <span title="the agent's own git worktree">
              {session.worktreePath} · <span class="mono">{session.branch}</span>
            </span>
          </div>
        )}
        {work && (
          <div class="session-work">
            <span class={`badge ${work.tone}`} title={work.title}>
              {work.label}
            </span>
            <span class="hint">{merged && session?.state !== "running" ? `${work.title}: use Clean up.` : work.title}</span>
          </div>
        )}
        {session && (
          <div class="row">
            {shippable && (
              <button
                type="button"
                class="btn sm primary"
                title={
                  session.state === "running"
                    ? `Types a prompt into the terminal asking ${session.agentName} to commit, push and open a pull request`
                    : `Starts ${session.agentName} in this worktree with a prompt to commit, push and open a pull request`
                }
                onClick={() =>
                  act(async () => {
                    const wasRunning = session.state === "running";
                    await api.shipSession(session.id);
                    if (!wasRunning) setGeneration((n) => n + 1);
                  })
                }
              >
                ⇪ Ship
              </button>
            )}
            {session.state !== "running" && session.resumable && (
              <button
                type="button"
                class="btn sm"
                title="Start the agent again in the same worktree, continuing its latest conversation"
                onClick={() =>
                  act(async () => {
                    await api.resumeSession(session.id);
                    setGeneration((n) => n + 1);
                  })
                }
              >
                ▶ Resume
              </button>
            )}
            <button type="button" class="btn sm" onClick={() => setConfirmClose(true)}>
              {session.state === "running" ? "End session" : "Clean up"}
            </button>
            {session.state !== "running" && (
              <button
                type="button"
                class="btn sm ghost"
                title="Delete this session's record and stored output"
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
            <Copy text={cdCommand(session.worktreePath)} label="Copy cd" />
          </div>
        )}
        {confirmClose && session && (
          <CloseDialog
            session={session}
            merged={merged && session.state !== "running"}
            onCancel={() => setConfirmClose(false)}
            onDone={() => {
              setConfirmClose(false);
              void ui.refresh();
            }}
          />
        )}
        {(error ?? session?.error) && <div class="notice danger">{error ?? session?.error}</div>}
      </header>
      {session ? <TerminalView key={`${session.id}:${generation}`} sessionId={session.id} onExit={ui.refresh} /> : <div class="hint session-terminal-note">Loading session…</div>}
    </aside>
  );
}
