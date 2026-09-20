// Session manager (design.md D7, D8): owns the state machine, the per-change uniqueness, the running limit and
// queue, idle shutdown with lazy resume, and failure classification. Talks to the agent only through `Runner`.
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  availableActions,
  repoAgentEnabled,
  SESSION_ACTIONS,
  OPEN_SESSION_STATES,
  type AgentAvailability,
  type Config,
  type Session,
  type SessionAction,
  type SessionEvent,
  type SessionFailure,
  type SessionState,
  type Snapshot,
} from "../../shared/types.ts";
import { DEFAULT_ALLOWED_TOOLS } from "../../shared/agentDefaults.ts";
import { CHANGE_NAME } from "../source.ts";
import type { Runner, RunnerEvent, RunnerProcess } from "./runner.ts";
import { SessionStore } from "./store.ts";
import { checkWorktreeRemovable, removeWorktree, type Removable } from "./worktree.ts";

export { DEFAULT_ALLOWED_TOOLS };

const STOP_FALLBACK_MS = 5_000;
const END_GRACE_MS = 3_000;
const AVAILABILITY_TTL_MS = 60_000;

export class SessionError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function renderCommand(template: string, change: string): string {
  if (!CHANGE_NAME.test(change)) throw new SessionError(400, "invalid change name");
  return template.replaceAll("{change}", change);
}

/** Archiving gets a worktree of its own: the implementation worktree of the same change may still exist, on an old base. */
export function worktreeName(action: SessionAction, change: string): string {
  return action === "archive" ? `archive-${change}` : change;
}

export function sessionBranch(action: SessionAction, change: string): string {
  return action === "archive" ? `chore/archive-${change}` : `feat/${change}`;
}

export function worktreeSystemPrompt(repoPath: string, change: string, action: SessionAction = "implement"): string {
  const changeDir = `openspec/changes/${change}`;
  const branch = sessionBranch(action, change);
  return [
    `You were started by the OpenSpec dashboard to work on the change "${change}".`,
    `You run in your own git worktree of the repository at ${repoPath}. That worktree is yours alone.`,
    `Never edit, stage, commit or switch branches in the main checkout at ${repoPath}, and never touch another worktree.`,
    `Before your first commit, rename your branch to ${branch} with: git branch -m ${branch}`,
    `If ${changeDir}/ does not exist in your worktree, copy it from ${join(repoPath, changeDir)} (you can read it), and commit it first.`,
    "Tool calls outside your allow-list are denied without a prompt; when that happens, say what you needed and carry on with what you can do.",
  ].join("\n");
}

interface Live {
  proc?: RunnerProcess;
  pending: string[];
  /** Exits we caused ourselves are not failures. */
  expectExit: boolean;
  costBase: number;
  queuedAt: number;
  idleTimer?: ReturnType<typeof setTimeout>;
  stopTimer?: ReturnType<typeof setTimeout>;
}

type Listener = (event: SessionEvent) => void;

export interface ManagerDeps {
  getConfig: () => Config;
  getSnapshot: () => Snapshot;
  runner: Runner;
  store?: SessionStore;
  /** Test seam: real timings are minutes and seconds. */
  timing?: { idleMs?: number; stopFallbackMs?: number };
}

export class SessionManager {
  private sessions = new Map<string, Session>();
  private live = new Map<string, Live>();
  private listeners = new Map<string, Set<Listener>>();
  private availability?: { at: number; value: AgentAvailability };
  private readonly store: SessionStore;

  constructor(private readonly deps: ManagerDeps) {
    this.store = deps.store ?? new SessionStore();
  }

  /** Loads stored sessions; anything that claimed to be running has no process any more. */
  async init(): Promise<void> {
    for (const session of await this.store.loadAll()) {
      this.sessions.set(session.id, session);
      if (session.state === "running" || session.state === "queued") await this.setState(session, "interrupted");
    }
  }

  async agentAvailability(force = false): Promise<AgentAvailability> {
    if (!force && this.availability && Date.now() - this.availability.at < AVAILABILITY_TTL_MS) return this.availability.value;
    const value = await this.deps.runner.available();
    this.availability = { at: Date.now(), value };
    return value;
  }

  list(): Session[] {
    return [...this.sessions.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): Session {
    const session = this.sessions.get(id);
    if (!session) throw new SessionError(404, "unknown session");
    return session;
  }

  events(id: string, afterSeq: number): Promise<SessionEvent[]> {
    this.get(id);
    return this.store.readEvents(id, afterSeq);
  }

  subscribe(id: string, listener: Listener): () => void {
    this.get(id);
    const set = this.listeners.get(id) ?? new Set();
    set.add(listener);
    this.listeners.set(id, set);
    return () => set.delete(listener);
  }

  async open(input: { repoId?: unknown; change?: unknown; action?: unknown }): Promise<Session> {
    const config = this.deps.getConfig();
    if (!config.agentSessions.enabled) throw new SessionError(403, "agent sessions are disabled");
    if (typeof input.change !== "string" || !CHANGE_NAME.test(input.change)) throw new SessionError(400, "invalid change name");
    if (!SESSION_ACTIONS.includes(input.action as SessionAction)) throw new SessionError(400, "unknown action");
    const change = input.change;
    const action = input.action as SessionAction;

    const repo = config.repos.find((r) => r.id === input.repoId);
    if (!repo) throw new SessionError(404, "unknown repository");
    if (!repo.enabled) throw new SessionError(409, "the repository is not tracked");
    if (!repoAgentEnabled(repo)) throw new SessionError(403, "agent sessions are switched off for this repository");
    const scanned = this.deps.getSnapshot().repos.find((r) => r.id === repo.id);
    if (!scanned?.ok) throw new SessionError(409, "the repository's last scan failed");
    const snapshot = scanned.changes.find((c) => c.name === change && !c.archived);
    if (!snapshot) throw new SessionError(404, "unknown change");
    if (!availableActions(snapshot).includes(action)) throw new SessionError(400, `"${action}" is not available for this change in its current stage`);

    const existing = this.list().find((s) => s.repoId === repo.id && s.change === change && OPEN_SESSION_STATES.includes(s.state));
    if (existing) return existing;

    const availability = await this.agentAvailability(true);
    if (!availability.available) throw new SessionError(503, availability.reason ?? "the agent CLI is unavailable");

    const now = new Date().toISOString();
    const session: Session = { id: randomUUID(), repoId: repo.id, change, action, cliSessionId: randomUUID(), state: "queued", createdAt: now, updatedAt: now, turns: 0, costUsd: 0, lastSeq: 0 };
    this.sessions.set(session.id, session);
    this.live.set(session.id, { pending: [], expectExit: false, costBase: 0, queuedAt: Date.now() });
    await this.store.saveMeta(session);
    await this.enqueue(session, renderCommand(config.agentSessions.commands[action], change));
    for (const removed of await this.store.prune(this.list())) this.sessions.delete(removed);
    return session;
  }

  async send(id: string, text: unknown): Promise<Session> {
    const session = this.get(id);
    if (!OPEN_SESSION_STATES.includes(session.state)) throw new SessionError(409, `the session is ${session.state}`);
    if (typeof text !== "string" || !text.trim()) throw new SessionError(400, "message text is required");
    if (!this.deps.getConfig().agentSessions.enabled) throw new SessionError(403, "agent sessions are disabled");
    await this.enqueue(session, text);
    return session;
  }

  private liveOf(session: Session): Live {
    let live = this.live.get(session.id);
    if (!live) {
      live = { pending: [], expectExit: false, costBase: session.costUsd, queuedAt: Date.now() };
      this.live.set(session.id, live);
    }
    return live;
  }

  private async enqueue(session: Session, text: string): Promise<void> {
    const live = this.liveOf(session);
    if (live.pending.length === 0) live.queuedAt = Date.now();
    live.pending.push(text);
    await this.record(session, { kind: "user", text });
    if (session.state === "waiting" || session.state === "interrupted") await this.setState(session, "queued");
    await this.pump();
  }

  private runningCount(): number {
    return this.list().filter((s) => s.state === "running").length;
  }

  /** Starts queued turns, oldest first, while the running limit allows. */
  private async pump(): Promise<void> {
    const max = this.deps.getConfig().agentSessions.maxRunning;
    const queued = this.list()
      .filter((s) => s.state === "queued" && (this.live.get(s.id)?.pending.length ?? 0) > 0)
      .sort((a, b) => (this.live.get(a.id)?.queuedAt ?? 0) - (this.live.get(b.id)?.queuedAt ?? 0));
    for (const session of queued) {
      if (this.runningCount() >= max) return;
      await this.startTurn(session);
    }
  }

  private async startTurn(session: Session): Promise<void> {
    const live = this.liveOf(session);
    const text = live.pending.shift();
    if (text === undefined) return;
    clearTimeout(live.idleTimer);
    if (!live.proc) {
      try {
        live.proc = this.spawn(session);
      } catch (err) {
        await this.fail(session, "cli-missing", err instanceof Error ? err.message : String(err));
        return;
      }
      live.expectExit = false;
      live.costBase = session.costUsd;
      void this.consume(session, live, live.proc);
    }
    // `setState` assigns the state synchronously and only its persistence is awaited, so the state change and the
    // hand-over of the message happen in one tick: a Stop can neither overtake the message nor see a stale state,
    // and a fast answer cannot be overwritten by a late "running".
    const announced = this.setState(session, "running");
    live.proc.send(text);
    await announced;
  }

  private spawn(session: Session): RunnerProcess {
    const config = this.deps.getConfig();
    const repo = config.repos.find((r) => r.id === session.repoId);
    if (!repo) throw new Error("the repository is no longer configured");
    const fresh = !session.worktreePath;
    return this.deps.runner.start({
      cwd: fresh ? repo.path : (session.worktreePath as string),
      cliSessionId: session.cliSessionId,
      mode: fresh ? { kind: "fresh", worktreeName: worktreeName(session.action, session.change) } : { kind: "resume" },
      allowedTools: [...DEFAULT_ALLOWED_TOOLS, ...(repo.agent?.allowedTools ?? [])],
      addDirs: [join(repo.path, "openspec", "changes", session.change)],
      systemPrompt: worktreeSystemPrompt(repo.path, session.change, session.action),
      passApiKeyEnv: config.agentSessions.passApiKeyEnv,
    });
  }

  private async consume(session: Session, live: Live, proc: RunnerProcess): Promise<void> {
    try {
      for await (const event of proc.events) await this.onRunnerEvent(session, live, event);
    } catch (err) {
      // Never leave a session "running" with nobody listening to it.
      if (live.proc === proc) live.proc = undefined;
      proc.kill();
      if (OPEN_SESSION_STATES.includes(session.state)) {
        await this.fail(session, "crashed", `lost the agent's output: ${err instanceof Error ? err.message : String(err)}`).catch(() => undefined);
      }
      return;
    }
    const exit = await proc.exited;
    if (live.proc === proc) live.proc = undefined;
    clearTimeout(live.stopTimer);
    if (live.expectExit || !OPEN_SESSION_STATES.includes(session.state)) return;
    if (session.state === "running" || session.state === "queued") {
      const detail = exit.stderr.trim().split("\n").slice(-3).join(" ").slice(0, 400);
      await this.fail(session, "crashed", `the agent process ended unexpectedly (exit ${exit.code ?? "?"})${detail ? `: ${detail}` : ""}`);
    }
    // A waiting session whose process went away is simply resumed on the next message.
  }

  private async onRunnerEvent(session: Session, live: Live, event: RunnerEvent): Promise<void> {
    switch (event.type) {
      case "init": {
        const repoPath = this.deps.getConfig().repos.find((r) => r.id === session.repoId)?.path;
        if (event.cwd && event.cwd !== repoPath && event.cwd !== session.worktreePath) session.worktreePath = event.cwd;
        if (event.apiKeySource && event.apiKeySource !== session.apiKeySource) {
          session.apiKeySource = event.apiKeySource;
          if (event.apiKeySource !== "none" && !this.deps.getConfig().agentSessions.passApiKeyEnv) {
            await this.record(session, { kind: "error", text: `the agent reports credentials from "${event.apiKeySource}" rather than its own login` });
          }
        }
        await this.touch(session);
        return;
      }
      case "user":
        return; // our own messages replayed; they were recorded when they were sent
      case "assistant":
        await this.record(session, { kind: "assistant", text: event.text });
        return;
      case "tool_use":
        await this.record(session, { kind: "tool_use", tool: { name: event.name, input: event.input } });
        return;
      case "tool_result":
        await this.record(session, { kind: "tool_result", text: event.content, isError: event.isError });
        return;
      case "rate_limit":
        session.rateLimit = { status: event.status, windows: event.windows };
        await this.touch(session);
        return;
      case "unparsed":
        await this.record(session, { kind: "error", text: `unrecognised agent output: ${event.raw}` });
        return;
      case "control_response":
        return;
      case "result":
        await this.onResult(session, live, event);
    }
  }

  private async onResult(session: Session, live: Live, result: Extract<RunnerEvent, { type: "result" }>): Promise<void> {
    clearTimeout(live.stopTimer);
    session.turns += 1;
    if (result.costUsd !== undefined) session.costUsd = live.costBase + result.costUsd;
    for (const denial of result.denials) await this.record(session, { kind: "denied", tool: { name: denial.tool, input: denial.input } });
    const aborted = result.terminalReason === "aborted_streaming";
    await this.record(session, { kind: "result", text: aborted ? "turn stopped" : result.text, isError: result.isError && !aborted, costUsd: session.costUsd });

    if (result.isError && !aborted) {
      const text = result.text ?? "";
      if (/not logged in|\/login|authenticat/i.test(text)) return this.fail(session, "auth", "the agent CLI is not logged in — run `claude` in a terminal and log in");
      if ((session.rateLimit && session.rateLimit.status !== "allowed") || /usage limit|rate limit/i.test(text)) return this.fail(session, "usage-limit", text || "the account's usage limit is reached");
    }
    await this.setState(session, live.pending.length > 0 ? "queued" : "waiting");
    if (session.state === "waiting") this.armIdle(session, live);
    await this.pump();
  }

  private armIdle(session: Session, live: Live): void {
    clearTimeout(live.idleTimer);
    const ms = this.deps.timing?.idleMs ?? this.deps.getConfig().agentSessions.idleMinutes * 60_000;
    live.idleTimer = setTimeout(() => {
      if (session.state === "waiting" && live.proc) this.endProcess(live);
    }, ms);
    (live.idleTimer as { unref?: () => void }).unref?.();
  }

  private endProcess(live: Live): void {
    const proc = live.proc;
    if (!proc) return;
    live.expectExit = true;
    proc.end();
    const timer = setTimeout(() => proc.kill(), END_GRACE_MS);
    (timer as { unref?: () => void }).unref?.();
    void proc.exited.then(() => clearTimeout(timer));
  }

  /** Interrupts the current turn; the conversation stays open. */
  async stop(id: string): Promise<Session> {
    const session = this.get(id);
    const live = this.liveOf(session);
    if (session.state === "queued") {
      live.pending = [];
      await this.setState(session, session.turns > 0 ? "waiting" : "interrupted");
      return session;
    }
    if (session.state !== "running" || !live.proc) throw new SessionError(409, `the session is ${session.state}`);
    const proc = live.proc;
    proc.interrupt();
    live.stopTimer = setTimeout(() => {
      if (session.state !== "running" || live.proc !== proc) return;
      live.expectExit = true; // SIGINT-equivalent fallback: the process goes away, the conversation is resumed later
      proc.kill();
      void this.record(session, { kind: "result", text: "turn stopped" }).then(() => this.setState(session, "waiting")).then(() => this.pump());
    }, this.deps.timing?.stopFallbackMs ?? STOP_FALLBACK_MS);
    return session;
  }

  async close(id: string, options: { removeWorktree?: boolean } = {}): Promise<{ session: Session; worktree?: Removable }> {
    const session = this.get(id);
    if (!OPEN_SESSION_STATES.includes(session.state)) throw new SessionError(409, `the session is ${session.state}`);
    const live = this.liveOf(session);
    live.pending = [];
    clearTimeout(live.idleTimer);
    const exited = live.proc?.exited;
    this.endProcess(live);
    await this.setState(session, "closed");
    let worktree: Removable | undefined;
    if (options.removeWorktree && session.worktreePath) {
      await exited;
      const repo = this.deps.getConfig().repos.find((r) => r.id === session.repoId);
      worktree = repo ? await removeWorktree(repo.path, session.worktreePath) : { removable: false, reason: "the repository is no longer configured" };
      await this.record(session, { kind: worktree.removable ? "state" : "error", text: worktree.removable ? "worktree removed" : `worktree kept: ${worktree.reason}`, state: "closed" });
    }
    await this.pump();
    return { session, worktree };
  }

  async worktreeStatus(id: string): Promise<Removable> {
    const session = this.get(id);
    if (!session.worktreePath) return { removable: false, reason: "the session has no worktree yet" };
    return checkWorktreeRemovable(session.worktreePath);
  }

  async cancel(id: string): Promise<Session> {
    const session = this.get(id);
    if (!OPEN_SESSION_STATES.includes(session.state)) throw new SessionError(409, `the session is ${session.state}`);
    const live = this.liveOf(session);
    live.pending = [];
    live.expectExit = true;
    clearTimeout(live.idleTimer);
    clearTimeout(live.stopTimer);
    live.proc?.kill();
    await this.setState(session, "cancelled");
    await this.pump();
    return session;
  }

  async remove(id: string): Promise<void> {
    const session = this.get(id);
    if (OPEN_SESSION_STATES.includes(session.state)) throw new SessionError(409, "close or cancel the session first");
    await this.store.delete(id);
    this.sessions.delete(id);
    this.live.delete(id);
    this.listeners.delete(id);
  }

  /** Dashboard shutdown: stop every child; work in flight is marked interrupted and can be resumed. */
  async shutdown(): Promise<void> {
    for (const session of this.list()) {
      const live = this.live.get(session.id);
      if (live) {
        live.expectExit = true;
        clearTimeout(live.idleTimer);
        clearTimeout(live.stopTimer);
        live.proc?.kill();
      }
      if (session.state === "running" || session.state === "queued") await this.setState(session, "interrupted");
    }
  }

  private async fail(session: Session, failure: SessionFailure, message: string): Promise<void> {
    const live = this.liveOf(session);
    live.pending = [];
    live.expectExit = true;
    clearTimeout(live.idleTimer);
    live.proc?.kill();
    session.failure = failure;
    session.error = message;
    await this.record(session, { kind: "error", text: message });
    await this.setState(session, "failed");
    await this.pump();
  }

  private async setState(session: Session, state: SessionState): Promise<void> {
    if (session.state === state) return this.touch(session);
    session.state = state;
    await this.record(session, { kind: "state", state });
  }

  private async touch(session: Session): Promise<void> {
    session.updatedAt = new Date().toISOString();
    await this.store.saveMeta(session);
  }

  private async record(session: Session, partial: Omit<SessionEvent, "seq" | "at">): Promise<void> {
    const event: SessionEvent = { seq: ++session.lastSeq, at: new Date().toISOString(), ...partial };
    await this.store.append(session.id, event);
    await this.touch(session);
    for (const listener of this.listeners.get(session.id) ?? []) listener(event);
  }
}
