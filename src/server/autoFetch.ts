// Auto fetch: for a project whose setting the user switched on, the pull action's fetch — and only that — on the
// interval they chose (openspec/specs/repository-pull: "A project can be fetched automatically, fetch only").
//
// One timer per opted-in repository and none otherwise, so a dashboard where nobody opted in schedules nothing at all.
// `plan()` is re-run after every config write and every scan; it keeps a timer whose interval did not change, so a
// rescan never postpones a fetch. A timer that fires re-checks eligibility first, then re-arms one interval later,
// whatever came of the fetch: a failing remote is tried again at the next interval, never sooner.
import type { AutoFetchOutcome, Config, PullResult, RepoConfig, RepoSnapshot, Snapshot } from "../shared/types.ts";
import { type FetchOutcome, fetchRepository } from "./pull.ts";

const CONCURRENCY = 3;

export interface AutoFetcherDeps {
  getConfig: () => Config;
  getSnapshot: () => Snapshot;
  /** A fetch moved a remote-tracking ref: rescan, and recompute work statuses rather than serve them from a cache. */
  onMoved: (repoId: string) => void;
  /** Test seams. */
  fetch?: (repo: RepoConfig) => Promise<FetchOutcome>;
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

interface Planned {
  minutes: number;
  timer: unknown;
}

export class AutoFetcher {
  private readonly planned = new Map<string, Planned>();
  private readonly outcomes = new Map<string, AutoFetchOutcome>();
  private readonly queue: string[] = [];
  private running = 0;
  private stopped = false;

  constructor(private readonly deps: AutoFetcherDeps) {}

  /** The interval a repository is fetched at right now, or undefined when it is not fetched automatically. */
  private dueMinutes(repo: RepoConfig, scanned: RepoSnapshot | undefined): number | undefined {
    if (!repo.enabled || repo.autoFetchMinutes === undefined) return undefined;
    // Skipped without running git: not scanned yet, scan failed, not git, or nothing to fetch from.
    if (!scanned?.ok || !scanned.isGit || scanned.hasRemote !== true) return undefined;
    return repo.autoFetchMinutes;
  }

  /** Arms, keeps or clears each repository's timer to match the configuration and the latest scan. */
  plan(): void {
    if (this.stopped) return;
    const scanned = new Map(this.deps.getSnapshot().repos.map((r) => [r.id, r]));
    const wanted = new Map<string, number>();
    for (const repo of this.deps.getConfig().repos) {
      const minutes = this.dueMinutes(repo, scanned.get(repo.id));
      if (minutes !== undefined) wanted.set(repo.id, minutes);
    }
    for (const [id, planned] of this.planned) {
      if (wanted.get(id) === planned.minutes) continue;
      this.clear(planned.timer);
      this.planned.delete(id);
    }
    for (const [id, minutes] of wanted) if (!this.planned.has(id)) this.arm(id, minutes);
    // A forgotten repository leaves no outcome behind.
    const configured = new Set(this.deps.getConfig().repos.map((r) => r.id));
    for (const id of this.outcomes.keys()) if (!configured.has(id)) this.outcomes.delete(id);
  }

  stop(): void {
    this.stopped = true;
    for (const planned of this.planned.values()) this.clear(planned.timer);
    this.planned.clear();
    this.queue.length = 0;
  }

  /** What the last automatic fetch of the repository, or a pull after it, came to. */
  outcome(repoId: string): AutoFetchOutcome | undefined {
    return this.outcomes.get(repoId);
  }

  /** A pull's fetch is the repository's most recent fetch too: a success clears a reported failure. */
  notePull(result: PullResult): void {
    if (!result.fetched) return;
    this.outcomes.set(result.repoId, { at: new Date().toISOString(), ok: true });
  }

  /** The snapshot as the API serves it: each repository with its last automatic-fetch outcome. Display only. */
  withOutcomes(snapshot: Snapshot): Snapshot {
    if (this.outcomes.size === 0) return snapshot;
    return { ...snapshot, repos: snapshot.repos.map((r) => (this.outcomes.has(r.id) ? { ...r, autoFetch: this.outcomes.get(r.id) } : r)) };
  }

  private arm(id: string, minutes: number): void {
    const timer = (this.deps.setTimer ?? defaultSetTimer)(() => this.fire(id, minutes), minutes * 60_000);
    this.planned.set(id, { minutes, timer });
  }

  private clear(timer: unknown): void {
    (this.deps.clearTimer ?? defaultClearTimer)(timer);
  }

  private fire(id: string, minutes: number): void {
    if (this.stopped || this.planned.get(id)?.minutes !== minutes) return;
    this.arm(id, minutes);
    if (!this.queue.includes(id)) this.queue.push(id);
    this.drain();
  }

  private drain(): void {
    while (this.running < CONCURRENCY && this.queue.length > 0) {
      const id = this.queue.shift() as string;
      this.running++;
      void this.fetchOne(id).finally(() => {
        this.running--;
        this.drain();
      });
    }
  }

  private async fetchOne(id: string): Promise<void> {
    // The setting may have been switched off, or the project disabled, since the timer was armed.
    const repo = this.deps.getConfig().repos.find((r) => r.id === id);
    const scanned = this.deps.getSnapshot().repos.find((r) => r.id === id);
    if (this.stopped || !repo || this.dueMinutes(repo, scanned) === undefined) return;
    let outcome: FetchOutcome;
    try {
      outcome = await (this.deps.fetch ?? fetchRepository)(repo);
    } catch (err) {
      outcome = { ok: false, at: new Date().toISOString(), moved: false, reason: err instanceof Error ? err.message : String(err) };
    }
    // A pull was running: its own outcome is what counts, and the next attempt is one interval later.
    if (outcome.skipped || this.stopped) return;
    this.outcomes.set(id, outcome.ok ? { at: outcome.at, ok: true } : { at: outcome.at, ok: false, reason: outcome.reason });
    if (outcome.moved) this.deps.onMoved(id);
  }
}

function defaultSetTimer(run: () => void, ms: number): unknown {
  const timer = setTimeout(run, ms);
  // A pending fetch must never keep the process alive on its own.
  (timer as { unref?: () => void }).unref?.();
  return timer;
}

function defaultClearTimer(timer: unknown): void {
  clearTimeout(timer as ReturnType<typeof setTimeout>);
}
