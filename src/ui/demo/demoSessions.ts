// The demo's simulated agent sessions: a seed that shows every state on first load, and an in-memory stand-in for the
// dashboard's session manager. Nothing is started and nothing leaves the page; a reload starts over.
//
// All of it is invented, like the rest of the sample (see sampleData.ts): every repository, change, branch and path
// comes from the sample, and terminal output comes from the hand-written transcripts.
import { availableActions, type Config, type Session, type SessionAction, type PromptResult, type SessionWorktree, type ShipResult, SHIPPABLE_WORK, type Snapshot, type WorkStatus, type Worktree } from "../../shared/types.ts";
import { ApiError, type TerminalConnection, type TerminalHandlers } from "../api.ts";
import { DEMO_AGENT, DEMO_ROOT } from "./sampleData.ts";
import { type Clock, type Playback, type Position, playTranscript, positionAfter, TRANSCRIPTS, type TranscriptName, workAfter } from "./transcripts.ts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Same names the dashboard uses for a session's worktree and branch. */
const worktreeName = (action: SessionAction, change: string) => (action === "archive" ? `archive-${change}` : change);
const sessionBranch = (action: SessionAction, change: string) => (action === "archive" ? `chore/archive-${change}` : `feat/${change}`);
export const sessionWorktreePath = (repoId: string, name: string) => `${DEMO_ROOT.replace(/\/[^/]+$/, "")}/.openspec-dashboard/worktrees/${repoId}/${name}`;

interface Seed {
  repo: string;
  change: string;
  action: SessionAction;
  transcript: TranscriptName;
  /** How long ago the session started. */
  startedAgo: number;
  /** For sessions that ended: how long ago, and what the worktree looks like now. Absent = still running. */
  ended?: { ago: number; work: WorkStatus; failed?: string };
}

// One of everything the UI distinguishes, spread over the sample's repositories.
const SEEDS: Seed[] = [
  // started a minute and a half ago, with several minutes of recording still ahead of it
  { repo: "atlas-api", change: "add-rate-limiting", action: "implement", transcript: "implement", startedAgo: 1.5 * MINUTE },
  { repo: "harbor-web", change: "keyboard-shortcuts", action: "implement", transcript: "implementAsking", startedAgo: 12 * MINUTE },
  { repo: "lantern-infra", change: "pin-terraform-providers", action: "implement", transcript: "implement", startedAgo: 4 * HOUR, ended: { ago: 3 * HOUR, work: { state: "uncommitted", count: 3 } } },
  { repo: "harbor-web", change: "dark-mode-tokens", action: "implement", transcript: "implement", startedAgo: 2 * DAY + 2 * HOUR, ended: { ago: 2 * DAY, work: { state: "unpushed", count: 2, base: "origin/main" } } },
  { repo: "quill-docs", change: "versioned-api-reference", action: "implement", transcript: "implement", startedAgo: 6 * HOUR, ended: { ago: 5 * HOUR, work: { state: "pushed", base: "origin/main" } } },
  { repo: "atlas-api", change: "deprecate-v1-auth", action: "archive", transcript: "archive", startedAgo: 1 * DAY, ended: { ago: 23 * HOUR, work: { state: "merged", base: "origin/main" } } },
  { repo: "lantern-infra", change: "cost-allocation-tags", action: "draft", transcript: "draft", startedAgo: 50 * MINUTE, ended: { ago: 45 * MINUTE, work: { state: "clean", base: "origin/main" } } },
  { repo: "ember-mobile", change: "offline-sync-queue", action: "implement", transcript: "implement", startedAgo: 20 * MINUTE, ended: { ago: 20 * MINUTE, work: { state: "missing" }, failed: "could not create the worktree: the branch is checked out elsewhere" } },
];
/** A worktree whose session record is gone: the archive worktree of a change that is archived by now. */
const ORPHAN = { repo: "atlas-api", change: "add-health-endpoint", action: "archive" as SessionAction, work: { state: "unpushed", count: 1, base: "origin/main" } as WorkStatus, ago: 3 * DAY };

interface DemoSession {
  session: Session;
  name: string;
  transcript: TranscriptName;
  startedAtMs: number;
  /** Set once the terminal has been opened; until then the position follows from the elapsed time. */
  position?: Position;
  /** The worktree's status before the milestones of the steps from `workFrom` on are applied. */
  work: WorkStatus;
  /** Milestones before this step are already part of `work` (a session seeded as ended has all of them in it). */
  workFrom: number;
  lastActivityMs: number;
  removed?: boolean;
}

export interface DemoSessionsOptions {
  now(): number;
  getConfig(): Config;
  getSnapshot(): Snapshot;
  clock?: Clock;
}

export function createDemoSessions({ now, getConfig, getSnapshot, clock }: DemoSessionsOptions) {
  const iso = (ms: number) => new Date(ms).toISOString();
  const started = now();
  let counter = 0;
  const sample = getSnapshot();
  const repoOf = (name: string) => {
    const repo = sample.repos.find((r) => r.name === name);
    if (!repo) throw new Error(`demo seed names an unknown repository: ${name}`);
    return repo;
  };

  /** A change whose branch is already checked out in one of the sample's worktrees is worked on there (adopted). */
  const placeFor = (repoId: string, change: string, action: SessionAction) => {
    const branch = sessionBranch(action, change);
    const lives = getSnapshot().repos.find((r) => r.id === repoId)?.changes.find((c) => c.name === change && !c.archived)?.checkout;
    const adopted = action !== "archive" && lives !== undefined && !lives.isMain && lives.branch === branch;
    return { branch, adopted, path: adopted ? lives.path : sessionWorktreePath(repoId, worktreeName(action, change)) };
  };

  const sessions: DemoSession[] = SEEDS.map((seed) => {
    const repo = repoOf(seed.repo);
    const place = placeFor(repo.id, seed.change, seed.action);
    const createdAt = started - seed.startedAgo;
    const endedAt = seed.ended ? started - seed.ended.ago : undefined;
    const steps = TRANSCRIPTS[seed.transcript];
    const position = seed.ended ? { index: steps.length, waiting: false } : positionAfter(steps, seed.startedAgo);
    // a question that has been sitting there: the last output is the question itself
    const quietSince = position.waiting ? createdAt + steps.slice(0, position.index + 1).reduce((t, s) => t + (s.after ?? 0), 0) : started - 5_000;
    return {
      name: worktreeName(seed.action, seed.change),
      transcript: seed.transcript,
      startedAtMs: createdAt,
      position: seed.ended ? position : undefined,
      work: seed.ended?.work ?? { state: "clean", base: "origin/main" },
      workFrom: seed.ended ? steps.length : 0,
      lastActivityMs: endedAt ?? quietSince,
      session: {
        id: `demo-${++counter}`,
        repoId: repo.id,
        change: seed.change,
        action: seed.action,
        agentId: DEMO_AGENT.id,
        agentName: DEMO_AGENT.name,
        state: seed.ended?.failed ? "failed" : seed.ended ? "exited" : "running",
        exitCode: seed.ended && !seed.ended.failed ? 0 : undefined,
        error: seed.ended?.failed,
        worktreePath: place.path,
        adopted: place.adopted || undefined,
        branch: place.branch,
        createdAt: iso(createdAt),
        updatedAt: iso(endedAt ?? quietSince),
        lastOutputAt: seed.ended?.failed ? undefined : iso(endedAt ?? quietSince),
        resumable: !seed.ended?.failed,
      },
    };
  });

  const orphanRepo = repoOf(ORPHAN.repo);
  const orphans: SessionWorktree[] = [
    {
      repoId: orphanRepo.id,
      name: worktreeName(ORPHAN.action, ORPHAN.change),
      path: sessionWorktreePath(orphanRepo.id, worktreeName(ORPHAN.action, ORPHAN.change)),
      change: ORPHAN.change,
      action: ORPHAN.action,
      branch: sessionBranch(ORPHAN.action, ORPHAN.change),
      work: ORPHAN.work,
      lastActivityAt: iso(started - ORPHAN.ago),
    },
  ];

  const playing = new Map<string, { playback: Playback; handlers: TerminalHandlers }>();

  const find = (id: string) => {
    const found = sessions.find((s) => s.session.id === id);
    if (!found) throw new ApiError(404, "unknown session");
    return found;
  };
  const requireEnabled = () => {
    if (!getConfig().agentSessions.enabled) throw new ApiError(403, "agent sessions are disabled");
  };

  /** Where a session's transcript stands right now, and what its worktree looks like because of it. */
  const positionOf = (s: DemoSession): Position => s.position ?? positionAfter(TRANSCRIPTS[s.transcript], now() - s.startedAtMs);
  const workOf = (s: DemoSession): WorkStatus => {
    if (s.removed || s.session.state === "failed") return { state: "missing" };
    const steps = TRANSCRIPTS[s.transcript];
    return workAfter(steps.slice(s.workFrom), Math.max(0, positionOf(s).index - s.workFrom), s.work) ?? s.work;
  };

  const removable = (work: WorkStatus, adopted?: boolean): { removable: boolean; reason?: string } => {
    if (adopted) return { removable: false, reason: "this worktree was not created by the dashboard (the session adopted it), so it is kept" };
    if (work.state === "uncommitted") return { removable: false, reason: "the worktree has uncommitted changes" };
    if (work.state === "unpushed") return { removable: false, reason: `${work.count ?? 1} commit(s) exist only on this worktree's branch` };
    if (work.state === "missing") return { removable: false, reason: "worktree no longer exists" };
    return { removable: true };
  };

  const end = (s: DemoSession, exitCode = 0) => {
    // what the transcript did to the worktree stays; the transcript itself is over
    s.work = workOf(s);
    s.workFrom = TRANSCRIPTS[s.transcript].length;
    s.position = { index: TRANSCRIPTS[s.transcript].length, waiting: false };
    s.session.state = "exited";
    s.session.exitCode = exitCode;
    s.session.updatedAt = iso(now());
    s.lastActivityMs = now();
  };

  const play = (s: DemoSession, handlers: TerminalHandlers, continuing: boolean) => {
    const playback = playTranscript(TRANSCRIPTS[s.transcript], {
      from: s.session.state === "running" ? positionOf(s) : { index: TRANSCRIPTS[s.transcript].length, waiting: false },
      continuing,
      clock,
      values: { change: s.session.change, branch: s.session.branch ?? "", path: s.session.worktreePath },
      handlers: {
        ...handlers,
        onExit: () => {
          end(s);
          handlers.onExit();
        },
      },
      onProgress: (position) => {
        s.position = position;
        s.session.lastOutputAt = iso(now());
        s.lastActivityMs = now();
      },
    });
    playing.set(s.session.id, { playback, handlers });
    return playback;
  };

  /** Starts another transcript in a session, on the terminal that is open for it (if one is). */
  const run = (s: DemoSession, transcript: TranscriptName) => {
    s.work = workOf(s);
    s.workFrom = 0;
    s.transcript = transcript;
    s.startedAtMs = now();
    s.position = { index: 0, waiting: false };
    s.session.state = "running";
    s.session.exitCode = undefined;
    s.session.updatedAt = iso(now());
    s.lastActivityMs = now();
    const open = playing.get(s.session.id);
    if (open) {
      open.playback.close();
      play(s, open.handlers, true);
    }
  };

  /** Seeded transcripts play on in the background while nobody watches them: unless one sits at a question, it printed just now. */
  const printing = (s: DemoSession) => s.session.state === "running" && !s.position && !positionOf(s).waiting;
  const listed = (s: DemoSession): Session => (printing(s) ? { ...s.session, lastOutputAt: iso(now() - 5_000) } : s.session);

  const worktrees = (): SessionWorktree[] => [
    ...sessions
      .filter((s) => workOf(s).state !== "missing")
      .map((s) => ({
        repoId: s.session.repoId,
        name: s.name,
        path: s.session.worktreePath,
        change: s.session.change,
        action: s.session.action,
        branch: s.session.branch,
        work: workOf(s),
        lastActivityAt: iso(printing(s) ? now() - 5_000 : s.lastActivityMs),
        sessionId: s.session.id,
      })),
    ...orphans,
  ];

  return {
    /** Worktrees `git worktree list` would report for a repository because of its sessions. */
    gitWorktrees(repoId: string): Worktree[] {
      return worktrees()
        .filter((w) => w.repoId === repoId && !sessions.find((s) => s.session.id === w.sessionId)?.session.adopted)
        .map((w) => ({ path: w.path, branch: w.branch }));
    },

    list() {
      const enabled = getConfig().agentSessions.enabled;
      return {
        sessions: enabled ? sessions.map(listed) : [],
        agents: [{ id: DEMO_AGENT.id, name: DEMO_AGENT.name, available: true, path: "/home/demo/bin/demo-agent" }],
        worktrees: enabled ? worktrees() : [],
      };
    },

    open(repoId: string, change: string, action: SessionAction): Session {
      requireEnabled();
      const repo = getConfig().repos.find((r) => r.id === repoId);
      if (!repo) throw new ApiError(404, "unknown repository");
      if (!repo.enabled) throw new ApiError(409, "the repository is not tracked");
      const scanned = getSnapshot().repos.find((r) => r.id === repoId);
      if (!scanned?.ok) throw new ApiError(409, "the repository's last scan failed");
      const snapshot = scanned.changes.find((c) => c.name === change && !c.archived);
      if (!snapshot) throw new ApiError(404, "unknown change");
      if (!availableActions(snapshot).includes(action)) throw new ApiError(400, `"${action}" is not available for this change in its current stage`);
      const existing = sessions.find((s) => s.session.repoId === repoId && s.session.change === change && s.session.state === "running");
      if (existing) return existing.session;

      const place = placeFor(repoId, change, action);
      const at = now();
      const created: DemoSession = {
        name: worktreeName(action, change),
        transcript: action,
        startedAtMs: at,
        position: { index: 0, waiting: false },
        work: { state: "clean", base: "origin/main" },
        workFrom: 0,
        lastActivityMs: at,
        session: {
          id: `demo-${++counter}`,
          repoId,
          change,
          action,
          agentId: DEMO_AGENT.id,
          agentName: DEMO_AGENT.name,
          state: "running",
          worktreePath: place.path,
          adopted: place.adopted || undefined,
          branch: place.branch,
          createdAt: iso(at),
          updatedAt: iso(at),
          lastOutputAt: iso(at),
          resumable: true,
        },
      };
      // a fresh session takes over the worktree an ended one left behind
      for (const old of sessions) if (old.session.worktreePath === place.path && old.session.state !== "running") created.work = workOf(old);
      sessions.unshift(created);
      return created.session;
    },

    terminal(id: string, handlers: TerminalHandlers): TerminalConnection {
      const s = find(id);
      const playback = play(s, handlers, false);
      return {
        send: (message) => playback.send(message),
        close: () => {
          playing.get(id)?.playback.close();
          playing.delete(id);
        },
      };
    },

    resume(id: string): Session {
      requireEnabled();
      const s = find(id);
      if (sessions.some((o) => o !== s && o.session.worktreePath === s.session.worktreePath && o.session.state === "running")) throw new ApiError(409, "another session is running in this worktree");
      run(s, "resume");
      return s.session;
    },

    ship(id: string): ShipResult {
      const s = find(id);
      const work = workOf(s);
      if (!SHIPPABLE_WORK.includes(work.state)) throw new ApiError(409, `there is nothing to ship (${work.state})`);
      run(s, "ship");
      return { ...s.session, submitted: true };
    },

    prompt(id: string, action: SessionAction): PromptResult {
      requireEnabled();
      const s = find(id);
      if (action === "archive" || s.session.action === "archive") throw new ApiError(400, "archiving runs in its own session");
      if (s.session.state !== "running") throw new ApiError(409, "the session is not running");
      // Sent with one activation, as in the dashboard: the recording's agent takes the prompt up straight away.
      s.session.action = action;
      run(s, action);
      return { ...s.session, submitted: true };
    },

    status(id: string) {
      const s = find(id);
      const work = workOf(s);
      return { ...removable(work, s.session.adopted), work };
    },

    close(id: string, removeWorktree: boolean) {
      const s = find(id);
      const open = playing.get(id);
      if (s.session.state === "running") {
        open?.playback.close();
        end(s, 0);
        open?.handlers.onExit();
        open?.handlers.onClose();
        playing.delete(id);
      }
      if (!removeWorktree) return { session: s.session };
      const worktree = removable(workOf(s), s.session.adopted);
      if (worktree.removable) s.removed = true;
      return { session: s.session, worktree };
    },

    removeWorktree(repoId: string, name: string) {
      if (!getConfig().repos.some((r) => r.id === repoId)) throw new ApiError(404, "unknown repository");
      const path = sessionWorktreePath(repoId, name);
      if (sessions.some((s) => s.session.worktreePath === path && s.session.state === "running")) throw new ApiError(409, "a session is running in this worktree");
      const owner = sessions.find((s) => s.session.worktreePath === path && !s.removed);
      const orphan = orphans.findIndex((w) => w.path === path);
      if (!owner && orphan < 0) throw new ApiError(404, "unknown worktree");
      const result = removable(owner ? workOf(owner) : orphans[orphan].work, owner?.session.adopted);
      if (result.removable && owner) owner.removed = true;
      if (result.removable && !owner) orphans.splice(orphan, 1);
      return result;
    },

    delete(id: string) {
      const s = find(id);
      if (s.session.state === "running") throw new ApiError(409, "close the session first");
      sessions.splice(sessions.indexOf(s), 1);
      // the record is gone, the worktree is not: it stays in the Open work list on its own
      const work = workOf(s);
      if (work.state !== "missing" && !s.session.adopted) {
        orphans.push({ repoId: s.session.repoId, name: s.name, path: s.session.worktreePath, change: s.session.change, action: s.session.action, branch: s.session.branch, work, lastActivityAt: iso(s.lastActivityMs) });
      }
      return { deleted: true };
    },
  };
}
