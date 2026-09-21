// The session panel: the agent's own terminal, streamed from the dashboard server. The dashboard adds nothing to what
// the agent shows and interprets none of it; keystrokes go straight to the agent, exactly as in a terminal window.
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "preact/hooks";
import { SHIPPABLE_WORK, type SessionAction } from "../shared/types.ts";
import { api, type TerminalMessage } from "./api.ts";
import { cdCommand } from "./format.ts";
import { DEFAULT_QUICK_REPLIES, NOT_SUBMITTED_NOTICE, replyHint, replyMessage, type QuickReply } from "./quickReplies.ts";
import {
  clampDockHeight,
  DOCK_DEFAULT_RATIO,
  DOCK_MIN_BOARD,
  DOCK_MIN_HEIGHT,
  DOCK_TABS_HEIGHT,
  MAX_SHOWN,
  nextStepFor,
  sessionBadge,
  sessionTabs,
  startersFor,
  workBadge,
} from "./sessionState.ts";
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
  // Something was typed into this terminal on the user's behalf (a next step): hand them the keyboard for Enter.
  const { focusTick, panelId, unsentId, reportUnsent } = useSessionUi();
  const wantsFocus = useRef(panelId === sessionId);
  wantsFocus.current = panelId === sessionId;
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
        if (wantsFocus.current) term.focus(); // with several panes, only the one the user is in takes the keyboard
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

/** One tab per running session — there can be more tabs than panes. A marked tab has a pane in the dock. */
function SessionTabs() {
  const ui = useSessionUi();
  const tabs = sessionTabs(ui.sessions, ui.shown);
  const select = (index: number) => ui.openPanel(tabs[(index + tabs.length) % tabs.length].id);
  return (
    <div class="session-tabs" role="tablist" aria-label="Agent sessions">
      {tabs.map((tab, index) => {
        const badge = sessionBadge(tab);
        const shown = ui.shown.includes(tab.id);
        const focused = tab.id === ui.panelId;
        const repoName = ui.config?.repos.find((r) => r.id === tab.repoId)?.name ?? tab.repoId;
        return (
          <button
            type="button"
            role="tab"
            key={tab.id}
            aria-selected={shown}
            tabIndex={focused || (ui.panelId === undefined && index === 0) ? 0 : -1}
            class={`session-tab${shown ? " shown" : ""}${focused ? " active" : ""}`}
            title={`${repoName} · ${tab.change} · ${badge.title}${shown ? " · shown in the dock" : ui.shown.length >= MAX_SHOWN ? " · replaces the pane you are in" : ""}`}
            onClick={() => ui.openPanel(tab.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") select(index + 1);
              else if (e.key === "ArrowLeft") select(index - 1);
            }}
          >
            <span class="tab-mark" aria-hidden="true">
              {shown ? "▣" : "▢"}
            </span>
            <span class="hint">{repoName}</span>
            <span class="mono">{tab.change}</span>
            <SessionBadgeView badge={badge} />
          </button>
        );
      })}
    </div>
  );
}

const HEIGHT_KEY = "osd.dockHeight";

function storedHeight(): number | undefined {
  try {
    const value = Number(localStorage.getItem(HEIGHT_KEY));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  } catch {
    return undefined; // storage can be unavailable; the default height is fine then
  }
}

/**
 * Agent terminals live in a dock across the bottom of the window: wide and short, the shape terminal output has, with
 * the board usable above it. Up to three sessions sit side by side; the tab strip holds every running one.
 */
export function SessionDock() {
  const ui = useSessionUi();
  const [height, setHeight] = useState(() => clampDockHeight(storedHeight() ?? window.innerHeight * DOCK_DEFAULT_RATIO, window.innerHeight));
  const [maximised, setMaximised] = useState(false);
  const dragging = useRef(false);
  const tabs = sessionTabs(ui.sessions, ui.shown);
  const exists = ui.shown.length > 0 || tabs.length > 0;
  const open = ui.shown.length > 0;

  // The page reserves the dock's height below its content, so nothing of the board hides behind it.
  const reserved = !exists ? "0px" : !open ? `${DOCK_TABS_HEIGHT}px` : maximised ? "calc(100vh - 56px)" : `min(${height}px, calc(100vh - ${DOCK_MIN_BOARD}px))`;
  useEffect(() => {
    document.documentElement.style.setProperty("--dock-h", reserved);
    return () => void document.documentElement.style.setProperty("--dock-h", "0px");
  }, [reserved]);

  const resize = (next: number, persist: boolean) => {
    const clamped = clampDockHeight(next, window.innerHeight);
    setHeight(clamped);
    setMaximised(false);
    if (!persist) return;
    try {
      localStorage.setItem(HEIGHT_KEY, String(clamped));
    } catch {
      // not remembered, nothing else lost
    }
  };

  if (!exists) return null;
  return (
    <aside class={`session-dock${open ? "" : " collapsed"}`} aria-label="Agent sessions">
      {open && (
        // biome-ignore lint/a11y/useSemanticElements: an <hr> cannot be dragged; this is the ARIA window-splitter pattern
        <div
          class="dock-handle"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize the session dock"
          aria-valuenow={height}
          aria-valuemin={DOCK_MIN_HEIGHT}
          aria-valuemax={Math.max(DOCK_MIN_HEIGHT, window.innerHeight - DOCK_MIN_BOARD)}
          tabIndex={0}
          title="Drag to resize; arrow keys work too"
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => dragging.current && resize(window.innerHeight - e.clientY, false)}
          onPointerUp={(e) => {
            if (!dragging.current) return;
            dragging.current = false;
            resize(window.innerHeight - e.clientY, true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") resize(height + 24, true);
            else if (e.key === "ArrowDown") resize(height - 24, true);
          }}
        />
      )}
      <div class="dock-bar">
        <SessionTabs />
        {open && (
          <>
            <button
              type="button"
              class="btn sm ghost"
              aria-pressed={maximised}
              title={maximised ? "Back to the chosen height" : "Use the whole window"}
              onClick={() => setMaximised(!maximised)}
            >
              {maximised ? "▾ Restore" : "▴ Maximise"}
            </button>
            <button type="button" class="btn sm ghost" title="Collapse to the tabs; every session keeps running" onClick={() => ui.openPanel(undefined)}>
              ▁ Collapse
            </button>
          </>
        )}
      </div>
      {open && (
        <div class="dock-panes" style={{ "--panes": ui.shown.length }}>
          {ui.shown.map((id) => (
            <SessionPane key={id} id={id} />
          ))}
        </div>
      )}
    </aside>
  );
}

function SessionPane({ id }: { id: string }) {
  const ui = useSessionUi();
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

  // Whichever pane the user clicks or tabs into is the one a fourth session would replace.
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const focus = () => ui.focusPane(id);
    el.addEventListener("focusin", focus);
    el.addEventListener("pointerdown", focus);
    return () => {
      el.removeEventListener("focusin", focus);
      el.removeEventListener("pointerdown", focus);
    };
  }, [id, ui.focusPane]);

  const badge = session ? sessionBadge(session) : undefined;
  const repo = ui.config?.repos.find((r) => r.id === session?.repoId);
  const worktree = session && ui.worktrees.find((w) => w.path === session.worktreePath);
  const work = worktree && workBadge(worktree, ui.sessions);
  const shippable = worktree !== undefined && SHIPPABLE_WORK.includes(worktree.work.state);
  const merged = worktree?.work.state === "merged";
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

  return (
    <section ref={root} class={`session-pane${ui.panelId === id ? " focused" : ""}`} aria-label={`Agent session ${session?.change ?? ""}`}>
      <header class="session-head">
        <div class="pane-title">
          <div class="row">
            <strong class="mono" title={session ? `worktree ${session.worktreePath}\nbranch ${session.branch}` : undefined}>
              {session?.change ?? "session"}
            </strong>
            {repo && <span class="hint">{repo.name}</span>}
            {session && <span class="hint">· {session.agentName}</span>}
            {session && <span class="hint mono pane-branch">{session.branch}</span>}
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
          <button
            type="button"
            class="btn sm ghost"
            aria-label="Close this pane"
            title="Close this pane; the session keeps running and stays in the tabs"
            onClick={() => ui.hidePane(id)}
          >
            ✕
          </button>
        </div>
        {session && (
          <div class="row">
            {shippable && (
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
            {session.state !== "running" && session.resumable && (
              <button
                type="button"
                class="btn sm"
                title="Start the agent again in the same worktree, continuing its latest conversation"
                onClick={() => act(() => api.resumeSession(session.id))}
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
                    ui.hidePane(session.id);
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
      {session ? (
        <TerminalView key={`${session.id}:${generation}`} sessionId={session.id} running={session.state === "running"} onExit={ui.refresh} />
      ) : (
        <div class="hint session-terminal-note">Loading session…</div>
      )}
    </section>
  );
}
