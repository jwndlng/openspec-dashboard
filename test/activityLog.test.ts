import { afterAll, beforeAll, expect, test } from "bun:test";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { newEventId } from "../src/server/activity/events.ts";
import { ActivityLog, COMPACT_ABOVE_LINES, KEEP_ENTRIES } from "../src/server/activity/log.ts";
import { collapseTaskProgress } from "../src/shared/activity.ts";
import type { ActivityEvent } from "../src/shared/types.ts";
import { tempDir } from "./helpers.ts";

let dir: string;
beforeAll(async () => {
  dir = await tempDir("osd-activity-");
});
afterAll(async () => {
  const { rm } = await import("node:fs/promises");
  await rm(dir, { recursive: true, force: true });
});

const T0 = Date.parse("2026-09-21T09:00:00.000Z");
const MIN = 60_000;
let tick = 0;
const base = (atMs: number, repoId = "r1") => ({ v: 1 as const, id: newEventId(T0 + tick++), at: new Date(atMs).toISOString(), detectedAt: new Date(atMs).toISOString(), repoId, repoName: repoId === "r1" ? "demo-ops" : "beta-soc" });
const moved = (atMs: number, change: string, from: string, to: string, repoId?: string): ActivityEvent => ({ ...base(atMs, repoId), kind: "change-moved", change, from, to });
const progress = (atMs: number, change: string, from: number, to: number, total = 12): ActivityEvent => ({ ...base(atMs), kind: "tasks-progress", change, column: "Implementing", from: { done: from, total }, to: { done: to, total } });
const started = (atMs: number, change: string): ActivityEvent => ({ ...base(atMs), kind: "session-started", change, action: "implement", agentName: "Fake Agent" });
const file = (name: string) => join(dir, name, "activity.jsonl");

test("events survive a restart, newest first", async () => {
  const path = file("restart");
  const log = new ActivityLog(path);
  await log.load();
  expect(log.page()).toEqual({ events: [] });
  await log.append([moved(T0, "a", "Specs", "Ready"), moved(T0 + MIN, "b", "Ready", "Implementing")]);
  const again = new ActivityLog(path);
  await again.load();
  const page = again.page();
  expect(page.events.map((e) => "change" in e && e.change)).toEqual(["b", "a"]);
  expect(page.newestId).toBe(page.events[0].id);
  expect(page.nextBefore).toBeUndefined();
});

test("a torn last line, foreign lines and unknown versions are skipped; writing goes on", async () => {
  const path = file("torn");
  await mkdir(join(dir, "torn"), { recursive: true });
  const good = moved(T0, "a", "Specs", "Ready");
  await writeFile(path, `${JSON.stringify(good)}\nnot json\n${JSON.stringify({ ...good, v: 2, id: "zzz" })}\n${JSON.stringify({ ...good, kind: "made-up" })}\n{"v":1,"id":"trunc`);
  const log = new ActivityLog(path);
  await log.load();
  expect(log.page().events.map((e) => e.id)).toEqual([good.id]);
  await log.append([moved(T0 + MIN, "b", "Ready", "Done")]);
  const again = new ActivityLog(path);
  await again.load();
  expect(again.page().events).toHaveLength(2);
});

test("the log is bounded: compacted to the newest entries beyond the limit, and on start", async () => {
  const path = file("bounded");
  const log = new ActivityLog(path);
  await log.load();
  const batch = (n: number, offset: number) => Array.from({ length: n }, (_, i) => moved(T0 + (offset + i) * 1000, `c${offset + i}`, "Specs", "Ready"));
  await log.append(batch(COMPACT_ABOVE_LINES, 0));
  expect((await readFile(path, "utf8")).trim().split("\n")).toHaveLength(COMPACT_ABOVE_LINES);
  await log.append(batch(1, COMPACT_ABOVE_LINES));
  const lines = (await readFile(path, "utf8")).trim().split("\n");
  expect(lines).toHaveLength(KEEP_ENTRIES);
  expect(JSON.parse(lines[lines.length - 1]).change).toBe(`c${COMPACT_ABOVE_LINES}`);
  expect(JSON.parse(lines[0]).change).toBe(`c${COMPACT_ABOVE_LINES + 1 - KEEP_ENTRIES}`);

  // a file that outgrew the limit while another version ran is compacted when loaded
  await appendFile(path, batch(KEEP_ENTRIES, 9000).map((e) => `${JSON.stringify(e)}\n`).join(""));
  const again = new ActivityLog(path);
  await again.load();
  await again.append([]);
  expect((await readFile(path, "utf8")).trim().split("\n")).toHaveLength(KEEP_ENTRIES);
});

test("paging has no duplicates and no gaps; filters apply; newestId ignores them", async () => {
  const log = new ActivityLog(file("paging"));
  await log.load();
  const events = Array.from({ length: 250 }, (_, i) => (i % 5 === 0 ? started(T0 + i * MIN, `s${i}`) : moved(T0 + i * MIN, `c${i}`, "Specs", "Ready", i % 2 ? "r1" : "r2")));
  await log.append(events);
  const first = log.page({ limit: 100 });
  const second = log.page({ limit: 100, before: first.nextBefore });
  const third = log.page({ limit: 100, before: second.nextBefore });
  expect([first.events.length, second.events.length, third.events.length]).toEqual([100, 100, 50]);
  expect(third.nextBefore).toBeUndefined();
  const ids = [...first.events, ...second.events, ...third.events].map((e) => e.id);
  expect(new Set(ids).size).toBe(250);
  expect(ids[0]).toBe(events[249].id);

  const sessions = log.page({ kinds: ["session-started"], repos: ["r1"] });
  expect(sessions.events).toHaveLength(50);
  expect(sessions.events.every((e) => e.kind === "session-started" && e.repoId === "r1")).toBe(true);
  expect(sessions.newestId).toBe(events[249].id);
  expect(log.page({ repos: ["nope"] })).toEqual({ events: [], newestId: events[249].id });
  expect(log.page({ limit: 1, since: events[244].id }).newerThanSince).toBe(5);
  expect(log.page({ limit: 1, since: "" }).newerThanSince).toBe(250);
});

test("events are shown by when they happened, not by when they were noticed", async () => {
  const log = new ActivityLog(file("order"));
  await log.load();
  const noticedLater = { ...moved(T0 - 60 * MIN, "weekend-work", "Done", "Archived"), catchUp: true };
  await log.append([moved(T0, "today", "Specs", "Ready")]);
  await log.append([noticedLater]);
  expect(log.page().events.map((e) => "change" in e && e.change)).toEqual(["today", "weekend-work"]);
  expect(log.page().newestId).toBe(noticedLater.id);
});

test("task progress collapses into runs; a move or a long gap ends a run; the log keeps every event", async () => {
  const chronological = [
    progress(T0, "a", 3, 4),
    progress(T0 + 10 * MIN, "a", 4, 6),
    progress(T0 + 15 * MIN, "b", 0, 1), // another change in between does not end a's run
    progress(T0 + 40 * MIN, "a", 6, 7),
    moved(T0 + 50 * MIN, "a", "Implementing", "Done"),
    progress(T0 + 55 * MIN, "a", 7, 8),
    progress(T0 + 200 * MIN, "a", 8, 9), // more than an hour later
  ];
  const newestFirst = [...chronological].reverse();
  const collapsed = collapseTaskProgress(newestFirst);
  expect(collapsed.map((e) => (e.kind === "tasks-progress" ? `${e.change} ${e.from.done}→${e.to.done}` : `${e.kind}`))).toEqual(["a 8→9", "a 7→8", "change-moved", "a 3→7", "b 0→1"]);
  expect(collapsed[3]).toMatchObject({ id: chronological[3].id, at: chronological[3].at });
  expect(newestFirst).toHaveLength(7); // input untouched

  const log = new ActivityLog(file("collapse"));
  await log.load();
  await log.append(chronological);
  expect(log.page().events).toHaveLength(5);
  expect((await readFile(file("collapse"), "utf8")).trim().split("\n")).toHaveLength(7);
});

test("a log that cannot be written never throws and keeps serving from memory", async () => {
  await writeFile(join(dir, "not-a-dir"), "x");
  const log = new ActivityLog(join(dir, "not-a-dir", "activity.jsonl"));
  await log.load();
  await log.append([moved(T0, "a", "Specs", "Ready")]);
  expect(log.page().events).toHaveLength(1);
});
