import { expect, test } from "bun:test";
import { defaultConfig } from "../src/server/config.ts";
import { CLAUDE_PROFILE, CODEX_PROFILE } from "../src/shared/agentDefaults.ts";
import type { AgentAvailability, Config, EnvironmentReport } from "../src/shared/types.ts";
import { agentChoices, agentsSave, allInPlace, expandHome, isAbsoluteRoot, preselectedAgent, SETUP_STEPS, setupSummary, shouldOpenSetup, workspaceSave } from "../src/ui/setupState.ts";

const found = (id: string, name: string, available: boolean): AgentAvailability => ({ id, name, available, ...(available ? { path: `/usr/local/bin/${id}` } : {}) });

const open = { enabled: true, pending: true, alreadyOpened: false, ready: true, overlayOpen: false };

test("the five steps, in order", () => {
  expect([...SETUP_STEPS]).toEqual(["Welcome", "Workspace", "Agents", "System check", "Done"]);
});

test("the wizard opens by itself only while setup is pending, once, with nothing in the way", () => {
  expect(shouldOpenSetup(open)).toBe(true);
  expect(shouldOpenSetup({ ...open, pending: false })).toBe(false);
  expect(shouldOpenSetup({ ...open, alreadyOpened: true })).toBe(false);
  expect(shouldOpenSetup({ ...open, ready: false })).toBe(false);
  // A deep link to a change: the wizard waits for the detail view to close.
  expect(shouldOpenSetup({ ...open, overlayOpen: true })).toBe(false);
  // The demo.
  expect(shouldOpenSetup({ ...open, enabled: false })).toBe(false);
});

test("typed roots are expanded against the server's home and checked for being absolute", () => {
  expect(expandHome("~/Workspace/", "/home/demo")).toBe("/home/demo/Workspace");
  expect(expandHome("~", "/home/demo")).toBe("/home/demo");
  expect(expandHome(" /w/acme ", "/home/demo")).toBe("/w/acme");
  expect(isAbsoluteRoot("~/Projects")).toBe(true);
  expect(isAbsoluteRoot("/w/acme")).toBe(true);
  expect(isAbsoluteRoot("C:\\work")).toBe(true);
  expect(isAbsoluteRoot("workspace")).toBe(false);
});

test("the Workspace step adds roots, keeps existing ones, skips missing ones and saves nothing without entries", () => {
  const current: Config = { ...defaultConfig(), scanRoots: ["/w/one", "/w/two"] };
  expect(workspaceSave(current, ["/w/three"], new Set())?.scanRoots).toEqual(["/w/one", "/w/two", "/w/three"]);
  expect(workspaceSave(current, ["/w/missing"], new Set(["/w/missing"]))).toBeNull();
  expect(workspaceSave(current, ["/w/one"], new Set())).toBeNull();
  expect(workspaceSave(current, [], new Set())).toBeNull();
  // Nothing else changes: ignore paths and repositories are carried over as they were.
  const withRepos: Config = { ...current, ignorePaths: ["/w/one/mirror"], repos: [] };
  const saved = workspaceSave(withRepos, ["/w/acme"], new Set());
  expect(saved?.ignorePaths).toEqual(["/w/one/mirror"]);
  expect(saved?.agentSessions).toBe(withRepos.agentSessions);
});

test("an installed preset is offered first and preselected when the default agent is missing", () => {
  const config = defaultConfig();
  const choices = agentChoices(config, [found("claude", "Claude Code", false)], [found("codex", "Codex", true), found("agy", "Antigravity", false)]);
  expect(choices.map((c) => [c.id, c.configured, c.available])).toEqual([
    ["codex", false, true],
    ["claude", true, false],
    ["agy", false, false],
  ]);
  expect(preselectedAgent(config, choices)).toBe("codex");
});

test("an installed default stays preselected; with nothing installed the default is", () => {
  const config = defaultConfig();
  expect(preselectedAgent(config, agentChoices(config, [found("claude", "Claude Code", true)], [found("codex", "Codex", true)]))).toBe("claude");
  expect(preselectedAgent(config, agentChoices(config, [found("claude", "Claude Code", false)], [found("codex", "Codex", false)]))).toBe("claude");
});

test("switching on with a preset adds it, makes it the default and keeps the other profile", () => {
  const saved = agentsSave(defaultConfig(), { enable: true, agentId: "codex" });
  expect(saved?.agentSessions.enabled).toBe(true);
  expect(saved?.agentSessions.defaultAgent).toBe("codex");
  expect(saved?.agentSessions.agents.map((a) => a.id)).toEqual(["claude", "codex"]);
  expect(saved?.agentSessions.agents[1]).toEqual(CODEX_PROFILE);
  expect(saved?.agentSessions.agents[0]).toEqual(CLAUDE_PROFILE);
});

test("leaving agent sessions off with the current default saves nothing", () => {
  expect(agentsSave(defaultConfig(), { enable: false, agentId: "claude" })).toBeNull();
});

test("the Agents step never switches agent sessions off and never touches repositories", () => {
  const on: Config = { ...defaultConfig(), agentSessions: { ...defaultConfig().agentSessions, enabled: true } };
  expect(agentsSave(on, { enable: false, agentId: "claude" })).toBeNull();
  const changed = agentsSave(on, { enable: false, agentId: "codex" });
  expect(changed?.agentSessions.enabled).toBe(true);
  expect(changed?.repos).toBe(on.repos);
  // An agent that is neither configured nor a preset is not saved.
  expect(agentsSave(on, { enable: true, agentId: "nobody" })).toBeNull();
});

test("the Done step names what was saved and what is left", () => {
  const config: Config = { ...defaultConfig(), agentSessions: { ...defaultConfig().agentSessions, enabled: true } };
  const report: EnvironmentReport = {
    checkedAt: "2026-10-09T10:00:00.000Z",
    status: "warning",
    checks: [
      { id: "git", label: "git", status: "ok", found: "/usr/bin/git" },
      { id: "github-cli", label: "GitHub CLI", status: "warning", found: "`gh` not found on the PATH" },
      { id: "openspec-cli", label: "OpenSpec CLI", status: "not-needed", found: "-" },
    ],
  };
  expect(setupSummary(config, { rootsAdded: ["/w/acme"], tracked: 2 }, report)).toEqual({
    rootsAdded: ["/w/acme"],
    tracked: 2,
    agentSessions: true,
    defaultAgent: "Claude Code",
    remaining: ["GitHub CLI"],
  });
  expect(allInPlace(report)).toBe(false);
  expect(allInPlace({ ...report, checks: report.checks.filter((c) => c.status !== "warning") })).toBe(true);
  expect(allInPlace(undefined)).toBe(false);
});

test("the demo turns the wizard's auto-open off, as it does the tour's", async () => {
  const source = await Bun.file(new URL("../src/ui/demo/main.tsx", import.meta.url)).text();
  expect(source).toContain("setSetupAutoOpen(false)");
});
