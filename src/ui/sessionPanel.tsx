// The session panel: the agent's own terminal, streamed from the dashboard server. The dashboard adds nothing to what
// the agent shows and interprets none of it; keystrokes go straight to the agent, exactly as in a terminal window.
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "preact/hooks";
import { SHIPPABLE_WORK, type SessionAction } from "../shared/types.ts";
import { api, terminalSocketUrl } from "./api.ts";
import { cdCommand } from "./format.ts";
import { DEFAULT_QUICK_REPLIES, replyHint, replyInput, type QuickReply } from "./quickReplies.ts";
import { nextStepFor, sessionBadge, sessionTabs, startersFor, workBadge } from "./sessionState.ts";
import { SessionBadgeView, useSessionUi } from "./sessions.tsx";

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

/** How long a default response stays inert after a click, so a double click sends it once. */
const REPLY_GUARD_MS = 600;

function TerminalView({ sessionId, running, onExit }: { sessionId: string; running: boolean; onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");
  // The effect below owns the terminal and its socket; the default responses reach them through this ref.
  const live = useRef<{ send: (message: object) => void; focus: () => void }>();
  // The ref is the guard (it holds within one tick, where state would still be stale); the state only greys the button.
  const guard = useRef(new Set<string>());
  const [guarded, setGuarded] = useState<readonly string[]>([]);

  // A default response is plain terminal input: the same message a keystroke produces. The defaults only type; the
  // user presses Enter in the focused terminal (see quickReplies.ts for why).
  // Something was typed into this terminal on the user's behalf (a next step): hand them the keyboard for Enter.
  const { focusTick } = useSessionUi();
  useEffect(() => {
    if (focusTick > 0) live.current?.focus();
  }, [focusTick]);

  const reply = (r: QuickReply) => {
    if (guard.current.has(r.id)) return;
    guard.current.add(r.id);
    setGuarded([...guard.current]);
    live.current?.send({ type: "input", data: replyInput(r) });
    live.current?.focus();
    setTimeout(() => {
      guard.current.delete(r.id);
      setGuarded([...guard.current]);
    }, REPLY_GUARD_MS);
  };

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
    live.current = { send, focus: () => term.focus() };

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
      live.current = undefined;
      observer.disconnect();
      input.dispose();
      resized.dispose();
      socket.close();
      term.dispose();
    };
  }, [sessionId, onExit]);

  return (
    <div class="session-terminal">
      <div class="session-terminal-area">
        <div ref={host} class="session-terminal-host" />
        {status !== "open" && <div class="session-terminal-note">{status === "connecting" ? "connecting to the terminal…" : "terminal disconnected"}</div>}
      </div>
      {running && status === "open" && (
        // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring legend/border styling the response row does not want
        <div class="session-replies" role="group" aria-label="Default responses">
          {DEFAULT_QUICK_REPLIES.map((r) => (
            <button key={r.id} type="button" class="btn sm" title={replyHint(r)} disabled={guarded.includes(r.id)} onClick={() => reply(r)}>
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const STEP_LABEL: Record<SessionAction, string> = { draft: "Draft artifacts", implement: "Implement", archive: "Archive" };

/** One tab per running session, so several agents can be steered without hiding the panel in between. */
function SessionTabs() {
  const ui = useSessionUi();
  const tabs = sessionTabs(ui.sessions, ui.panelId);
  if (tabs.length < 2) return null;
  const select = (index: number) => ui.openPanel(tabs[(index + tabs.length) % tabs.length].id);
  return (
    <div class="session-tabs" role="tablist" aria-label="Running sessions">
      {tabs.map((tab, index) => {
        const badge = sessionBadge(tab);
        const selected = tab.id === ui.panelId;
        return (
          <button
            type="button"
            role="tab"
            key={tab.id}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            class={`session-tab${selected ? " active" : ""}`}
            title={`${ui.config?.repos.find((r) => r.id === tab.repoId)?.name ?? tab.repoId} · ${tab.change} · ${badge.title}`}
            onClick={() => ui.openPanel(tab.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") select(index + 1);
              else if (e.key === "ArrowLeft") select(index - 1);
            }}
          >
            <span class="hint">{ui.config?.repos.find((r) => r.id === tab.repoId)?.name ?? tab.repoId}</span>
            <span class="mono">{tab.change}</span>
            <SessionBadgeView badge={badge} />
          </button>
        );
      })}
    </div>
  );
}

export function SessionPanel() {
  const ui = useSessionUi();
  const id = ui.panelId;
  const session = ui.sessions.find((s) => s.id === id);
  const [error, setError] = useState<string>();
  // An agent that was started again (Resume, Ship — from here or from the end-session dialog) gets a fresh terminal view.
  const [generation, setGeneration] = useState(0);
  const seen = useRef<{ id?: string; running?: boolean }>({});
  const runningNow = session?.state === "running";
  useEffect(() => {
    if (seen.current.id === session?.id && seen.current.running === false && runningNow) setGeneration((n) => n + 1);
    seen.current = { id: session?.id, running: session ? runningNow : undefined };
  }, [session?.id, runningNow, session]);

  useEffect(() => {
    setError(undefined);
  }, [id]);

  if (!id) return null;
  const badge = session ? sessionBadge(session) : undefined;
  const repo = ui.config?.repos.find((r) => r.id === session?.repoId);
  const worktree = session && ui.worktrees.find((w) => w.path === session.worktreePath);
  const work = worktree && workBadge(worktree, ui.sessions);
  const shippable = worktree !== undefined && SHIPPABLE_WORK.includes(worktree.work.state);
  const merged = worktree?.work.state === "merged";
  // The change's next step, offered here only when it would go into this very terminal.
  const card = session && ui.snapshot?.repos.find((r) => r.id === session.repoId)?.changes.find((c) => c.name === session.change && !c.archived);
  const nextSteps = session && card ? startersFor(ui.config, card).filter((action) => nextStepFor(ui.sessions, session.repoId, session.change, action).promptSessionId === session.id) : [];

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
      <SessionTabs />
      <header class="session-head">
        <div class="row">
          <strong class="mono">{session?.change ?? "session"}</strong>
          {repo && <span class="hint">{repo.name}</span>}
          {session && <span class="hint">· {session.agentName}</span>}
          {badge && <SessionBadgeView badge={badge} />}
          <span style={{ flex: 1 }} />
          <button type="button" class="btn sm ghost" title="Hide the panel; the session keeps running" onClick={() => ui.openPanel(undefined)}>
            ✕
          </button>
        </div>
        {session && (
          <div class="row hint">
            <span title="the agent's own git worktree">
              {session.worktreePath} · <span class="mono">{session.branch}</span>
              {session.adopted && (
                <span class="badge" title="This branch was already checked out in a worktree created outside the dashboard, so the agent works there. The dashboard will not remove it.">
                  adopted worktree
                </span>
              )}
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
                  act(() => api.shipSession(session.id))
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
                  act(() => api.resumeSession(session.id))
                }
              >
                ▶ Resume
              </button>
            )}
            {nextSteps.map((action) => (
              <button
                type="button"
                class="btn sm session-start"
                key={action}
                title={`Types the “${STEP_LABEL[action]}” prompt into this terminal — press Enter to send it`}
                onClick={() => act(() => ui.start(session.repoId, session.change, action))}
              >
                ↳ {STEP_LABEL[action]}
              </button>
            ))}
            <button type="button" class="btn sm" onClick={() => ui.requestEnd(session.id)}>
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
        {(error ?? session?.error) && <div class="notice danger">{error ?? session?.error}</div>}
      </header>
      {session ? <TerminalView key={`${session.id}:${generation}`} sessionId={session.id} running={session.state === "running"} onExit={ui.refresh} /> : <div class="hint session-terminal-note">Loading session…</div>}
    </aside>
  );
}
