import { expect, test } from "bun:test";
import { defaultAgentSessions, defaultConfig, newRepoConfig } from "../src/server/config.ts";
import type { ChangeSession, Config, ProjectConsoleSession } from "../src/shared/types.ts";
import { NEEDS_YOU_AFTER_MS, openWork, projectConsoleControl, projectConsoleUnavailable } from "../src/ui/sessionState.ts";

const NOW = Date.parse("2026-10-04T12:00:00Z");
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const pc = (id: string, patch: Partial<ProjectConsoleSession> = {}): ProjectConsoleSession => ({ id, projectConsole: true, repoId: "r", folder: "/w/acme/demo-ops", inPlace: true, agentId: "a", agentName: "A", state: "running", worktreePath: "/w/acme/demo-ops", createdAt: at(60_000), updatedAt: at(0), resumable: true, ...patch });
const change = (id: string): ChangeSession => ({ id, repoId: "r", change: "add-x", action: "implement", agentId: "a", agentName: "A", state: "running", worktreePath: `/w/${id}`, branch: "feat/add-x", createdAt: at(120_000), updatedAt: at(0), resumable: true });

test("the control names the project, and the running console's state in words", () => {
  const idle = projectConsoleControl([], "demo-ops", undefined, NOW);
  expect(idle).toMatchObject({ name: "Open the console of demo-ops", disabled: false });
  expect(idle.title).toBe("Open the console of demo-ops: your agent in this project's folder, for anything that is not a change");
  expect(idle.badge).toBeUndefined();
  expect(idle.state).toBeUndefined();
  const ended = projectConsoleControl([pc("old", { state: "exited", exitCode: 0 })], "demo-ops", undefined, NOW);
  expect(ended.badge).toBeUndefined();
  expect(ended.state).toBeUndefined();

  const working = projectConsoleControl([pc("c", { lastOutputAt: at(1_000) })], "demo-ops", undefined, NOW);
  expect(working.name).toBe("Open the console of demo-ops — working");
  expect(working.badge).toMatchObject({ tone: "info", live: true });
  expect(working.state).toBe("working");

  const quiet = projectConsoleControl([pc("c", { lastOutputAt: at(NEEDS_YOU_AFTER_MS + 180_000) })], "demo-ops", undefined, NOW);
  expect(quiet.name).toBe("Open the console of demo-ops — may need you 3m");
  expect(quiet.title).toContain("may be waiting for you");
  // The visible text is the badge's own label, so the words on the control and in its name cannot diverge.
  expect(quiet.state).toBe("may need you 3m");
  expect(quiet.state).toBe(quiet.badge?.label);

  const off = projectConsoleControl([], "demo-ops", "agent sessions are off for this project", NOW);
  expect(off).toMatchObject({ disabled: true });
  expect(off.name).toContain("agent sessions are off for this project");
  expect(off.state).toBeUndefined();
  // Unavailable says so even while a console still runs: no state on an inactive control.
  expect(projectConsoleControl([pc("c")], "demo-ops", "agent sessions are off for this project", NOW).state).toBeUndefined();
});

test("why a project's console is unavailable, and when no control is shown at all", () => {
  const repo = { ...newRepoConfig("/w/acme/demo-ops", true) };
  const config: Config = { ...defaultConfig(), repos: [repo], agentSessions: { ...defaultAgentSessions(), enabled: true } };
  const agent = config.agentSessions.agents.find((a) => a.id === config.agentSessions.defaultAgent);
  expect(agent).toBeDefined();
  expect(projectConsoleUnavailable(config, [], repo.id)).toBeUndefined();
  expect(projectConsoleUnavailable(config, [{ id: agent!.id, name: agent!.name, available: false }], repo.id)).toContain("was not found");
  expect(projectConsoleUnavailable({ ...config, repos: [{ ...repo, agent: { enabled: false } }] }, [], repo.id)).toBe("agent sessions are off for this project");
  expect(projectConsoleUnavailable({ ...config, agentSessions: { ...config.agentSessions, enabled: false } }, [], repo.id)).toBeNull();
  expect(projectConsoleUnavailable({ ...config, repos: [{ ...repo, enabled: false }] }, [], repo.id)).toBeNull();
  expect(projectConsoleUnavailable(config, [], "unknown")).toBeNull();
});

test("a running project console is neither counted nor listed as open work", () => {
  const { items, running } = openWork([], [pc("c"), change("s1")], NOW);
  expect(items.map((i) => i.key)).toEqual(["s1"]);
  expect(running).toBe(1);
});
