import { expect, test } from "bun:test";
import type { ChangeSession, ConsoleSession } from "../src/shared/types.ts";
import { CONSOLE_CONTROL_NAME, consoleControl, consoleToShow, NEEDS_YOU_AFTER_MS, openWork } from "../src/ui/sessionState.ts";

const NOW = Date.parse("2026-09-23T12:00:00Z");
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const console_ = (id: string, patch: Partial<ConsoleSession> = {}): ConsoleSession => ({ id, console: true, agentId: "a", agentName: "A", state: "running", worktreePath: "/w/console", createdAt: at(60_000), updatedAt: at(0), resumable: true, ...patch });
const change = (id: string, patch: Partial<ChangeSession> = {}): ChangeSession => ({ id, repoId: "r", change: "add-x", action: "implement", agentId: "a", agentName: "A", state: "running", worktreePath: `/w/${id}`, branch: "feat/add-x", createdAt: at(120_000), updatedAt: at(0), resumable: true, ...patch });

test("the control names the console, and the running console's state in words", () => {
  const idle = consoleControl([], NOW);
  expect(idle.name).toBe(CONSOLE_CONTROL_NAME);
  expect(idle.badge).toBeUndefined();
  expect(consoleControl([console_("old", { state: "exited", exitCode: 0 })], NOW).badge).toBeUndefined();

  const working = consoleControl([console_("c", { lastOutputAt: at(1_000) })], NOW);
  expect(working.name).toBe(`${CONSOLE_CONTROL_NAME} — working`);
  expect(working.badge).toMatchObject({ tone: "info", live: true });

  const quiet = consoleControl([console_("c", { lastOutputAt: at(NEEDS_YOU_AFTER_MS + 180_000) })], NOW);
  expect(quiet.name).toBe(`${CONSOLE_CONTROL_NAME} — may need you 3m`);
  expect(quiet.title).toContain("may be waiting for you");
  expect(quiet.badge?.live).toBeUndefined();
});

test("the overlay shows the running console, else the one it showed, else the newest", () => {
  const older = console_("older", { state: "exited", createdAt: at(3_600_000) });
  const newer = console_("newer", { state: "exited", createdAt: at(600_000) });
  const running = console_("running", { createdAt: at(5_000_000) });
  expect(consoleToShow([])).toBeUndefined();
  expect(consoleToShow([older, newer])).toBe(newer);
  expect(consoleToShow([older, newer], "older")).toBe(older);
  expect(consoleToShow([older, newer, running], "older")).toBe(running);
});

test("a running console is neither counted nor listed as open work", () => {
  const { items, running, unshipped } = openWork([], [console_("c"), change("s1"), change("s2", { change: "add-y" })], NOW);
  expect(items.map((i) => i.key)).toEqual(["s1", "s2"]);
  expect(running).toBe(2);
  expect(unshipped).toBe(0);
});
