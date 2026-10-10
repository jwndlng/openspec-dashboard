import { expect, test } from "bun:test";
import { defaultConfig, newRepoConfig } from "../src/server/config.ts";
import { ANTIGRAVITY_PROFILE, CLAUDE_PROFILE, CODEX_PROFILE } from "../src/shared/agentDefaults.ts";
import type { AgentAvailability, Config, EnvironmentReport, RepoConfig } from "../src/shared/types.ts";
import { NEW_AGENT_PROMPTS } from "../src/ui/sessionState.ts";
import {
  type AgentsChoice,
  agentChoices,
  agentsReady,
  agentsSave,
  allInPlace,
  consoleSave,
  customAgentProblem,
  customAgentRef,
  doneCards,
  defaultAgentOptions,
  expandHome,
  initiallyChecked,
  isAbsoluteRoot,
  NOTHING_SAVED,
  preselectedAgent,
  projectSettingsSave,
  SETUP_STEPS,
  settingValue,
  setupSummary,
  sharedSetting,
  shouldOpenSetup,
  skippedNote,
  untouchedDefaultAgents,
  workspaceSave,
} from "../src/ui/setupState.ts";

const found = (id: string, name: string, available: boolean): AgentAvailability => ({ id, name, available, ...(available ? { path: `/usr/local/bin/${id}` } : {}) });

const open = { enabled: true, pending: true, alreadyOpened: false, ready: true, overlayOpen: false };

/** A configuration whose Claude Code profile the user edited: a profile they configured, which the wizard keeps. */
const EDITED_CLAUDE = { ...CLAUDE_PROFILE, command: ["claude", "--model", "opus", "{prompt}"] };
function edited(): Config {
  const base = defaultConfig();
  return { ...base, agentSessions: { ...base.agentSessions, agents: [structuredClone(EDITED_CLAUDE)] } };
}

test("the seven steps, in order", () => {
  expect([...SETUP_STEPS]).toEqual(["Welcome", "Workspace", "Agents", "Console", "Project settings", "System check", "Done"]);
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
  const config = edited();
  const choices = agentChoices(config, [found("claude", "Claude Code", false)], [found("codex", "Codex", true), found("agy", "Antigravity", false)]);
  expect(choices.map((c) => [c.id, c.configured, c.available])).toEqual([
    ["codex", false, true],
    ["claude", true, false],
    ["agy", false, false],
  ]);
  expect(preselectedAgent(config, choices)).toBe("codex");
});

test("an installed default stays preselected; with nothing installed the default is", () => {
  const config = edited();
  expect(preselectedAgent(config, agentChoices(config, [found("claude", "Claude Code", true)], [found("codex", "Codex", true)]))).toBe("claude");
  expect(preselectedAgent(config, agentChoices(config, [found("claude", "Claude Code", false)], [found("codex", "Codex", false)]))).toBe("claude");
});

const agentsChoice = (patch: Partial<AgentsChoice> = {}): AgentsChoice => ({ enable: false, checked: ["claude"], custom: [], defaultAgent: "claude", ...patch });

test("configured profiles and found presets are checked; the default is chosen among the checked ones", () => {
  const config = edited();
  // claude and codex found, agy not.
  const choices = agentChoices(config, [found("claude", "Claude Code", true)], [found("codex", "Codex", true), found("agy", "Antigravity", false)]);
  const checked = initiallyChecked(choices);
  expect(checked).toEqual(["claude", "codex"]);
  expect(preselectedAgent(config, choices, checked)).toBe("claude");
  // Only codex found: it is checked and preselected, the configured claude stays checked.
  const onlyCodex = agentChoices(config, [found("claude", "Claude Code", false)], [found("codex", "Codex", true), found("agy", "Antigravity", false)]);
  expect(initiallyChecked(onlyCodex)).toEqual(["codex", "claude"]);
  expect(preselectedAgent(config, onlyCodex, initiallyChecked(onlyCodex))).toBe("codex");
  // An unchecked preset is not preselected, even when found.
  expect(preselectedAgent(config, onlyCodex, ["claude"])).toBe("claude");
  expect(defaultAgentOptions(onlyCodex, ["codex", "claude"], [{ key: "1", name: " My agent ", command: "my-agent" }, { key: "2", name: "", command: "x" }]).map((o) => o.id)).toEqual(["codex", "claude", "custom:1"]);
});

test("switching on with a preset adds it, makes it the default and keeps the other profile", () => {
  const saved = agentsSave(edited(), agentsChoice({ enable: true, checked: ["codex", "claude"], defaultAgent: "codex" }));
  expect(saved?.agentSessions.enabled).toBe(true);
  expect(saved?.agentSessions.defaultAgent).toBe("codex");
  expect(saved?.agentSessions.agents.map((a) => a.id)).toEqual(["claude", "codex"]);
  expect(saved?.agentSessions.agents[1]).toEqual(CODEX_PROFILE);
  expect(saved?.agentSessions.agents[0]).toEqual(EDITED_CLAUDE);
});

test("the shipped Claude Code profile is not pre-configured: it is offered like any preset, checked only when found", () => {
  const fresh = defaultConfig();
  expect(untouchedDefaultAgents(fresh)).toBe(true);
  expect(untouchedDefaultAgents(edited())).toBe(false);
  const missing = agentChoices(fresh, [found("claude", "Claude Code", false)], [found("codex", "Codex", false), found("agy", "Antigravity", false)]);
  expect(missing.every((c) => !c.configured)).toBe(true);
  expect(initiallyChecked(missing)).toEqual([]);
  // One agent is required to proceed.
  expect(agentsReady(missing, [], [])).toBe(false);
  expect(agentsReady(missing, ["codex"], [])).toBe(true);
  expect(agentsReady(missing, [], [{ key: "1", name: "My agent", command: "my-agent" }])).toBe(true);
  expect(agentsReady(missing, [], [{ key: "1", name: "My agent", command: "" }])).toBe(false);
  const installed = agentChoices(fresh, [found("claude", "Claude Code", true)], [found("codex", "Codex", false)]);
  expect(initiallyChecked(installed)).toEqual(["claude"]);
});

test("saving replaces the shipped profile with exactly the agents checked", () => {
  const onlyCodex = agentsSave(defaultConfig(), agentsChoice({ enable: true, checked: ["codex"], defaultAgent: "codex" }));
  expect(onlyCodex?.agentSessions.agents).toEqual([CODEX_PROFILE]);
  expect(onlyCodex?.agentSessions.defaultAgent).toBe("codex");
  // Keeping Claude Code checked keeps it; only switching sessions on is a change then.
  const keep = agentsSave(defaultConfig(), agentsChoice({ enable: true }));
  expect(keep?.agentSessions.agents).toEqual([CLAUDE_PROFILE]);
  expect(agentsSave(defaultConfig(), agentsChoice())).toBeNull();
  // Nothing checked: nothing saved, the configuration keeps the agent it has.
  expect(agentsSave(defaultConfig(), agentsChoice({ enable: true, checked: [], defaultAgent: "" }))).toBeNull();
  // A profile the user edited is never replaced.
  expect(agentsSave(edited(), agentsChoice({ checked: ["codex"], defaultAgent: "codex" }))?.agentSessions.agents.map((a) => a.id)).toEqual(["claude", "codex"]);
});

test("several presets are added in the order listed", () => {
  const saved = agentsSave(defaultConfig(), agentsChoice({ enable: true, checked: ["claude", "codex", "agy"], defaultAgent: "codex" }));
  expect(saved?.agentSessions.agents).toEqual([CLAUDE_PROFILE, CODEX_PROFILE, ANTIGRAVITY_PROFILE]);
  expect(saved?.agentSessions.defaultAgent).toBe("codex");
  expect(saved?.repos).toEqual(defaultConfig().repos);
});

test("a custom agent gets the profile Settings creates, and can be the default", () => {
  const custom = { key: "k1", name: "My agent", command: "my-agent\n{prompt}\n" };
  const saved = agentsSave(defaultConfig(), agentsChoice({ custom: [custom], defaultAgent: customAgentRef(custom) }));
  const added = saved?.agentSessions.agents[1];
  expect(added).toEqual({ id: "my-agent", name: "My agent", command: ["my-agent", "{prompt}"], prompts: NEW_AGENT_PROMPTS });
  expect(saved?.agentSessions.defaultAgent).toBe("my-agent");
  // Its id never collides with a configured one.
  const taken = agentsSave(defaultConfig(), agentsChoice({ custom: [{ key: "k", name: "Claude", command: "claude" }] }));
  expect(taken?.agentSessions.agents.map((a) => a.id)).toEqual(["claude", "claude-2"]);
});

test("an incomplete custom agent says what is missing and is not saved", () => {
  expect(customAgentProblem({ key: "1", name: "My agent", command: "  \n" })).toContain("command");
  expect(customAgentProblem({ key: "1", name: " ", command: "my-agent" })).toContain("name");
  expect(agentsSave(defaultConfig(), agentsChoice({ custom: [{ key: "1", name: "My agent", command: "" }] }))).toBeNull();
});

test("leaving agent sessions off with the current default saves nothing", () => {
  expect(agentsSave(defaultConfig(), agentsChoice())).toBeNull();
});

test("the Agents step never switches agent sessions off and never touches repositories", () => {
  const on: Config = { ...edited(), agentSessions: { ...edited().agentSessions, enabled: true } };
  expect(agentsSave(on, agentsChoice())).toBeNull();
  const changed = agentsSave(on, agentsChoice({ checked: ["claude", "codex"], defaultAgent: "codex" }));
  expect(changed?.agentSessions.enabled).toBe(true);
  expect(changed?.repos).toBe(on.repos);
  // An agent that is neither configured nor a preset is not saved, and the default stays.
  expect(agentsSave(on, agentsChoice({ checked: ["nobody"], defaultAgent: "nobody" }))).toBeNull();
  // Unchecking a configured profile is not possible: it is kept whatever `checked` says.
  expect(agentsSave(on, agentsChoice({ checked: ["codex"], defaultAgent: "codex" }))?.agentSessions.agents.map((a) => a.id)).toEqual(["claude", "codex"]);
});

test("the Console step saves only the console agent, and the default agent as no choice", () => {
  const two: Config = { ...defaultConfig(), agentSessions: { ...defaultConfig().agentSessions, agents: [CLAUDE_PROFILE, CODEX_PROFILE] } };
  const chosen = consoleSave(two, "codex");
  expect(chosen?.agentSessions.consoleAgent).toBe("codex");
  expect(chosen?.agentSessions.defaultAgent).toBe("claude");
  expect(consoleSave(two, undefined)).toBeNull();
  expect(chosen && consoleSave(chosen, "codex")).toBeNull();
  const back = chosen && consoleSave(chosen, undefined);
  expect(back && "consoleAgent" in back.agentSessions).toBe(false);
  expect(consoleSave(two, "nobody")).toBeNull();
});

const repoAt = (path: string, patch: Partial<RepoConfig> = {}): RepoConfig => ({ ...newRepoConfig(path, true), ...patch });

function projects(): Config {
  const base = defaultConfig();
  return {
    ...base,
    agentSessions: { ...base.agentSessions, enabled: true },
    repos: [repoAt("/w/acme/alpha-infra", { autoFetchSeconds: 300 }), repoAt("/w/acme/demo-ops"), repoAt("/w/acme/beta-notes"), repoAt("/w/acme/old", { enabled: false })],
  };
}
const gitIds = (config: Config) => new Set(config.repos.filter((r) => !r.path.endsWith("beta-notes")).map((r) => r.id));
const none = new Map();

test("the shared form shows the defaults, a mixed value as undefined, and which projects a setting skips", () => {
  const config = projects();
  const enabled = config.repos.filter((r) => r.enabled);
  const git = gitIds(config);
  const isGit = (id: string) => git.has(id);
  expect(sharedSetting(enabled, "agentSessions", {}, config, isGit)).toMatchObject({ applies: 3, value: "enabled" });
  expect(sharedSetting(enabled, "prTitles", {}, config, isGit)).toMatchObject({ applies: 2, value: "" });
  expect(sharedSetting(enabled, "autoMergeDocs", {}, config, isGit)).toMatchObject({ applies: 2, value: "off" });
  expect(sharedSetting(enabled, "autoFetch", {}, config, isGit)).toMatchObject({ applies: 2, value: undefined });
  expect(sharedSetting(enabled, "agent", {}, config, isGit).applies).toBe(0);
  // Switching sessions off in the same form hides Docs auto-merge.
  expect(sharedSetting(enabled, "autoMergeDocs", { agentSessions: "disabled" }, config, isGit).applies).toBe(0);
  expect(settingValue(config.repos[0], "autoFetch")).toBe("300");
  expect(sharedSetting(enabled, "autoFetch", {}, config, isGit).skipped).toEqual([{ name: "beta-notes", reason: "no-git" }]);
  expect(sharedSetting(enabled, "autoMergeDocs", { agentSessions: "disabled" }, config, isGit).skipped.map((s) => s.reason)).toEqual(["sessions-off", "sessions-off", "no-git"]);
});
test("the skipped projects are named with the reason, at most three per reason", () => {
  expect(skippedNote([])).toBeUndefined();
  expect(skippedNote([{ name: "beta-notes", reason: "no-git" }])).toBe("Not set for beta-notes, which is not a git repository.");
  const many = ["a", "b", "c", "d", "e"].map((name) => ({ name, reason: "no-git" as const }));
  expect(skippedNote(many)).toBe("Not set for a, b, c and 2 more, which are not git repositories.");
  expect(skippedNote([{ name: "beta-notes", reason: "no-git" }, { name: "demo-ops", reason: "sessions-off" }, { name: "alpha-infra", reason: "sessions-off" }])).toBe(
    "Not set for beta-notes, which is not a git repository. Not set for demo-ops and alpha-infra, whose agent sessions are disabled.",
  );
});


test("one change for all projects is written where it applies, and nothing else changes", () => {
  const config = projects();
  const git = gitIds(config);
  const saved = projectSettingsSave(config, "all", { all: { prTitles: "conventional-commits" }, each: none }, (id) => git.has(id));
  expect(saved?.changed).toBe(2);
  expect(saved?.config.repos.map((r) => r.prTitleConvention)).toEqual(["conventional-commits", "conventional-commits", undefined, undefined]);
  // Mixed auto fetch, untouched, keeps each project's interval.
  expect(saved?.config.repos.map((r) => r.autoFetchSeconds)).toEqual([300, undefined, undefined, undefined]);
  expect(saved?.config.repos[3]).toBe(config.repos[3]);
});

test("individual settings are written per project; choosing the default clears the key", () => {
  const config = projects();
  const [alpha, demo, beta] = config.repos;
  const git = gitIds(config);
  const each = new Map([
    [alpha.id, { autoMergeDocs: "on", autoFetch: "60" }],
    [demo.id, { autoFetch: "0" }],
    [beta.id, { autoFetch: "0", prTitles: "conventional-commits" }],
  ]);
  const saved = projectSettingsSave(config, "individual", { all: { prTitles: "conventional-commits" }, each }, (id) => git.has(id));
  expect(saved?.changed).toBe(2);
  expect(saved?.config.repos[0].agent?.autoMergeDocs).toBe(true);
  expect("autoFetchSeconds" in (saved?.config.repos[0] ?? {})).toBe(false);
  expect(saved?.config.repos[1].autoFetchSeconds).toBe(0);
  // A folder without git gets none of the git-only settings, and the all-mode draft is not used.
  expect(saved?.config.repos[2]).toBe(config.repos[2]);
});

test("a step without changes saves nothing", () => {
  const config = projects();
  const git = gitIds(config);
  expect(projectSettingsSave(config, "all", { all: {}, each: none }, (id) => git.has(id))).toBeNull();
  // Setting a value a project already has changes nothing either.
  expect(projectSettingsSave(config, "all", { all: { agentSessions: "enabled", prTitles: "" }, each: none }, (id) => git.has(id))).toBeNull();
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
  expect(setupSummary(config, { ...NOTHING_SAVED, rootsAdded: ["/w/acme"], tracked: 2, agentsAdded: ["Codex"], projectsChanged: 3 }, report)).toEqual({
    rootsAdded: ["/w/acme"],
    tracked: 2,
    agentsAdded: ["Codex"],
    projectsChanged: 3,
    agentSessions: true,
    defaultAgent: "Claude Code",
    consoleAgent: undefined,
    agents: 1,
    checked: true,
    remaining: ["GitHub CLI"],
  });
  const withConsole: Config = { ...config, agentSessions: { ...config.agentSessions, agents: [CLAUDE_PROFILE, CODEX_PROFILE], consoleAgent: "codex" } };
  expect(setupSummary(withConsole, NOTHING_SAVED).consoleAgent).toBe("Codex");
  expect(allInPlace(report)).toBe(false);
  expect(allInPlace({ ...report, checks: report.checks.filter((c) => c.status !== "warning") })).toBe(true);
  expect(allInPlace(undefined)).toBe(false);
});

test("the Done step's cards say how each step came out; only the System check can need attention", () => {
  const base = { ...NOTHING_SAVED, rootsAdded: ["/w/acme"], tracked: 2, agentsAdded: ["Codex"], agentSessions: true, defaultAgent: "Claude Code", agents: 2, checked: true, remaining: [] };
  expect(doneCards(base).map((c) => [c.step, c.mark, c.outcome])).toEqual([
    ["Workspace", "done", "2 projects"],
    ["Agents", "done", "2 agents"],
    ["Console", "done", "Claude Code"],
    ["Project settings", "unchanged", "No change"],
    ["System check", "done", "All in place"],
  ]);
  expect(doneCards(base)[0].detail).toBe("Tracked, from /w/acme");
  expect(doneCards({ ...base, rootsAdded: ["/home/demo/Workspace"] }, "/home/demo")[0].detail).toBe("Tracked, from ~/Workspace");
  expect(doneCards(base)[1].detail).toBe("Sessions on, Claude Code by default; added Codex");
  const left = doneCards({ ...base, remaining: ["GitHub CLI"], consoleAgent: "Codex", projectsChanged: 1 });
  expect(left[4]).toMatchObject({ mark: "attention", outcome: "1 to fix" });
  expect(left[4].detail).toContain("GitHub CLI");
  expect(left[2]).toMatchObject({ outcome: "Codex", detail: "Chosen for the console" });
  expect(left[3]).toMatchObject({ mark: "done", outcome: "1 project" });
  const nothing = doneCards({ ...NOTHING_SAVED, agentSessions: false, agents: 1, checked: false, remaining: [] });
  expect(nothing.map((c) => c.mark)).toEqual(["unchanged", "unchanged", "unchanged", "unchanged", "attention"]);
  expect(nothing[2].detail).toBe("Available once agent sessions are on");
});

test("the demo turns the wizard's auto-open off, as it does the tour's", async () => {
  const source = await Bun.file(new URL("../src/ui/demo/main.tsx", import.meta.url)).text();
  expect(source).toContain("setSetupAutoOpen(false)");
});
