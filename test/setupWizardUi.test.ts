import { expect, test } from "bun:test";
import type { EnvironmentReport } from "../src/shared/types.ts";
import { AgentsStep, type AgentsView, DoneStep, SystemCheckStep, WelcomeStep, WizardFrame, WorkspaceStep, type WorkspaceView } from "../src/ui/setupWizard.tsx";
import { byTag, elements, textOf } from "./vnode.ts";

const noop = () => {};

test("the wizard is a dialog named as the setup, showing its position and every step", () => {
  const frame = WizardFrame({ step: 2, onContinue: noop, onBack: noop, onSkip: noop, children: "body" });
  const dialog = byTag(frame, "div").find((el) => el.props.role === "dialog");
  expect(dialog?.props["aria-modal"]).toBe("true");
  expect(String(dialog?.props["aria-label"])).toContain("setup");
  const text = textOf(frame);
  expect(text).toContain("3 of 5");
  const steps = byTag(byTag(frame, "ol")[0], "li");
  expect(steps.map(textOf)).toEqual(["Welcome", "Workspace", "Agents", "System check", "Done"]);
  expect(steps.filter((li) => li.props["aria-current"] === "step").map(textOf)).toEqual(["Agents"]);
  expect(byTag(frame, "button").map(textOf)).toEqual(["Skip setup", "Back", "Continue"]);
});

test("Welcome has no Back, Done no Skip, and a pending Skip asks first", () => {
  expect(byTag(WizardFrame({ step: 0, onContinue: noop, onSkip: noop, children: "" }), "button").map(textOf)).toEqual(["Skip setup", "Continue"]);
  expect(byTag(WizardFrame({ step: 4, onContinue: noop, onBack: noop, continueLabel: "Finish", children: "" }), "button").map(textOf)).toEqual(["Back", "Finish"]);
  const confirming = WizardFrame({ step: 1, onContinue: noop, onSkip: noop, confirmingSkip: true, onConfirmSkip: noop, onCancelSkip: noop, children: "" });
  expect(textOf(confirming)).toContain("not saved");
  expect(byTag(confirming, "button").map(textOf)).toEqual(["Keep going", "Skip setup"]);
});

test("Welcome names the three topics, that steps can be skipped, and Help", () => {
  const text = textOf(WelcomeStep());
  for (const word of ["Workspace", "Agents", "System check", "skipped", "Settings", "Help"]) expect(text).toContain(word);
});

const workspace = (patch: Partial<WorkspaceView> = {}): WorkspaceView => ({
  configuredRoots: [],
  entered: ["/w/acme"],
  missing: new Map(),
  suggestions: ["/home/demo/Workspace"],
  input: "",
  discovering: false,
  unchecked: new Set(),
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
  const step = WorkspaceStep({ view: workspace({ unchecked: new Set(["/w/acme/demo-ops"]) }), onInput: noop, onAdd: noop, onRemove: noop, onToggle: noop });
  const boxes = byTag(step, "input").filter((el) => el.props.type === "checkbox");
  expect(boxes.map((el) => el.props.checked)).toEqual([true, false]);
  const text = textOf(step);
  expect(text).toContain("2 projects with OpenSpec were found");
  expect(text).toContain("One git repository without OpenSpec was found");
  expect(text).toContain("projects overview");
});

test("a suggestion adds its folder, and a missing root is marked", () => {
  const added: string[] = [];
  const step = WorkspaceStep({ view: workspace({ missing: new Map([["/w/acme", "does not exist"]]) }), onInput: noop, onAdd: (p) => added.push(p), onRemove: noop, onToggle: noop });
  const suggestion = byTag(step, "button").find((el) => textOf(el).includes("/home/demo/Workspace"));
  expect(suggestion).toBeDefined();
  (suggestion!.props.onClick as () => void)();
  expect(added).toEqual(["/home/demo/Workspace"]);
  expect(textOf(step)).toContain("not found — does not exist");
});

const agents = (patch: Partial<AgentsView> = {}): AgentsView => ({
  savedEnabled: false,
  enable: false,
  choices: [
    { id: "codex", name: "Codex", configured: false, available: true },
    { id: "claude", name: "Claude Code", configured: true, available: false },
  ],
  agentId: "codex",
  ...patch,
});

test("the Agents step states the risks, marks each agent found or not, and says a preset is added", () => {
  const step = AgentsStep({ view: agents(), onEnable: noop, onChoose: noop });
  expect(textOf(step)).toContain("change files and run commands");
  expect(textOf(step)).toContain("worktree");
  const radios = byTag(step, "input").filter((el) => el.props.type === "radio");
  expect(radios.map((el) => [el.props.value, el.props.checked])).toEqual([
    ["codex", true],
    ["claude", false],
  ]);
  expect(textOf(step)).toContain("found");
  expect(textOf(step)).toContain("not found");
  expect(textOf(step)).toContain("added when you continue");
});

test("a chosen agent that is missing shows how to install it, and the switch cannot turn sessions off", () => {
  const install = [{ text: "Install Claude Code.", command: "curl -fsSL https://claude.ai/install.sh | bash" }];
  const step = AgentsStep({ view: agents({ agentId: "claude", install, savedEnabled: true, enable: true }), onEnable: noop, onChoose: noop });
  expect(byTag(step, "code").map(textOf)).toContain("curl -fsSL https://claude.ai/install.sh | bash");
  const toggle = byTag(step, "input").find((el) => el.props.type === "checkbox");
  expect(toggle?.props.checked).toBe(true);
  expect(toggle?.props.disabled).toBe(true);
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
  const text = textOf(DoneStep({ summary: { rootsAdded: ["/w/acme"], tracked: 2, agentSessions: true, defaultAgent: "Codex", remaining: ["GitHub CLI"] } }));
  expect(text).toContain("/w/acme");
  expect(text).toContain("2 projects are tracked");
  expect(text).toContain("Codex as the default agent");
  expect(text).toContain("GitHub CLI");
});
