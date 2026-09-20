import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SessionError, type SessionManager } from "../src/server/sessions/manager.ts";
import { SessionStore } from "../src/server/sessions/store.ts";
import { checkWorktreeRemovable, removeWorktree } from "../src/server/sessions/worktree.ts";
import type { Session } from "../src/shared/types.ts";
import { tempDir, useTempHome } from "./helpers.ts";
import { harness, recorded, waitFor } from "./sessionHelpers.ts";

let cleanup: () => Promise<void>;
let home: string;
const managers: SessionManager[] = [];
const track = <T extends { manager: SessionManager }>(h: T): T => {
  managers.push(h.manager);
  return h;
};

beforeAll(async () => {
  ({ cleanup, home } = await useTempHome());
});
afterEach(async () => {
  delete process.env.FAKE_CLAUDE_MODE;
  delete process.env.FAKE_CLAUDE_RECORD;
  delete process.env.ANTHROPIC_API_KEY;
  for (const m of managers.splice(0)) await m.shutdown();
});
afterAll(() => cleanup());

const state = (m: SessionManager, id: string) => m.get(id).state;

test("lifecycle: open, first turn, follow-up in the same conversation, close", async () => {
  const h = track(await harness());
  process.env.FAKE_CLAUDE_RECORD = join(home, "rec-lifecycle.ndjson");
  process.env.ANTHROPIC_API_KEY = "must-not-leak";
  const s = await h.manager.open({ repoId: h.repoId, change: "upgrade-runtime", action: "implement" });
  await waitFor(() => state(h.manager, s.id) === "waiting", "first turn");
  let events = await h.manager.events(s.id, 0);
  expect(events.find((e) => e.kind === "user")?.text).toBe("/opsx:apply upgrade-runtime");
  expect(events.find((e) => e.kind === "assistant")?.text).toBe("echo: /opsx:apply upgrade-runtime");
  expect(h.manager.get(s.id)).toMatchObject({ turns: 1, costUsd: 0.01, apiKeySource: "none", worktreePath: join(h.repoPath, ".claude", "worktrees", "upgrade-runtime") });
  expect(h.manager.get(s.id).rateLimit?.status).toBe("allowed");

  await h.manager.send(s.id, '"; rm -rf ~ #');
  await waitFor(() => h.manager.get(s.id).turns === 2 && state(h.manager, s.id) === "waiting", "second turn");
  events = await h.manager.events(s.id, 0);
  expect(events.filter((e) => e.kind === "assistant").at(-1)?.text).toBe('echo: "; rm -rf ~ #');
  expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i + 1));

  const runs = await recorded(process.env.FAKE_CLAUDE_RECORD);
  expect(runs.length).toBe(1); // one process served both turns
  expect(runs[0].cwd).toBe(h.repoPath);
  expect(runs[0].hasApiKey).toBe(false);
  expect(runs[0].argv.join(" ")).toContain(`--session-id ${s.cliSessionId} --worktree upgrade-runtime`);
  expect(runs[0].argv.join(" ")).not.toMatch(/dangerously|bypassPermissions/);

  const closed = await h.manager.close(s.id);
  expect(closed.session.state).toBe("closed");
  await expect(h.manager.send(s.id, "more")).rejects.toMatchObject({ status: 409 });
});

test("refusals: disabled, not opted in, unknown or invalid change, unavailable action, archived", async () => {
  const open = (h: { manager: SessionManager; repoId: string }, change: unknown, action: unknown = "implement") => h.manager.open({ repoId: h.repoId, change, action });
  await expect(open(track(await harness({ enabled: false })), "upgrade-runtime")).rejects.toMatchObject({ status: 403 });
  await expect(open(track(await harness({ optIn: false })), "upgrade-runtime")).rejects.toMatchObject({ status: 403 });
  const h = track(await harness());
  await expect(open(h, "no-such-change")).rejects.toMatchObject({ status: 404 });
  await expect(open(h, "x; rm -rf ~")).rejects.toMatchObject({ status: 400 });
  await expect(open(h, "add-health-endpoint")).rejects.toMatchObject({ status: 400 }); // proposal only: not implementable
  await expect(open(h, "upgrade-runtime", "deploy")).rejects.toMatchObject({ status: 400 });
  await expect(open(h, "runbook-repo-field")).rejects.toMatchObject({ status: 404 }); // archived
  await expect(h.manager.open({ repoId: "000000000000", change: "upgrade-runtime", action: "implement" })).rejects.toBeInstanceOf(SessionError);
  expect(h.manager.list()).toEqual([]);
});

test("a repository without agent settings is included once sessions are enabled", async () => {
  const h = track(await harness({ optIn: "absent" }));
  const s = await h.manager.open({ repoId: h.repoId, change: "upgrade-runtime", action: "implement" });
  await waitFor(() => state(h.manager, s.id) === "waiting", "turn in a default-included repository");
});

test("archive starter: only for Done changes, own worktree and branch, own template", async () => {
  const h = track(await harness());
  process.env.FAKE_CLAUDE_RECORD = join(home, "rec-archive.ndjson");
  await expect(h.manager.open({ repoId: h.repoId, change: "upgrade-runtime", action: "archive" })).rejects.toMatchObject({ status: 400 }); // Ready, not Done
  await expect(h.manager.open({ repoId: h.repoId, change: "configurable-builder", action: "implement" })).rejects.toMatchObject({ status: 400 }); // Done: nothing left to implement
  const s = await h.manager.open({ repoId: h.repoId, change: "configurable-builder", action: "archive" });
  await waitFor(() => state(h.manager, s.id) === "waiting", "archive turn");
  expect((await h.manager.events(s.id, 0)).find((e) => e.kind === "user")?.text).toBe("/opsx:archive configurable-builder");
  const [run] = await recorded(process.env.FAKE_CLAUDE_RECORD);
  expect(run.argv.join(" ")).toContain("--worktree archive-configurable-builder");
  expect(run.argv.join(" ")).toContain("git branch -m chore/archive-configurable-builder");
  expect(run.argv.find((a) => a.startsWith("--allowedTools="))).toContain("Bash(mv openspec/*)");
  expect(h.manager.get(s.id).worktreePath).toBe(join(h.repoPath, ".claude", "worktrees", "archive-configurable-builder"));
});

test("one open session per change; draft starter uses its own template", async () => {
  const h = track(await harness());
  const a = await h.manager.open({ repoId: h.repoId, change: "add-health-endpoint", action: "draft" });
  const b = await h.manager.open({ repoId: h.repoId, change: "add-health-endpoint", action: "draft" });
  expect(b.id).toBe(a.id);
  await waitFor(() => state(h.manager, a.id) === "waiting", "draft turn");
  expect((await h.manager.events(a.id, 0)).find((e) => e.kind === "user")?.text).toBe("/opsx:ff add-health-endpoint");
});

test("running limit queues further sessions; Stop frees the slot and keeps the conversation", async () => {
  const h = track(await harness({ maxRunning: 1 }));
  process.env.FAKE_CLAUDE_MODE = "hang";
  process.env.FAKE_CLAUDE_RECORD = join(home, "rec-limit.ndjson");
  const first = await h.manager.open({ repoId: h.repoId, change: "upgrade-runtime", action: "implement" });
  await waitFor(() => state(h.manager, first.id) === "running", "first running");
  const second = await h.manager.open({ repoId: h.repoId, change: "cache-api-calls", action: "implement" });
  expect(state(h.manager, second.id)).toBe("queued");

  await h.manager.stop(first.id);
  await waitFor(() => state(h.manager, first.id) === "waiting", "first stopped");
  await waitFor(() => state(h.manager, second.id) === "running", "second picked up");
  expect((await h.manager.events(first.id, 0)).find((e) => e.kind === "result")?.text).toBe("turn stopped");
  expect(h.manager.get(first.id).failure).toBeUndefined();
  // Exactly two processes ever start (one per session): the in-band interrupt did not restart the first one.
  await waitFor(async () => (await recorded(process.env.FAKE_CLAUDE_RECORD as string)).length === 2, "second process start-up");
  await new Promise((r) => setTimeout(r, 150));
  expect((await recorded(process.env.FAKE_CLAUDE_RECORD)).length).toBe(2);
  await h.manager.cancel(second.id);
  expect(state(h.manager, second.id)).toBe("cancelled");
});

test("denied tool calls are recorded and the session stays usable", async () => {
  const h = track(await harness());
  process.env.FAKE_CLAUDE_MODE = "deny";
  const s = await h.manager.open({ repoId: h.repoId, change: "upgrade-runtime", action: "implement" });
  await waitFor(() => state(h.manager, s.id) === "waiting", "deny turn");
  const events = await h.manager.events(s.id, 0);
  expect(events.find((e) => e.kind === "denied")?.tool).toMatchObject({ name: "Bash", input: { command: "curl https://example.com" } });
  expect(events.find((e) => e.kind === "tool_result")).toMatchObject({ isError: true });
});

test("failure classification: not logged in, usage limit, crash", async () => {
  for (const [mode, failure] of [["auth", "auth"], ["limit", "usage-limit"], ["crash", "crashed"]] as const) {
    const h = track(await harness());
    process.env.FAKE_CLAUDE_MODE = mode;
    const s = await h.manager.open({ repoId: h.repoId, change: "upgrade-runtime", action: "implement" });
    await waitFor(() => state(h.manager, s.id) === "failed", `${mode} failure`);
    expect(h.manager.get(s.id).failure).toBe(failure);
    expect(h.manager.get(s.id).error).toBeTruthy();
    await expect(h.manager.send(s.id, "again")).rejects.toMatchObject({ status: 409 });
  }
});

test("missing CLI is refused up front", async () => {
  const h = track(await harness());
  h.config.agentSessions.claudePath = "/nonexistent/claude";
  await expect(h.manager.open({ repoId: h.repoId, change: "upgrade-runtime", action: "implement" })).rejects.toMatchObject({ status: 503 });
  expect((await h.manager.agentAvailability(true)).available).toBe(false);
});

test("idle process is stopped and the next message resumes the same conversation in the worktree", async () => {
  const h = track(await harness({ timing: { idleMs: 60 } }));
  process.env.FAKE_CLAUDE_RECORD = join(home, "rec-idle.ndjson");
  const s = await h.manager.open({ repoId: h.repoId, change: "upgrade-runtime", action: "implement" });
  await waitFor(() => state(h.manager, s.id) === "waiting", "first turn");
  await waitFor(async () => (await recorded(process.env.FAKE_CLAUDE_RECORD as string)).length === 1, "first process recorded");
  await new Promise((r) => setTimeout(r, 300)); // idle limit passes, process ends
  expect(state(h.manager, s.id)).toBe("waiting");
  await h.manager.send(s.id, "still there?");
  await waitFor(() => h.manager.get(s.id).turns === 2 && state(h.manager, s.id) === "waiting", "resumed turn");
  const runs = await recorded(process.env.FAKE_CLAUDE_RECORD);
  expect(runs.length).toBe(2);
  expect(runs[1].argv.join(" ")).toContain(`--resume ${s.cliSessionId}`);
  expect(runs[1].argv).not.toContain("--worktree");
  expect(runs[1].cwd).toBe(join(h.repoPath, ".claude", "worktrees", "upgrade-runtime"));
  expect(h.manager.get(s.id).costUsd).toBeCloseTo(0.02);
});

test("shutdown interrupts work in flight; a new dashboard process can continue it", async () => {
  const h = track(await harness());
  process.env.FAKE_CLAUDE_MODE = "hang";
  const s = await h.manager.open({ repoId: h.repoId, change: "upgrade-runtime", action: "implement" });
  await waitFor(() => state(h.manager, s.id) === "running", "running");
  await h.manager.shutdown();
  expect(state(h.manager, s.id)).toBe("interrupted");

  delete process.env.FAKE_CLAUDE_MODE;
  const next = h.newManager();
  managers.push(next);
  await next.init();
  expect(next.get(s.id).state).toBe("interrupted");
  await next.send(s.id, "continue please");
  await waitFor(() => next.get(s.id).state === "waiting", "continued after restart");
  expect((await next.events(s.id, 0)).filter((e) => e.kind === "assistant").at(-1)?.text).toBe("echo: continue please");
});

test("start-up reconciliation and retention", async () => {
  const store = new SessionStore();
  const mk = (n: number, st: Session["state"]): Session => ({ id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, repoId: "r", change: `c${n}`, action: "implement", cliSessionId: "x", state: st, createdAt: `2026-01-0${n}T00:00:00Z`, updatedAt: `2026-01-0${n}T00:00:00Z`, turns: 0, costUsd: 0, lastSeq: 0 });
  const sessions = [mk(1, "closed"), mk(2, "failed"), mk(3, "cancelled"), mk(4, "waiting")];
  for (const s of sessions) await store.saveMeta(s);
  expect(await store.prune(sessions, 1)).toEqual([sessions[1].id, sessions[0].id]); // newest ended one kept, open one kept
  expect((await store.loadAll()).map((s) => s.change).sort()).toContain("c4");

  const stale = mk(5, "running");
  await store.saveMeta(stale);
  const h = track(await harness());
  await h.manager.init();
  expect(h.manager.get(stale.id).state).toBe("interrupted");
});

test("worktree removal: refused when dirty or unpushed, done (with unlock) when clean", async () => {
  const sh = (cwd: string, ...args: string[]) => Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  const repo = join(await tempDir("osd-git-"), "repo");
  await mkdir(repo, { recursive: true });
  sh(repo, "init", "-q", "-b", "main");
  sh(repo, "config", "user.email", "t@example.invalid");
  sh(repo, "config", "user.name", "t");
  await writeFile(join(repo, "README.md"), "# t\n");
  sh(repo, "add", "-A");
  sh(repo, "commit", "-q", "-m", "init");
  const wt = join(repo, ".claude", "worktrees", "x");
  sh(repo, "worktree", "add", "-q", wt, "-b", "worktree-x");
  sh(repo, "worktree", "lock", wt);

  await writeFile(join(wt, "scratch.txt"), "wip\n");
  expect(await checkWorktreeRemovable(wt)).toMatchObject({ removable: false, reason: expect.stringContaining("uncommitted") });
  sh(wt, "add", "-A");
  sh(wt, "commit", "-q", "-m", "work");
  expect(await checkWorktreeRemovable(wt)).toMatchObject({ removable: false, reason: expect.stringContaining("only on this worktree") });
  expect((await removeWorktree(repo, wt)).removable).toBe(false);
  expect(sh(repo, "worktree", "list").stdout.toString()).toContain("worktrees/x");

  sh(repo, "merge", "-q", "worktree-x"); // the work now also lives on main
  expect(await checkWorktreeRemovable(wt)).toEqual({ removable: true });
  expect(await removeWorktree(repo, wt)).toEqual({ removable: true });
  expect(sh(repo, "worktree", "list").stdout.toString()).not.toContain("worktrees/x");
  expect(await checkWorktreeRemovable(wt)).toMatchObject({ removable: false });
});
