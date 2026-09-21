// Session manager (design.md D15–D17). A session is an agent CLI running in a terminal inside the change's own git
// worktree. The manager creates the worktree, starts the process, keeps a scrollback for late or returning viewers,
// fans output out to attached terminals and takes their input. It does not interpret what the agent prints.
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { availableActions, OPEN_SESSION_STATES, repoAgentEnabled, SESSION_ACTIONS, SHIPPABLE_WORK, type AgentAvailability, type Config, type Session, type SessionAction, type SessionWorktree, type Snapshot } from "../../shared/types.ts";
import { worktreesDir } from "../paths.ts";
import { CHANGE_NAME } from "../source.ts";
import { agentEnv, agentFor, availability, launchCommand, openingPrompt, shipPrompt } from "./agents.ts";
import { SessionStore } from "./store.ts";
import { spawnTerminal, type TerminalProcess } from "./terminal.ts";
import { listWorktrees, readWorkStatus, WORKTREE_NAME } from "./workStatus.ts";
import { checkWorktreeRemovable, copyChangeIfMissing, ensureWorktree, removeWorktree, type Removable } from "./worktree.ts";

export const SCROLLBACK_BYTES = 1024 * 1024;
const TYPE_PROMPT_DELAY_MS = 1500;
const OUTPUT_STAMP_MS = 5000;
const WORKTREES_TTL_MS = 15_000;

export class SessionError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Archiving gets a worktree of its own: the implementation worktree of the same change may still exist, on an old base. */
export function worktreeName(action: SessionAction, change: string): string {
  return action === "archive" ? `archive-${change}` : change;
}

export function sessionBranch(action: SessionAction, change: string): string {
  return action === "archive" ? `chore/archive-${change}` : `feat/${change}`;
}

/** Keeps the last `limit` bytes of terminal output, for viewers that attach later. */
export class Scrollback {
  private chunks: Uint8Array[] = [];
  private size = 0;
  constructor(private readonly limit = SCROLLBACK_BYTES) {}

  push(chunk: Uint8Array): void {
    this.chunks.push(chunk);
    this.size += chunk.length;
    while (this.size > this.limit && this.chunks.length > 1) this.size -= (this.chunks.shift() as Uint8Array).length;
  }

  bytes(): Uint8Array {
    const out = new Uint8Array(this.size);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

type Viewer = (chunk: Uint8Array) => void;

interface Live {
  proc?: TerminalProcess;
  scrollback: Scrollback;
  viewers: Set<Viewer>;
  lastStamp: number;
}

export interface ManagerDeps {
  getConfig: () => Config;
  getSnapshot: () => Snapshot;
  store?: SessionStore;
  /** Test seam; the real delay gives an agent time to draw its prompt before text is typed into it. */
  typePromptDelayMs?: number;
}

export class SessionManager {
  private sessions = new Map<string, Session>();
  private live = new Map<string, Live>();
  private readonly store: SessionStore;
  private worktreeCache?: { at: number; list: Promise<SessionWorktree[]> };

  constructor(private readonly deps: ManagerDeps) {
    this.store = deps.store ?? new SessionStore();
  }

  /** Loads stored sessions. A terminal cannot outlive the dashboard, so anything recorded as running has ended. */
  async init(): Promise<void> {
    for (const session of await this.store.loadAll()) {
      this.sessions.set(session.id, session);
      if (session.state === "running") await this.end(session, null, "the dashboard was restarted while this session was running");
    }
  }

  agents(): AgentAvailability[] {
    return availability(this.deps.getConfig());
  }

  list(): Session[] {
    return [...this.sessions.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): Session {
    const session = this.sessions.get(id);
    if (!session) throw new SessionError(404, "unknown session");
    return session;
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

    const agent = agentFor(config, repo);
    if (!agent) throw new SessionError(503, "no agent is configured");
    const prompt = openingPrompt(agent, action, change);
    if (!prompt) throw new SessionError(400, `${agent.name} has no "${action}" prompt configured`);
    if (!Bun.which(agent.command[0])) throw new SessionError(503, `${agent.name} was not found (${agent.command[0]}); install it or change its command in Settings`);

    const now = new Date().toISOString();
    const session: Session = {
      id: randomUUID(),
      repoId: repo.id,
      change,
      action,
      agentId: agent.id,
      agentName: agent.name,
      state: "running",
      worktreePath: join(worktreesDir(), repo.id, worktreeName(action, change)),
      branch: sessionBranch(action, change),
      createdAt: now,
      updatedAt: now,
      resumable: agent.resumeCommand !== undefined,
    };
    try {
      await ensureWorktree(repo.path, session.worktreePath, session.branch);
      await copyChangeIfMissing(repo.path, session.worktreePath, change);
    } catch (err) {
      throw new SessionError(500, err instanceof Error ? err.message : String(err));
    }
    this.sessions.set(session.id, session);
    await this.store.saveMeta(session);
    const launch = launchCommand(agent, prompt);
    this.start(session, launch.argv, agentEnv(agent, process.env), launch.typed);
    for (const removed of await this.store.prune(this.list())) this.sessions.delete(removed);
    return session;
  }

  /**
   * Every session worktree with what became of its work. Cached briefly (the UI polls) and shared while in flight;
   * anything that changes a worktree's state drops the cache. With the feature off, no git runs at all.
   */
  worktrees(): Promise<SessionWorktree[]> {
    const config = this.deps.getConfig();
    if (!config.agentSessions.enabled) return Promise.resolve([]);
    const cached = this.worktreeCache;
    if (cached && Date.now() - cached.at < WORKTREES_TTL_MS) return cached.list;
    const list = listWorktrees(config.repos, this.list());
    this.worktreeCache = { at: Date.now(), list };
    list.catch(() => {
      if (this.worktreeCache?.list === list) this.worktreeCache = undefined;
    });
    return list;
  }

  private forgetWorktrees(): void {
    this.worktreeCache = undefined;
  }

  /** Checks shared by everything that starts an agent again in an existing session's worktree. */
  private async prepareRestart(session: Session) {
    const config = this.deps.getConfig();
    if (!config.agentSessions.enabled) throw new SessionError(403, "agent sessions are disabled");
    const agent = config.agentSessions.agents.find((a) => a.id === session.agentId);
    if (!agent) throw new SessionError(409, "this session's agent is no longer configured");
    const running = this.list().find((s) => s.id !== session.id && s.repoId === session.repoId && s.change === session.change && s.state === "running");
    if (running) throw new SessionError(409, "another session for this change is running");
    const repo = config.repos.find((r) => r.id === session.repoId);
    if (!repo) throw new SessionError(409, "the repository is no longer configured");
    return { agent, repo };
  }

  private async restart(session: Session, repoPath: string, argv: string[], env: Record<string, string>, typed?: string): Promise<void> {
    try {
      await ensureWorktree(repoPath, session.worktreePath, session.branch);
    } catch (err) {
      throw new SessionError(500, err instanceof Error ? err.message : String(err));
    }
    session.state = "running";
    session.exitCode = undefined;
    session.error = undefined;
    await this.touch(session);
    this.start(session, argv, env, typed);
  }

  /**
   * Asks the agent to commit, push and open a pull request; the dashboard does none of that itself. A running agent
   * gets the prompt typed into its terminal; an ended one is started again in the worktree, continuing its
   * conversation when it can, so it still knows what it did.
   */
  async ship(id: string): Promise<Session> {
    const session = this.get(id);
    const { agent, repo } = await this.prepareRestart(session);
    const { work } = await readWorkStatus(repo.path, session.worktreePath);
    if (!SHIPPABLE_WORK.includes(work.state)) throw new SessionError(409, `there is nothing to ship (${work.state})`);
    const prompt = shipPrompt(agent, session.change);
    this.forgetWorktrees();
    const proc = this.live.get(id)?.proc;
    if (session.state === "running" && proc) {
      proc.write(`${prompt}\r`);
      return session;
    }
    const launch = agent.resumeCommand ? { argv: [...agent.resumeCommand], typed: prompt } : launchCommand(agent, prompt);
    if (!Bun.which(launch.argv[0])) throw new SessionError(503, `${agent.name} was not found (${launch.argv[0]})`);
    await this.restart(session, repo.path, launch.argv, agentEnv(agent, process.env), launch.typed);
    return session;
  }

  /** For worktrees whose session record is gone; the path is built here, never taken from the request. */
  async removeWorktreeByName(input: { repoId?: unknown; name?: unknown }): Promise<Removable> {
    if (typeof input.name !== "string" || !WORKTREE_NAME.test(input.name)) throw new SessionError(400, "invalid worktree name");
    const repo = this.deps.getConfig().repos.find((r) => r.id === input.repoId);
    if (!repo) throw new SessionError(404, "unknown repository");
    const path = join(worktreesDir(), repo.id, input.name);
    if (this.list().some((s) => s.worktreePath === path && s.state === "running")) throw new SessionError(409, "a session is running in this worktree");
    const { work } = await readWorkStatus(repo.path, path);
    if (work.state === "missing") throw new SessionError(404, "unknown worktree");
    this.forgetWorktrees();
    return removeWorktree(repo.path, path, work.state === "merged");
  }

  /** Continues the agent's latest conversation in the session's worktree, in the same session record. */
  async resume(id: string): Promise<Session> {
    const session = this.get(id);
    if (session.state === "running") return session;
    const { agent, repo } = await this.prepareRestart(session);
    if (!agent.resumeCommand) throw new SessionError(400, "this agent has no resume command configured");
    if (!Bun.which(agent.resumeCommand[0])) throw new SessionError(503, `${agent.name} was not found (${agent.resumeCommand[0]})`);
    await this.restart(session, repo.path, [...agent.resumeCommand], agentEnv(agent, process.env));
    return session;
  }

  private start(session: Session, argv: string[], env: Record<string, string>, typed?: string): void {
    const live: Live = { scrollback: this.live.get(session.id)?.scrollback ?? new Scrollback(), viewers: this.live.get(session.id)?.viewers ?? new Set(), lastStamp: 0 };
    this.live.set(session.id, live);
    let proc: TerminalProcess;
    try {
      proc = spawnTerminal({ argv, cwd: session.worktreePath, env, onData: (chunk) => this.onOutput(session, live, chunk) });
    } catch (err) {
      session.state = "failed";
      session.error = `could not start the agent: ${err instanceof Error ? err.message : String(err)}`;
      void this.touch(session);
      return;
    }
    live.proc = proc;
    if (typed) {
      const timer = setTimeout(() => live.proc === proc && proc.write(`${typed}\r`), this.deps.typePromptDelayMs ?? TYPE_PROMPT_DELAY_MS);
      (timer as { unref?: () => void }).unref?.();
    }
    void proc.exited.then((code) => {
      if (live.proc !== proc) return;
      live.proc = undefined;
      void this.end(session, code);
    });
  }

  private onOutput(session: Session, live: Live, chunk: Uint8Array): void {
    live.scrollback.push(chunk);
    for (const viewer of live.viewers) viewer(chunk);
    const now = Date.now();
    session.lastOutputAt = new Date(now).toISOString();
    if (now - live.lastStamp > OUTPUT_STAMP_MS) {
      live.lastStamp = now;
      void this.touch(session);
    }
  }

  private async end(session: Session, exitCode: number | null, error?: string): Promise<void> {
    session.state = "exited";
    session.exitCode = exitCode;
    if (error) session.error = error;
    this.forgetWorktrees();
    const live = this.live.get(session.id);
    if (live) await this.store.saveOutput(session.id, live.scrollback.bytes()).catch(() => undefined);
    await this.touch(session);
    for (const viewer of live?.viewers ?? []) viewer(new Uint8Array()); // an empty chunk tells viewers the process ended
  }

  /**
   * Attaches a viewer: returns what the terminal has shown so far and then streams new output. For an ended session
   * the stored tail is returned and nothing follows.
   */
  async attach(id: string, viewer: Viewer): Promise<{ scrollback: Uint8Array; detach: () => void }> {
    const session = this.get(id);
    const live = this.live.get(id);
    if (!live) return { scrollback: await this.store.readOutput(session.id), detach: () => {} };
    live.viewers.add(viewer);
    return { scrollback: live.scrollback.bytes(), detach: () => live.viewers.delete(viewer) };
  }

  write(id: string, data: string): void {
    this.live.get(id)?.proc?.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    this.live.get(id)?.proc?.resize(cols, rows);
  }

  /** Ends the agent (as closing its terminal window would) and optionally removes the worktree when that is safe. */
  async close(id: string, options: { removeWorktree?: boolean } = {}): Promise<{ session: Session; worktree?: Removable }> {
    const session = this.get(id);
    const proc = this.live.get(id)?.proc;
    if (proc) {
      proc.kill();
      await proc.exited;
      // `end` runs from the exit handler; wait for the state it writes
      for (let i = 0; i < 50 && session.state === "running"; i++) await new Promise((r) => setTimeout(r, 20));
    }
    let worktree: Removable | undefined;
    if (options.removeWorktree) {
      const repo = this.deps.getConfig().repos.find((r) => r.id === session.repoId);
      worktree = repo ? await removeWorktree(repo.path, session.worktreePath, await this.isMerged(repo.path, session)) : { removable: false, reason: "the repository is no longer configured" };
      this.forgetWorktrees();
    }
    return { session, worktree };
  }

  private async isMerged(repoPath: string, session: Session): Promise<boolean> {
    return (await readWorkStatus(repoPath, session.worktreePath)).work.state === "merged";
  }

  async worktreeStatus(id: string): Promise<Removable> {
    const session = this.get(id);
    const repo = this.deps.getConfig().repos.find((r) => r.id === session.repoId);
    return checkWorktreeRemovable(session.worktreePath, repo ? await this.isMerged(repo.path, session) : false);
  }

  async remove(id: string): Promise<void> {
    const session = this.get(id);
    if (session.state === "running") throw new SessionError(409, "close the session first");
    await this.store.delete(id);
    this.sessions.delete(id);
    this.live.delete(id);
  }

  /** Dashboard shutdown: terminals cannot outlive it, so every agent is ended and its output tail kept. */
  async shutdown(): Promise<void> {
    await Promise.all(
      this.list()
        .filter((s) => s.state === "running")
        .map(async (session) => {
          const live = this.live.get(session.id);
          const proc = live?.proc;
          if (live) live.proc = undefined; // the exit handler must not overwrite the reason
          proc?.kill();
          await this.end(session, null, "the dashboard was stopped while this session was running");
        }),
    );
  }

  private async touch(session: Session): Promise<void> {
    session.updatedAt = new Date().toISOString();
    await this.store.saveMeta(session);
  }
}
