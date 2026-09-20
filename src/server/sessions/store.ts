// Session records live under ~/.openspec-dashboard/sessions/<id>/ (design.md D9): `meta.json` written atomically,
// `events.ndjson` append-only. Files are user-only because transcripts can contain whatever the agent read.
import { appendFile, chmod, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { OPEN_SESSION_STATES, type Session, type SessionEvent } from "../../shared/types.ts";
import { sessionsDir } from "../paths.ts";

export const KEEP_ENDED_SESSIONS = 50;
export const TRANSCRIPT_LIMIT_BYTES = 20 * 1024 * 1024;
const EVENT_TEXT_LIMIT = 100_000;
const ELIDED = "[elided: transcript size limit]";
const SESSION_ID = /^[a-f0-9-]{36}$/;

export class SessionStore {
  private sizes = new Map<string, number>();
  private writes = new Map<string, Promise<unknown>>();
  private tmpCounter = 0;

  /**
   * All writes for one session run strictly one after another. Callers overlap freely (a turn's events, a message
   * arriving over the API, a state change), and unserialised temp-file renames would otherwise trip over each other;
   * it also keeps the transcript in the order the events were issued.
   */
  private serial<T>(id: string, task: () => Promise<T>): Promise<T> {
    const next = (this.writes.get(id) ?? Promise.resolve()).then(task, task);
    this.writes.set(id, next.catch(() => undefined));
    return next;
  }

  constructor(private readonly limitBytes = TRANSCRIPT_LIMIT_BYTES) {}

  private dir(id: string): string {
    if (!SESSION_ID.test(id)) throw new Error(`invalid session id: ${id}`);
    return join(sessionsDir(), id);
  }

  saveMeta(session: Session): Promise<void> {
    const body = JSON.stringify(session, null, 2); // snapshot now; the object keeps changing
    return this.serial(session.id, async () => {
      const dir = this.dir(session.id);
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const path = join(dir, "meta.json");
      const tmp = `${path}.${process.pid}.${++this.tmpCounter}.tmp`;
      await writeFile(tmp, body, { mode: 0o600 });
      await rename(tmp, path);
    });
  }

  append(id: string, event: SessionEvent): Promise<void> {
    return this.serial(id, () => this.appendNow(id, event));
  }

  private async appendNow(id: string, event: SessionEvent): Promise<void> {
    const stored = event.text && event.text.length > EVENT_TEXT_LIMIT ? { ...event, text: `${event.text.slice(0, EVENT_TEXT_LIMIT)}\n… (truncated)` } : event;
    const line = `${JSON.stringify(stored)}\n`;
    const path = join(this.dir(id), "events.ndjson");
    await appendFile(path, line, { mode: 0o600 });
    const size = (this.sizes.get(id) ?? (await stat(path)).size - line.length) + line.length;
    this.sizes.set(id, size);
    if (size > this.limitBytes) await this.compact(id);
  }

  /** Elides the oldest tool-result bodies until the transcript is comfortably under the limit. */
  private async compact(id: string): Promise<void> {
    const path = join(this.dir(id), "events.ndjson");
    const events = await this.readEvents(id, 0);
    let size = (await stat(path)).size;
    for (const event of events) {
      if (size <= this.limitBytes * 0.75) break;
      if (event.kind === "tool_result" && event.text && event.text !== ELIDED) {
        size -= event.text.length - ELIDED.length;
        event.text = ELIDED;
      }
    }
    const tmp = `${path}.${process.pid}.${++this.tmpCounter}.tmp`;
    await writeFile(tmp, `${events.map((e) => JSON.stringify(e)).join("\n")}\n`, { mode: 0o600 });
    await rename(tmp, path);
    await chmod(path, 0o600);
    this.sizes.set(id, (await stat(path)).size);
  }

  async readEvents(id: string, afterSeq: number): Promise<SessionEvent[]> {
    let raw: string;
    try {
      raw = await readFile(join(this.dir(id), "events.ndjson"), "utf8");
    } catch {
      return [];
    }
    const events: SessionEvent[] = [];
    for (const line of raw.split("\n")) {
      if (!line) continue;
      try {
        const event = JSON.parse(line) as SessionEvent;
        if (event.seq > afterSeq) events.push(event);
      } catch {
        // a torn last line after a crash; skip it
      }
    }
    return events.sort((a, b) => a.seq - b.seq);
  }

  async loadAll(): Promise<Session[]> {
    let ids: string[];
    try {
      ids = await readdir(sessionsDir());
    } catch {
      return [];
    }
    const sessions: Session[] = [];
    for (const id of ids) {
      if (!SESSION_ID.test(id)) continue;
      try {
        sessions.push(JSON.parse(await readFile(join(sessionsDir(), id, "meta.json"), "utf8")) as Session);
      } catch {
        // unreadable record: leave it on disk, do not list it
      }
    }
    return sessions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async delete(id: string): Promise<void> {
    await this.serial(id, async () => {
      this.sizes.delete(id);
      await rm(this.dir(id), { recursive: true, force: true });
    });
    this.writes.delete(id);
  }

  /** Keeps every open session and the newest `keep` ended ones; returns the ids it removed. */
  async prune(sessions: Session[], keep = KEEP_ENDED_SESSIONS): Promise<string[]> {
    const ended = sessions.filter((s) => !OPEN_SESSION_STATES.includes(s.state)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const removed: string[] = [];
    for (const session of ended.slice(keep)) {
      await this.delete(session.id);
      removed.push(session.id);
    }
    return removed;
  }
}
