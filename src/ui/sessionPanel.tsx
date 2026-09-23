// The console: the agent's own terminal, streamed from the dashboard server, shown in the Console tab of its change's
// detail view. The dashboard adds nothing to what the agent shows and interprets none of it; keystrokes go straight to
// the agent, exactly as in a terminal window.
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "preact/hooks";
import { SHIPPABLE_WORK, type Session, type SessionAction, type SessionWorktree } from "../shared/types.ts";
import { api, type TerminalMessage } from "./api.ts";
import { cdCommand } from "./format.ts";
import { DEFAULT_QUICK_REPLIES, NOT_SUBMITTED_NOTICE, replyHint, replyMessage, type QuickReply } from "./quickReplies.ts";
import { nextStepFor, sessionBadge, startersFor, workBadge, worktreeOfSession } from "./sessionState.ts";
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
  return {
    background: token("--bg-base", "#141619"),
    foreground: token("--fg-heading", "#f3f5f7"),
    cursor: token("--brand", "#71c7c5"),
    selectionBackground: token("--bg-elevated", "#3b3e41"),
  };
}

/** How long a typed-only response stays inert after a click, so a double click types it once. */
const REPLY_GUARD_MS = 600;
/** A submitted response stays inert until the server answers; this only covers an answer that never comes. */
const SUBMIT_GUARD_MS = 10_000;
/** How long the "typed but not sent" notice stays before it dismisses itself. */
const UNSENT_NOTICE_MS = 12_000;

function TerminalView({ sessionId, running, onExit }: { sessionId: string; running: boolean; onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");
  // The effect below owns the terminal and its socket; the default responses reach them through this ref.
  const live = useRef<{ send: (message: TerminalMessage) => void; focus: () => void }>();
  // The ref is the guard (it holds within one tick, where state would still be stale); the state only greys the button.
  const guard = useRef(new Set<string>());
  const [guarded, setGuarded] = useState<readonly string[]>([]);

  // A default response goes to the server as `submit`: typed, and sent with Enter only once the agent has shown it.
  // The server answers this socket with `submitted`; until then the clicked response stays inert.
  const pending = useRef<string[]>([]);
  // Text went into this terminal on the user's behalf (a next step): put the keyboard back where the agent is.
  const { focusTick, unsentId, reportUnsent } = useSessionUi();
  useEffect(() => {
    if (focusTick.tick > 0 && focusTick.id === sessionId) live.current?.focus();
  }, [focusTick, sessionId]);

  const release = (id: string) => {
    guard.current.delete(id);
    setGuarded([...guard.current]);
  };
  const reply = (r: QuickReply) => {
    if (guard.current.has(r.id)) return;
    guard.current.add(r.id);
    setGuarded([...guard.current]);
    if (unsentId === sessionId) reportUnsent(undefined); // another pane's notice is not this pane's to clear
    live.current?.send(replyMessage(r));
    live.current?.focus();
    if (r.submit) pending.current.push(r.id);
    setTimeout(
      () => {
        pending.current = pending.current.filter((id) => id !== r.id);
        release(r.id);
      },
      r.submit ? SUBMIT_GUARD_MS : REPLY_GUARD_MS,
    );
  };
  // Answers arrive in the order the submissions were made (the server runs them one after another).
  const onSubmitted = useRef<(ok: boolean) => void>(() => {});
  onSubmitted.current = (ok) => {
    const id = pending.current.shift();
    if (id) release(id);
    if (!ok) reportUnsent(sessionId);
  };

  useEffect(() => {
    if (unsentId !== sessionId) return;
    const timer = setTimeout(() => reportUnsent(undefined), UNSENT_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [unsentId, sessionId, reportUnsent]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const term = new Terminal({
      fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace',
      fontSize: 12,
      cursorBlink: true,
      scrollback: 10_000,
      theme: terminalTheme(el),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    fit.fit();

    // The stream comes from the API layer: a WebSocket in the product, a scripted recording in the demo.
    const connection = api.openTerminal(sessionId, {
      onOpen: () => {
        setStatus("open");
        sendSize();
        // One terminal per view, and the user selected the Console tab to get here: give it the keyboard.
        term.focus();
      },
      onData: (bytes) => term.write(bytes),
      onExit,
      onSubmitted: (ok) => onSubmitted.current(ok),
      onClose: () => setStatus("closed"),
    });
    const send = (message: TerminalMessage) => connection.send(message);
    function sendSize() {
      send({ type: "resize", cols: term.cols, rows: term.rows });
    }
    live.current = { send, focus: () => term.focus() };

    const input = term.onData((data) => send({ type: "input", data }));
    const resized = term.onResize(sendSize);
    const observer = new ResizeObserver(() => fit.fit());
    observer.observe(el);

    return () => {
      live.current = undefined;
      observer.disconnect();
      input.dispose();
      resized.dispose();
      connection.close();
      term.dispose();
    };
  }, [sessionId, onExit]);

  return (
    <div class="session-terminal">
      <div class="session-terminal-area">
        <div ref={host} class="session-terminal-host" />
        {status !== "open" && <div class="session-terminal-note">{status === "connecting" ? "connecting to the terminal…" : "terminal disconnected"}</div>}
      </div>
      {unsentId === sessionId && (
        <div class="session-unsent notice warn" role="status">
          <span>{NOT_SUBMITTED_NOTICE}</span>
          <button type="button" class="btn sm ghost" aria-label="Dismiss" onClick={() => reportUnsent(undefined)}>
            ×
          </button>
        </div>
      )}
      {running && status === "open" && (
        // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring legend/border styling the response row does not want
        <div class="session-replies" role="group" aria-labelledby={`replies-${sessionId}`}>
          <span id={`replies-${sessionId}`} class="hint session-replies-label">
            Shortcuts:
          </span>
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

/**
 * The change's sessions, in the slot the delta specs use for their file list. Omitted for a single session: there is
 * nothing to choose. A change can legitimately have two — its own and its archive worktree's.
 */
export function ConsoleSessionList({ sessions, selected, onSelect }: { sessions: Session[]; selected?: string; onSelect: (id: string) => void }) {
  if (sessions.length < 2) return null;
  return (
    <nav class="detail-files console-sessions" aria-label="Sessions of this change">
      {sessions.map((s) => {
        const badge = sessionBadge(s);
        return (
          <button
            key={s.id}
            type="button"
            class={`detail-file console-session ${s.id === selected ? "on" : ""}`}
            aria-current={s.id === selected ? "true" : undefined}
            title={`${STEP_LABEL[s.action]} · ${s.branch} · ${badge.title}`}
            onClick={() => onSelect(s.id)}
          >
            <span class="console-session-what">{STEP_LABEL[s.action]}</span>
            <span class="hint mono">{s.branch}</span>
            <SessionBadgeView badge={badge} />
          </button>
        );
      })}
    </nav>
  );
}

/**
 * The console itself: one session's terminal with the facts and actions that belong to it. Shown in the Console tab of
 * the change's detail view — the only place the dashboard renders a terminal.
 *
 * A worktree without a session record still gets a panel: its path, its work status and a way to copy a `cd` for it.
 * There is nothing to attach a terminal to, and the dashboard will not start one behind the user's back.
 */
export function ConsolePanel({ session, worktree }: { session?: Session; worktree?: SessionWorktree }) {
  const ui = useSessionUi();
  const [error, setError] = useState<string>();
  // An agent that was started again (Resume, Ship — from here or from the end-session dialog) gets a fresh terminal view.
  const [generation, setGeneration] = useState(0);
  const seen = useRef<{ id?: string; running?: boolean }>({});
  const runningNow = session?.state === "running";
  useEffect(() => {
    if (seen.current.id === session?.id && seen.current.running === false && runningNow) setGeneration((n) => n + 1);
    seen.current = { id: session?.id, running: session ? runningNow : undefined };
  }, [session?.id, runningNow, session]);

  const badge = session ? sessionBadge(session) : undefined;
  const repo = ui.config?.repos.find((r) => r.id === session?.repoId);
  // An in-place session runs in the repository folder, which is not a worktree: nothing git-derived applies to it.
  const tree = worktreeOfSession(session, ui.worktrees) ?? (session ? undefined : worktree);
  const work = tree && workBadge(tree, ui.sessions);
  const shippable = session !== undefined && tree !== undefined && SHIPPABLE_WORK.includes(tree.work.state);
  const merged = tree?.work.state === "merged";
  // The change's next step, offered here only when it would go into this very terminal.
  const card = session && ui.snapshot?.repos.find((r) => r.id === session.repoId)?.changes.find((c) => c.name === session.change && !c.archived);
  const nextSteps =
    session && card
      ? startersFor(ui.config, card).filter((action) => nextStepFor(ui.sessions, session.repoId, session.change, action).promptSessionId === session.id)
      : [];

  const act = async (fn: () => Promise<unknown>) => {
    try {
      setError(undefined);
      await fn();
      await ui.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const path = session?.worktreePath ?? tree?.path;
  return (
    <section class="console-pane" aria-label={`Agent console ${session?.change ?? tree?.change ?? ""}`}>
      <header class="session-head">
        <div class="row">
          {session && <span class="hint">{session.agentName}</span>}
          {repo && <span class="hint">· {repo.name}</span>}
          {!session?.inPlace && (session?.branch ?? tree?.branch) && <span class="hint mono pane-branch">{session?.branch ?? tree?.branch}</span>}
          {session?.inPlace && (
            <span class="badge warning" title={`${session.worktreePath} is not a git repository, so the agent works in the folder itself. There is no branch, no commit and no undo.`}>
              in the folder — no undo
            </span>
          )}
          {badge && <SessionBadgeView badge={badge} />}
          {work && (
            <span class={`badge ${work.tone}`} title={merged && session?.state !== "running" ? `${work.title}: use Clean up.` : work.title}>
              {work.label}
            </span>
          )}
          {session?.adopted && (
            <span
              class="badge"
              title="This branch was already checked out in a worktree created outside the dashboard, so the agent works there. The dashboard will not remove it."
            >
              adopted worktree
            </span>
          )}
        </div>
        <div class="row">
          {shippable && session && (
            <button
              type="button"
              class="btn sm primary"
              title={
                session.state === "running"
                  ? `Sends ${session.agentName} a prompt asking it to commit, push and open a pull request`
                  : `Starts ${session.agentName} in this worktree with a prompt to commit, push and open a pull request`
              }
              onClick={() =>
                act(async () => {
                  const result = await api.shipSession(session.id);
                  ui.reportUnsent(result.submitted ? undefined : session.id);
                })
              }
            >
              ⇪ Ship
            </button>
          )}
          {session && session.state !== "running" && session.resumable && (
            <button
              type="button"
              class="btn sm"
              title="Start the agent again in the same worktree, continuing its latest conversation"
              onClick={() => act(() => api.resumeSession(session.id))}
            >
              ▶ Resume
            </button>
          )}
          {session &&
            nextSteps.map((action) => (
              <button
                type="button"
                class="btn sm session-start"
                key={action}
                title={`Sends the “${STEP_LABEL[action]}” prompt to this session’s agent`}
                onClick={() => act(() => ui.start(session.repoId, session.change, action))}
              >
                ↳ {STEP_LABEL[action]}
              </button>
            ))}
          {session && (
            <button type="button" class="btn sm" onClick={() => ui.requestEnd(session.id)}>
              {session.state === "running" ? "End session" : "Clean up"}
            </button>
          )}
          {session && session.state !== "running" && (
            <button type="button" class="btn sm ghost" title="Delete this session's record and stored output" onClick={() => act(() => api.deleteSession(session.id))}>
              Delete record
            </button>
          )}
          {path && <Copy text={cdCommand(path)} label="Copy cd" />}
        </div>
        {(error ?? session?.error) && <div class="notice danger">{error ?? session?.error}</div>}
      </header>
      {session ? (
        <TerminalView key={`${session.id}:${generation}`} sessionId={session.id} running={session.state === "running"} onExit={ui.refresh} />
      ) : (
        <div class="console-empty">
          <p class="detail-hint">
            No session is recorded for this worktree, so there is no terminal to show. Its work is still here — copy a <code>cd</code> for it, or remove it from Open work
            when that is safe.
          </p>
          {path && <p class="hint mono">{path}</p>}
        </div>
      )}
    </section>
  );
}
