// The update check (openspec/specs/update-notice): learn the tag of this project's latest release from the redirect of
// `/releases/latest`, compare it with the running version, and remember the outcome under the dashboard home.
//
// One `HEAD` request, redirects not followed, only `Location` read; it carries nothing but the version in `User-Agent`.
// The URL is a constant: nothing a user can configure points the check elsewhere — tests inject `request` instead.
// About a minute after start, then at most once every 24 hours, counted from the remembered last check so a restart
// does not check again; never for a build that is not a release version, never while `updateCheck: false`. `plan()` is
// re-run after every config write, like the auto-fetch schedule, so turning the setting off cancels the timer at once.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Config, UpdateStatus } from "../shared/types.ts";
import { isNewer, isReleaseVersion } from "../shared/versions.ts";
import { updateCheckPath } from "./paths.ts";

export const LATEST_RELEASE_URL = "https://github.com/jwndlng/spec-control/releases/latest";
const TAG_PREFIX = "https://github.com/jwndlng/spec-control/releases/tag/";

export const START_DELAY_MS = 60 * 1000;
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10 * 1000;

/** The release tag a `/releases/latest` redirect names, or undefined for anything but this project's `v<x>.<y>.<z>`. */
export function parseLatestLocation(location: string | null | undefined): string | undefined {
  if (!location?.startsWith(TAG_PREFIX)) return undefined;
  const tag = location.slice(TAG_PREFIX.length);
  return isReleaseVersion(tag) ? tag : undefined;
}

/**
 * The request itself: `HEAD`, no redirect followed, ten seconds at most, only `User-Agent` set, the body never read.
 * Resolves to the tag, or undefined for any other answer; rejects only on a network error or the timeout.
 */
export async function requestLatestTag(version: string, url = LATEST_RELEASE_URL): Promise<string | undefined> {
  const res = await fetch(url, {
    method: "HEAD",
    redirect: "manual",
    headers: { "user-agent": `spec-control/${version}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (res.status < 300 || res.status >= 400) return undefined;
  return parseLatestLocation(res.headers.get("location"));
}

interface Remembered {
  checkedAt: string;
  outcome: "ok" | "failed";
  latest?: string;
}

function remembered(value: unknown): Remembered | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { checkedAt, outcome, latest } = value as Record<string, unknown>;
  if (typeof checkedAt !== "string" || Number.isNaN(Date.parse(checkedAt))) return undefined;
  if (outcome !== "ok" && outcome !== "failed") return undefined;
  if (latest !== undefined && (typeof latest !== "string" || !isReleaseVersion(latest))) return undefined;
  return latest === undefined ? { checkedAt, outcome } : { checkedAt, outcome, latest };
}

export interface UpdateCheckerDeps {
  getConfig: () => Config;
  /** The running version, as `--version` prints it. */
  version: string;
  /** Test seams. */
  request?: () => Promise<string | undefined>;
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
  now?: () => number;
}

export class UpdateChecker {
  private record: Remembered | undefined;
  private planned: { due: number; timer: unknown } | undefined;
  private running: Promise<UpdateStatus> | undefined;
  private stopped = false;
  private readonly startedAt: number;

  constructor(private readonly deps: UpdateCheckerDeps) {
    this.startedAt = this.now();
  }

  /** Reads the remembered last check; a missing, unreadable or malformed file means "never checked". */
  async load(): Promise<void> {
    try {
      this.record = remembered(JSON.parse(await readFile(updateCheckPath(), "utf8")));
    } catch {
      this.record = undefined;
    }
  }

  /** Whether checks are allowed: a release build whose configuration did not turn them off. */
  enabled(): boolean {
    return isReleaseVersion(this.deps.version) && this.deps.getConfig().updateCheck !== false;
  }

  status(): UpdateStatus {
    const enabled = this.enabled();
    const latest = this.record?.latest;
    return {
      enabled,
      current: this.deps.version,
      ...(latest === undefined ? {} : { latest }),
      ...(this.record ? { checkedAt: this.record.checkedAt } : {}),
      outcome: this.record?.outcome ?? "never",
      available: enabled && latest !== undefined && isNewer(latest, this.deps.version),
    };
  }

  /**
   * Arms the one timer for the next check, or clears it when checks are not allowed. Due a minute after start, or 24
   * hours after the remembered check if that is later; a remembered time in the future counts as none, so a clock set
   * back cannot postpone checks indefinitely. A timer already armed for the same moment is kept.
   */
  plan(): void {
    if (this.stopped || !this.enabled()) {
      this.clear();
      return;
    }
    if (this.running) return; // re-planned once it finishes
    const now = this.now();
    const earliest = this.startedAt + START_DELAY_MS;
    const last = this.record ? Date.parse(this.record.checkedAt) : Number.NaN;
    const due = Number.isFinite(last) && last <= now ? Math.max(earliest, last + CHECK_INTERVAL_MS) : earliest;
    if (this.planned?.due === due) return;
    this.clear();
    const timer = (this.deps.setTimer ?? defaultSetTimer)(() => {
      this.planned = undefined;
      if (this.enabled()) void this.check();
    }, Math.max(0, due - now));
    this.planned = { due, timer };
  }

  /** Runs a check now, or joins the one already running. Callers check `enabled()` first. */
  check(): Promise<UpdateStatus> {
    this.running ??= this.run().finally(() => {
      this.running = undefined;
      this.plan();
    });
    return this.running;
  }

  stop(): void {
    this.stopped = true;
    this.clear();
  }

  private async run(): Promise<UpdateStatus> {
    this.clear();
    let latest: string | undefined;
    try {
      latest = await (this.deps.request ?? (() => requestLatestTag(this.deps.version)))();
    } catch {
      latest = undefined;
    }
    const checkedAt = new Date(this.now()).toISOString();
    // A failure keeps the last tag learned: a flaky network must not hide an update already known.
    const known = latest ?? this.record?.latest;
    this.record = { checkedAt, outcome: latest ? "ok" : "failed", ...(known === undefined ? {} : { latest: known }) };
    await persist(this.record).catch(() => undefined);
    return this.status();
  }

  private clear(): void {
    if (!this.planned) return;
    (this.deps.clearTimer ?? defaultClearTimer)(this.planned.timer);
    this.planned = undefined;
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }
}

async function persist(record: Remembered): Promise<void> {
  const path = updateCheckPath();
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(record), "utf8");
  await rename(tmp, path);
}

function defaultSetTimer(run: () => void, ms: number): unknown {
  const timer = setTimeout(run, ms);
  // A planned check must never keep the process alive on its own.
  (timer as { unref?: () => void }).unref?.();
  return timer;
}

function defaultClearTimer(timer: unknown): void {
  clearTimeout(timer as ReturnType<typeof setTimeout>);
}
