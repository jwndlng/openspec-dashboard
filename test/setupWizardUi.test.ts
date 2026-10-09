import { expect, test } from "bun:test";
import { defaultConfig, newRepoConfig } from "../src/server/config.ts";
import { CLAUDE_PROFILE, CODEX_PROFILE } from "../src/shared/agentDefaults.ts";
import type { Config, EnvironmentReport, RepoConfig } from "../src/shared/types.ts";
import { NOTHING_SAVED } from "../src/ui/setupState.ts";
import {
  AgentsStep,
  type AgentsView,
  ConsoleStep,
  type ConsoleView,
  DoneStep,
  ProjectSettingsStep,
  type ProjectSettingsView,
  SystemCheckStep,
  WelcomeStep,
  WizardFrame,
  WorkspaceStep,
  type WorkspaceView,
} from "../src/ui/setupWizard.tsx";
import { byTag, elements, textOf } from "./vnode.ts";

const noop = () => {};

test("the wizard is a dialog named as the setup, showing its position and every step", () => {
  const frame = WizardFrame({ step: 3, onContinue: noop, onBack: noop, onSkip: noop, children: "body" });
  const dialog = byTag(frame, "div").find((el) => el.props.role === "dialog");
  expect(dialog?.props["aria-modal"]).toBe("true");
  expect(String(dialog?.props["aria-label"])).toContain("setup");
  const text = textOf(frame);
  expect(text).toContain("4 of 7");
  const steps = byTag(byTag(frame, "ol")[0], "li");
  expect(steps.map(textOf)).toEqual(["Welcome", "Workspace", "Agents", "Console", "Project settings", "System check", "Done"]);
  expect(steps.filter((li) => li.props["aria-current"] === "step").map(textOf)).toEqual(["Console"]);
  expect(byTag(frame, "button").map(textOf)).toEqual(["Skip setup", "Back", "Continue"]);
});

test("Welcome has no Back, Done no Skip, and a pending Skip asks first", () => {
  expect(byTag(WizardFrame({ step: 0, onContinue: noop, onSkip: noop, children: "" }), "button").map(textOf)).toEqual(["Skip setup", "Continue"]);
  expect(byTag(WizardFrame({ step: 6, onContinue: noop, onBack: noop, continueLabel: "Finish", children: "" }), "button").map(textOf)).toEqual(["Back", "Finish"]);
  const confirming = WizardFrame({ step: 1, onContinue: noop, onSkip: noop, confirmingSkip: true, onConfirmSkip: noop, onCancelSkip: noop, children: "" });
  expect(textOf(confirming)).toContain("not saved");
  expect(byTag(confirming, "button").map(textOf)).toEqual(["Keep going", "Skip setup"]);
});

test("Welcome names the five topics, that steps can be skipped, and Help", () => {
  const text = textOf(WelcomeStep());
  for (const word of ["Workspace", "Agents", "Console", "Project settings", "System check", "skipped", "Settings", "Help"]) expect(text).toContain(word);
});

test("Welcome shows the steps as an ordered list, the connectors and the Ready node hidden", () => {
  const step = WelcomeStep();
  const list = byTag(step, "ol").find((el) => el.props["aria-label"] === "What setup covers");
  const items = byTag(list, "li");
  expect(items.map((li) => textOf(byTag(li, "strong")[0]))).toEqual(["Workspace", "Agents", "Console", "Project settings", "System check"]);
  expect(items.map((li) => textOf(li).slice(0, 1))).toEqual(["1", "2", "3", "4", "5"]);
  for (const li of items) expect(byTag(li, "span").find((el) => el.props.class === "setup-flow-mark")?.props["aria-hidden"]).toBe("true");
  const ready = byTag(step, "div").find((el) => String(el.props.class).includes("setup-flow-end"));
  expect(ready?.props["aria-hidden"]).toBe("true");
  expect(textOf(ready)).toContain("Ready");
});

const workspace = (patch: Partial<WorkspaceView> = {}): WorkspaceView => ({
  configuredRoots: [],
  entered: ["/w/acme"],
  missing: new Map(),
  suggestions: ["/home/demo/Workspace"],
  input: "",
  discovering: false,
  unchecked: new Set(),
  picker: true,
  picking: false,
  discovery: {
    candidates: [
      { id: "a1", path: "/w/acme/alpha-infra", name: "alpha-infra", enabled: false },
      { id: "d1", path: "/w/acme/demo-ops", name: "demo-ops", enabled: false },
    ],
    integratable: [{ id: "c1", path: "/w/acme/chat-groups", name: "chat-groups" }],
    errors: [],
  },
  ...patch,
});

test("found projects are listed checked, an unchecked one is not, and repositories without OpenSpec point to the overview", () => {
  const step = WorkspaceStep({ view: workspace({ unchecked: new Set(["/w/acme/demo-ops"]) }), onInput: noop, onAdd: noop, onRemove: noop, onToggle: noop, onPick: noop });
  const boxes = byTag(step, "input").filter((el) => el.props.type === "checkbox");
  expect(boxes.map((el) => el.props.checked)).toEqual([true, false]);
  const text = textOf(step);
  expect(text).toContain("2 projects with OpenSpec were found");
  expect(text).toContain("One git repository without OpenSpec was found");
  expect(text).toContain("projects overview");
});

test("a suggestion adds its folder, and a missing root is marked", () => {
  const added: string[] = [];
  const step = WorkspaceStep({ view: workspace({ missing: new Map([["/w/acme", "does not exist"]]) }), onInput: noop, onAdd: (p) => added.push(p), onRemove: noop, onToggle: noop, onPick: noop });
  const suggestion = byTag(step, "button").find((el) => textOf(el).includes("/home/demo/Workspace"));
  expect(suggestion).toBeDefined();
  (suggestion!.props.onClick as () => void)();
  expect(added).toEqual(["/home/demo/Workspace"]);
  expect(textOf(step)).toContain("not found — does not exist");
});

test("Choose folder… opens the dialog, waits while it is open, and is not offered without a picker", () => {
  let picked = 0;
  const step = WorkspaceStep({ view: workspace(), onInput: noop, onAdd: noop, onRemove: noop, onToggle: noop, onPick: () => picked++ });
  const choose = byTag(step, "button").find((el) => textOf(el) === "Choose folder…");
  (choose!.props.onClick as () => void)();
  expect(picked).toBe(1);
  const waiting = byTag(WorkspaceStep({ view: workspace({ picking: true }), onInput: noop, onAdd: noop, onRemove: noop, onToggle: noop, onPick: noop }), "button").find((el) => textOf(el).includes("folder dialog"));
  expect(waiting?.props.disabled).toBe(true);
  const none = WorkspaceStep({ view: workspace({ picker: false }), onInput: noop, onAdd: noop, onRemove: noop, onToggle: noop, onPick: noop });
  expect(byTag(none, "button").some((el) => textOf(el).includes("Choose folder"))).toBe(false);
  expect(byTag(none, "input").some((el) => el.props["aria-label"] === "Folder to add")).toBe(true);
  const failed = WorkspaceStep({ view: workspace({ pickError: "no display." }), onInput: noop, onAdd: noop, onRemove: noop, onToggle: noop, onPick: noop });
  expect(textOf(failed)).toContain("type the path instead");
  const again = WorkspaceStep({ view: workspace({ pickedAgain: "/w/acme" }), onInput: noop, onAdd: noop, onRemove: noop, onToggle: noop, onPick: noop });
  expect(textOf(again)).toContain("/w/acme is already listed");
});

const agentHandlers = { onEnable: noop, onCheck: noop, onAddCustom: noop, onCustomChange: noop, onRemoveCustom: noop, onDefault: noop };
const agents = (patch: Partial<AgentsView> = {}): AgentsView => ({
  savedEnabled: false,
  enable: false,
  choices: [
    { id: "codex", name: "Codex", configured: false, available: true },
    { id: "claude", name: "Claude Code", configured: true, available: true },
    { id: "agy", name: "Antigravity", configured: false, available: false },
  ],
  checked: ["codex", "claude"],
  custom: [],
  defaultOptions: [
    { id: "codex", name: "Codex", available: true },
    { id: "claude", name: "Claude Code", available: true },
  ],
  defaultAgent: "claude",
  installs: [],
  ...patch,
});

test("the Agents step states the risks and lists every agent with a checkbox, configured ones locked", () => {
  const step = AgentsStep({ view: agents(), ...agentHandlers });
  expect(textOf(step)).toContain("change files and run commands");
  expect(textOf(step)).toContain("worktree");
  const boxes = byTag(byTag(step, "fieldset")[0], "input").filter((el) => el.props.type === "checkbox");
  expect(boxes.map((el) => [el.props.checked, el.props.disabled])).toEqual([
    [true, false],
    [true, true],
    [false, false],
  ]);
  expect(textOf(step)).toContain("not found");
  expect(textOf(step)).toContain("added when you continue");
  const select = byTag(step, "select").find((el) => el.props["aria-label"] === "Default agent");
  expect(select?.props.value).toBe("claude");
  expect(byTag(select, "option").map(textOf)).toEqual(["Codex", "Claude Code"]);
});

test("checking an agent and adding a custom one are reported", () => {
  const calls: unknown[] = [];
  const step = AgentsStep({ view: agents(), ...agentHandlers, onCheck: (id, on) => calls.push([id, on]), onAddCustom: () => calls.push("add") });
  const agy = byTag(byTag(step, "fieldset")[0], "input").filter((el) => el.props.type === "checkbox")[2];
  (agy.props.onChange as (e: unknown) => void)({ currentTarget: { checked: true } });
  (byTag(step, "button").find((el) => textOf(el).includes("Add another agent"))!.props.onClick as () => void)();
  expect(calls).toEqual([["agy", true], "add"]);
});

test("an incomplete custom agent says what is missing", () => {
  const step = AgentsStep({ view: agents({ custom: [{ key: "1", name: "My agent", command: "" }] }), ...agentHandlers });
  expect(textOf(step)).toContain("Enter the command");
  const ok = AgentsStep({ view: agents({ custom: [{ key: "1", name: "My agent", command: "my-agent" }] }), ...agentHandlers });
  expect(textOf(ok)).toContain("edited in Settings");
});

test("a checked agent that is missing shows how to install it, and the switch cannot turn sessions off", () => {
  const install = [{ text: "Install Antigravity.", command: "curl -fsSL https://antigravity.google/install.sh | bash" }];
  const step = AgentsStep({ view: agents({ installs: [{ name: "Antigravity", steps: install }], savedEnabled: true, enable: true }), ...agentHandlers });
  expect(byTag(step, "code").map(textOf)).toContain("curl -fsSL https://antigravity.google/install.sh | bash");
  expect(textOf(step)).toContain("Antigravity was not found");
  const toggle = byTag(step, "input").find((el) => el.props.type === "checkbox");
  expect(toggle?.props.checked).toBe(true);
  expect(toggle?.props.disabled).toBe(true);
});

const consoleView = (patch: Partial<ConsoleView> = {}): ConsoleView => ({
  sessionsOn: true,
  agents: [
    { id: "claude", name: "Claude Code", available: true },
    { id: "codex", name: "Codex", available: true },
  ],
  defaultName: "Claude Code",
  ...patch,
});

test("the Console step explains the console and offers the default agent or any profile", () => {
  const step = ConsoleStep({ view: consoleView(), onChoose: noop });
  const text = textOf(step);
  for (const words of ["no project and no change", "top bar", "console folder", "across"]) expect(text).toContain(words);
  const select = byTag(step, "select")[0];
  expect(byTag(select, "option").map(textOf)).toEqual(["Default agent (Claude Code)", "Claude Code", "Codex"]);
  expect(select.props.value).toBe("");
  const chosen: unknown[] = [];
  const picked = ConsoleStep({ view: consoleView({ choice: "codex" }), onChoose: (id) => chosen.push(id) });
  expect(byTag(picked, "select")[0].props.value).toBe("codex");
  (byTag(picked, "select")[0].props.onChange as (e: unknown) => void)({ currentTarget: { value: "" } });
  expect(chosen).toEqual([undefined]);
});

test("with one profile the console names it, and with sessions off it says when it becomes available", () => {
  const one = ConsoleStep({ view: consoleView({ agents: [{ id: "claude", name: "Claude Code" }], sessionsOn: false }), onChoose: noop });
  expect(byTag(one, "select")).toHaveLength(0);
  expect(textOf(one)).toContain("The console runs Claude Code");
  expect(textOf(one)).toContain("once you switch them on");
});

const repoAt = (path: string, patch: Partial<RepoConfig> = {}): RepoConfig => ({ ...newRepoConfig(path, true), ...patch });
function settingsView(patch: Partial<ProjectSettingsView> = {}): ProjectSettingsView {
  const base = defaultConfig();
  const config: Config = { ...base, agentSessions: { ...base.agentSessions, enabled: true, agents: [CLAUDE_PROFILE, CODEX_PROFILE] } };
  const projects = [repoAt("/w/acme/alpha-infra"), repoAt("/w/acme/demo-ops"), repoAt("/w/acme/beta-notes")];
  config.repos = projects;
  return { config, projects, isGit: (id) => id !== projects[2].id, mode: "all", all: {}, each: new Map(), index: 0, ...patch };
}
const settingsHandlers = { onMode: noop, onChange: noop, onIndex: noop };
const labelsOf = (node: unknown) => byTag(node as never, "select").map((el) => String(el.props["aria-label"]));

test("Same settings for all projects shows every setting with its default and how many projects it applies to", () => {
  const step = ProjectSettingsStep({ view: settingsView(), ...settingsHandlers });
  expect(labelsOf(step)).toEqual(["Agent sessions for all projects", "Agent for all projects", "PR titles for all projects", "Docs auto-merge for all projects", "Auto fetch for all projects"]);
  const text = textOf(step);
  expect(text).toContain("Default: Enabled.");
  expect(text).toContain("Default: Every minute.");
  expect(text).toContain("Applies to 2 of 3 projects.");
  expect(text).not.toContain("saved at once");
  expect(byTag(step, "input").filter((el) => el.props.type === "radio").map((el) => el.props.checked)).toEqual([true, false]);
});

test("a mixed value reads Keep each project's setting", () => {
  const view = settingsView();
  view.projects = [repoAt("/w/acme/alpha-infra", { autoFetchSeconds: 300 }), ...view.projects.slice(1)];
  const autoFetch = byTag(ProjectSettingsStep({ view, ...settingsHandlers }), "select").find((el) => el.props["aria-label"] === "Auto fetch for all projects");
  expect(autoFetch?.props.value).toBe("keep");
  expect(textOf(byTag(autoFetch, "option")[0])).toBe("Keep each project's setting");
});

test("Individual settings walks through the projects one at a time", () => {
  const view = settingsView({ mode: "individual", index: 1 });
  const step = ProjectSettingsStep({ view, ...settingsHandlers });
  expect(textOf(step)).toContain("Project 2 of 3");
  expect(textOf(step)).toContain("demo-ops");
  const buttons = byTag(step, "button").map((el) => [textOf(el), el.props.disabled]);
  expect(buttons).toEqual([
    ["Previous project", false],
    ["Next project", false],
  ]);
  // A folder without git shows no git-only settings.
  const beta = ProjectSettingsStep({ view: settingsView({ mode: "individual", index: 2 }), ...settingsHandlers });
  expect(labelsOf(beta)).toEqual(["Agent sessions for beta-notes", "Agent for beta-notes"]);
});

test("projects still being scanned are waited for, and without projects the step says so", () => {
  const view = settingsView();
  const reading = ProjectSettingsStep({ view: { ...view, isGit: (id) => (id === view.projects[0].id ? undefined : true) }, ...settingsHandlers });
  expect(textOf(reading)).toContain("Reading alpha-infra");
  expect(byTag(reading, "select")).toHaveLength(0);
  const empty = ProjectSettingsStep({ view: { ...view, projects: [] }, ...settingsHandlers });
  expect(textOf(empty)).toContain("No project is tracked yet");
});

const reportWith = (status: "warning" | "ok"): EnvironmentReport => ({
  checkedAt: "2026-10-09T10:00:00.000Z",
  status,
  checks: [
    { id: "git", label: "git", status: "ok", found: "/usr/bin/git" },
    status === "warning"
      ? { id: "github-cli", label: "GitHub CLI", status: "warning", found: "`gh` not found on the PATH", remedy: "Install the GitHub CLI.", instructions: [{ text: "Install it.", command: "brew install gh" }, { text: "Sign in.", command: "gh auth login" }] }
      : { id: "github-cli", label: "GitHub CLI", status: "ok", found: "/usr/local/bin/gh" },
  ],
});

test("the System check lists a missing gh with copyable install and login commands", () => {
  const step = SystemCheckStep({ report: reportWith("warning"), loading: false, onRecheck: noop });
  expect(textOf(step)).toContain("warning");
  expect(byTag(step, "code").map(textOf)).toEqual(["brew install gh", "gh auth login"]);
  expect(elements(step).filter((el) => typeof el.type === "function" && el.props.label === "Copy")).toHaveLength(2);
  expect(textOf(step)).not.toContain("Everything needed is in place");
});

test("all in place is said plainly, and Re-check shows that it works", () => {
  expect(textOf(SystemCheckStep({ report: reportWith("ok"), loading: false, onRecheck: noop }))).toContain("Everything needed is in place");
  const working = byTag(SystemCheckStep({ report: reportWith("ok"), loading: true, onRecheck: noop }), "button")[0];
  expect(textOf(working)).toContain("Checking…");
  expect(working.props.disabled).toBe(true);
  expect(textOf(SystemCheckStep({ loading: false, error: "offline", onRecheck: noop }))).toContain("could not be checked");
});

test("Done says what was saved and what is left", () => {
  const summary = { ...NOTHING_SAVED, rootsAdded: ["/w/acme"], tracked: 2, agentsAdded: ["Codex", "Antigravity"], projectsChanged: 3, agentSessions: true, defaultAgent: "Codex", remaining: ["GitHub CLI"] };
  const text = textOf(DoneStep({ summary }));
  expect(text).toContain("/w/acme");
  expect(text).toContain("2 projects are tracked");
  expect(text).toContain("Codex as the default agent");
  expect(text).toContain("Agents added: Codex, Antigravity.");
  expect(text).toContain("The console runs the default agent, Codex.");
  expect(text).toContain("The settings of 3 projects were saved.");
  expect(text).toContain("GitHub CLI");
  expect(textOf(DoneStep({ summary: { ...summary, consoleAgent: "Claude Code" } }))).toContain("The console runs Claude Code.");
});
