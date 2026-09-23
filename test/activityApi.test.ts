import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { diffSnapshots, sessionEvent, type SessionActivity } from "../src/server/activity/events.ts";
import { ActivityLog } from "../src/server/activity/log.ts";
import { type AppState, createFetchHandler } from "../src/server/api.ts";
import { defaultConfig, newRepoConfig } from "../src/server/config.ts";
import { activityLogPath } from "../src/server/paths.ts";
import { Scanner } from "../src/server/scanner.ts";
import type { ActivityEvent, ActivityPage, ChangeSession, Snapshot } from "../src/shared/types.ts";
import { useTempHome } from "./helpers.ts";
import { git, harness, tempGitRepo, waitFor } from "./sessionHelpers.ts";

let cleanup: () => Promise<void>;
let server: ReturnType<typeof Bun.serve>;
let base: string;
let state: AppState;
let activity: ActivityLog;

beforeAll(async () => {
  ({ cleanup } = await useTempHome());
  activity = new ActivityLog();
  await activity.load();
  state = { config: defaultConfig(), scanner: undefined as unknown as Scanner, activity };
  state.scanner = new Scanner(() => state.config, {
    persist: false,
    onSnapshots: (previous, next) => void activity.append(diffSnapshots(previous, next, { now: new Date(), pollIntervalSeconds: state.config.pollIntervalSeconds })),
  });
  server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: createFetchHandler({ state, indexHtml: "<title>stub</title>" }) });
  base = `http://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  state.scanner.stop();
  server.stop(true);
  await cleanup();
});

const page = async (query = "") => (await (await fetch(`${base}/api/activity${query}`)).json()) as ActivityPage;
const kinds = (p: ActivityPage) => p.events.map((e) => e.kind);

test("nothing recorded: an empty feed; without a log at all the endpoint still answers", async () => {
  expect(await page()).toEqual({ events: [] });
  const bare = createFetchHandler({ state: { config: state.config, scanner: state.scanner }, indexHtml: "" });
  expect(await (await bare(new Request(`${base}/api/activity`))).json()).toEqual({ events: [] });
});

test("scans feed the log: baseline on first sight, then real changes; the log lives in the dashboard home and holds no paths", async () => {
  const repoPath = await tempGitRepo();
  state.config = { ...state.config, repos: [newRepoConfig(repoPath, true)] };
  await state.scanner.trigger().done;
  await activity.append([]);
  expect(kinds(await page())).toEqual(["repo-tracked"]);

  // tick one task and start a new change in the repository, then scan again
  const tasksFile = join(repoPath, "openspec", "changes", "cloud-deployment", "tasks.md");
  await writeFile(tasksFile, (await readFile(tasksFile, "utf8")).replace("- [ ]", "- [x]"));
  await mkdir(join(repoPath, "openspec", "changes", "add-login"), { recursive: true });
  await writeFile(join(repoPath, "openspec", "changes", "add-login", "proposal.md"), "## Why\n\nDemo.\n");
  await state.scanner.trigger().done;
  await activity.append([]);
  const feed = await page();
  expect(new Set(kinds(feed))).toEqual(new Set(["repo-tracked", "tasks-progress", "change-created"]));
  const progress = feed.events.find((e) => e.kind === "tasks-progress") as Extract<ActivityEvent, { kind: "tasks-progress" }>;
  expect(progress).toMatchObject({ change: "cloud-deployment", repoName: "demo-ops" });
  expect(progress.to.done).toBe(progress.from.done + 1);

  // nothing changed: nothing recorded
  await state.scanner.trigger().done;
  await activity.append([]);
  expect((await page()).events).toHaveLength(3);

  const raw = await readFile(activityLogPath(), "utf8");
  expect(raw.trim().split("\n")).toHaveLength(3);
  expect(raw).not.toContain(repoPath);
  // the repository holds only what this test itself edited: recording activity wrote nothing there
  const dirty = git(repoPath, "status", "--porcelain").split("\n").filter(Boolean);
  expect(dirty.filter((l) => !l.includes("add-login") && !l.includes("tasks.md"))).toEqual([]);
  expect(dirty.length).toBe(2);
});

test("paging, filters and validation", async () => {
  const first = await page("?limit=2");
  expect(first.events).toHaveLength(2);
  const second = await page(`?limit=2&before=${first.nextBefore}`);
  expect(second.events).toHaveLength(1);
  expect(second.nextBefore).toBeUndefined();
  expect(new Set([...first.events, ...second.events].map((e) => e.id)).size).toBe(3);

  const repoId = state.config.repos[0].id;
  const onlyTasks = await page(`?kinds=tasks-progress&repos=${repoId}`);
  expect(kinds(onlyTasks)).toEqual(["tasks-progress"]);
  expect(onlyTasks.newestId).toBe((await page()).newestId);
  expect((await page("?repos=unknown")).events).toEqual([]);
  expect((await page(`?limit=1&since=${second.events[0].id}`)).newerThanSince).toBe(2);

  for (const bad of ["?limit=0", "?limit=501", "?limit=abc", "?limit=1.5", "?kinds=made-up"]) {
    const res = await fetch(`${base}/api/activity${bad}`);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBeTruthy();
  }
  expect((await fetch(`${base}/api/activity`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status).toBe(404);
});

test("the session manager reports started, shipped and ended — and nothing decides anything from it", async () => {
  const reported: { session: ChangeSession; what: SessionActivity }[] = [];
  const h = await harness();
  const manager = h.newManager({ onActivity: (session, what) => reported.push({ session, what }), submitTimings: { echoTimeoutMs: 600, settleMs: 20 } });
  try {
    const s = await manager.open({ repoId: h.repoId, change: "upgrade-runtime", action: "implement" });
    await writeFile(join(s.worktreePath, "work.txt"), "x");
    await manager.ship(s.id);
    manager.write(s.id, "crash\r");
    await waitFor(() => manager.get(s.id).state === "exited", "exit");
    await waitFor(() => reported.length === 3, "three reports");
    expect(reported.map((r) => r.what)).toEqual([{ kind: "session-started", action: "implement", agentName: "Fake Agent" }, { kind: "session-shipped", submitted: true }, { kind: "session-ended", exitCode: 3 }]);
    const event = sessionEvent(reported[2].session, "demo-ops", reported[2].what, new Date("2026-09-21T09:00:00.000Z"));
    expect(event).toMatchObject({ v: 1, kind: "session-ended", change: "upgrade-runtime", repoId: h.repoId, repoName: "demo-ops", exitCode: 3, at: "2026-09-21T09:00:00.000Z" });

    // a reporter that throws must not get in a session's way
    const fragile = h.newManager({
      onActivity: () => {
        throw new Error("feed is broken");
      },
    });
    const other = await fragile.open({ repoId: h.repoId, change: "cache-api-calls", action: "implement" });
    expect(other.state).toBe("running");
    await fragile.shutdown();
  } finally {
    await manager.shutdown();
  }
});

test("a broken activity callback never fails a scan", async () => {
  const scanner = new Scanner(() => state.config, {
    persist: false,
    onSnapshots: () => {
      throw new Error("feed is broken");
    },
  });
  const snapshot: Snapshot = await scanner.trigger().done;
  expect(snapshot.repos).toHaveLength(1);
});
