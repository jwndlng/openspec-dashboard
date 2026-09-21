// The activity log (design: add-activity-feed D5). Append-only JSON Lines in the dashboard home, bounded by
// compaction, tolerant when read. History only: nothing but the feed reads it, and a failure here never fails a scan.
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pageEvents, type ActivityQuery } from "../../shared/activity.ts";
import { ACTIVITY_KINDS, type ActivityEvent, type ActivityKind, type ActivityPage } from "../../shared/types.ts";
import { activityLogPath } from "../paths.ts";

/** Entries kept in memory and after a compaction. */
export const KEEP_ENTRIES = 2000;
/** The file is compacted once it has grown beyond this many lines. */
export const COMPACT_ABOVE_LINES = 5000;
export { MAX_PAGE, type ActivityQuery as PageQuery } from "../../shared/activity.ts";

function parseLine(line: string): ActivityEvent | undefined {
  if (!line.trim()) return undefined;
  try {
    const value = JSON.parse(line) as Partial<ActivityEvent>;
    if (value?.v !== 1 || typeof value.id !== "string" || typeof value.at !== "string" || typeof value.repoId !== "string") return undefined;
    if (!ACTIVITY_KINDS.includes(value.kind as ActivityKind)) return undefined;
    return value as ActivityEvent;
  } catch {
    return undefined; // a torn or foreign line is skipped, never fatal
  }
}

export class ActivityLog {
  /** In detection order, oldest first; at most KEEP_ENTRIES. */
  private entries: ActivityEvent[] = [];
  private lines = 0;
  /** The file ends in a torn line (a write was cut off): the next append must start on a line of its own. */
  private unterminated = false;
  private queue: Promise<void> = Promise.resolve();
  private warned = false;

  constructor(private readonly path = activityLogPath()) {}

  /** Reads what is there and compacts a file that has outgrown what is kept. Never throws. */
  async load(): Promise<void> {
    let raw = "";
    try {
      raw = await readFile(this.path, "utf8");
    } catch {
      // no log yet
    }
    this.unterminated = raw.length > 0 && !raw.endsWith("\n");
    const lines = raw.split("\n");
    this.lines = lines.filter((l) => l.trim()).length;
    this.entries = lines
      .map(parseLine)
      .filter((e): e is ActivityEvent => e !== undefined)
      .slice(-KEEP_ENTRIES);
    if (this.lines > KEEP_ENTRIES) await this.enqueue(() => this.compact());
  }

  /** Records events. Resolves when they are on disk (or the attempt failed — which is only reported). */
  append(events: readonly ActivityEvent[]): Promise<void> {
    if (events.length === 0) return this.queue;
    this.entries = [...this.entries, ...events].slice(-KEEP_ENTRIES);
    const text = events.map((e) => `${JSON.stringify(e)}\n`).join("");
    return this.enqueue(async () => {
      await mkdir(dirname(this.path), { recursive: true });
      await appendFile(this.path, this.unterminated ? `\n${text}` : text, "utf8");
      this.unterminated = false;
      this.lines += events.length;
      if (this.lines > COMPACT_ABOVE_LINES) await this.compact();
    });
  }

  private async compact(): Promise<void> {
    const tmp = `${this.path}.${process.pid}.tmp`;
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(tmp, this.entries.map((e) => `${JSON.stringify(e)}\n`).join(""), "utf8");
    await rename(tmp, this.path);
    this.lines = this.entries.length;
    this.unterminated = false;
  }

  /** One writer at a time; a failed write is reported once and never propagates. */
  private enqueue(job: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(job).catch((err) => {
      if (!this.warned) console.warn("could not write the activity log:", err instanceof Error ? err.message : err);
      this.warned = true;
    });
    return this.queue;
  }

  page(query: ActivityQuery = {}): ActivityPage {
    return pageEvents(this.entries, query);
  }
}
