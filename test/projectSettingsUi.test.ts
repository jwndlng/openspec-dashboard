// A managed project's own settings on the overview (project-overview: "Each managed project carries its own settings").
import { expect, test } from "bun:test";
import { defaultAgentSessions, defaultConfig } from "../src/server/config.ts";
import type { Config, RepoSnapshot } from "../src/shared/types.ts";
import { REPO_HUES } from "../src/shared/hues.ts";
import { LabelColorPicker, labelTitle, RepoLabelsEditor } from "../src/ui/labels.tsx";
import { Modal } from "../src/ui/modal.tsx";
import { PendingTableRow, PendingTile, Row, Tile } from "../src/ui/overview.tsx";
import { overviewRows } from "../src/ui/overviewState.ts";
import { RenameField, RepoLabelsDialog, SESSIONS_OFF } from "../src/ui/projectSettings.tsx";
import type { Tracking } from "../src/ui/untracked.tsx";
import { byComponent, byTag, textOf } from "./vnode.ts";

function tracking(state: Partial<Pick<Tracking, "busy" | "errors" | "renaming" | "labelsOpen">> = {}) {
  const calls: string[] = [];
  const t: Tracking = {
    busy: state.busy ?? {},
    errors: state.errors ?? {},
    renaming: state.renaming,
    labelsOpen: state.labelsOpen,
    enable: (e) => calls.push(`enable ${e.id}`),
    disable: (id) => calls.push(`disable ${id}`),
    ignore: (e) => calls.push(`ignore ${e.id}`),
    integrate: (e) => calls.push(`integrate ${e.id}`),
    forget: (e) => calls.push(`forget ${e.id}`),
    startRename: (id) => calls.push(`startRename ${id}`),
    cancelRename: () => calls.push("cancelRename"),
    rename: (id, current, next) => calls.push(`rename ${id} ${current}->${next}`),
    setAgent: (id, patch) => calls.push(`agent ${id} ${JSON.stringify(patch)}`),
    setLabels: (id, patch) => calls.push(`labels ${id} ${JSON.stringify(patch)}`),
    setLabelColor: (id, label, hue) => calls.push(`labelColor ${id} ${label} ${hue}`),
    openLabels: (id) => calls.push(`openLabels ${id}`),
    closeLabels: () => calls.push("closeLabels"),
  };
  return { t, calls };
}

const snapshotRepo: RepoSnapshot = { id: "a", name: "alpha-infra", path: "/w/alpha-infra", ok: true, scannedAt: "2026-10-01T00:00:00Z", isGit: true, worktrees: [], changes: [] };
const [row] = overviewRows({ generatedAt: "2026-10-01T00:00:00Z", repos: [snapshotRepo] });
const myAgent = { id: "my-agent", name: "My agent", command: ["my-agent-cli", "{prompt}"], prompts: {} };

function configWith(patch: { sessions?: boolean; agents?: number; agent?: Config["repos"][number]["agent"] } = {}): Config {
  const sessions = defaultAgentSessions();
  return {
    ...defaultConfig(),
    agentSessions: { ...sessions, enabled: patch.sessions ?? true, agents: patch.agents === 2 ? [...sessions.agents, myAgent] : sessions.agents },
    repos: [{ id: "a", path: "/w/alpha-infra", name: "alpha-infra", enabled: true, ...(patch.agent ? { agent: patch.agent } : {}) }],
  };
}

const layouts = (config: Config, t: Tracking) => [Row({ row, stages: [], now: 0, tracking: t, config }), Tile({ row, stages: [], now: 0, tracking: t, config })];
const switchOf = (node: unknown) => byTag(node as never, "button").find((b) => b.props.role === "switch");
const click = (el: { props: Record<string, unknown> }) => {
  let stopped = false;
  (el.props.onClick as (e: unknown) => void)({ stopPropagation: () => (stopped = true), preventDefault: () => {} });
  return stopped;
};

test("every project offers an agent-session switch in both layouts, Enabled by default, saved without opening the board", () => {
  const { t, calls } = tracking();
  for (const node of layouts(configWith(), t)) {
    const toggle = switchOf(node);
    expect(toggle?.props["aria-checked"]).toBe(true);
    expect(toggle?.props["aria-label"]).toBe("Agent sessions for alpha-infra");
    expect(textOf(toggle)).toBe("Enabled");
    expect(click(toggle!)).toBe(true);
  }
  expect(calls).toEqual(['agent a {"enabled":false}', 'agent a {"enabled":false}']);

  const off = tracking();
  for (const node of layouts(configWith({ agent: { enabled: false } }), off.t)) {
    expect(textOf(switchOf(node))).toBe("Disabled");
    click(switchOf(node)!);
  }
  expect(off.calls).toEqual(['agent a {"enabled":true}', 'agent a {"enabled":true}']);
});

test("with agent sessions off globally the switch shows the project's setting as a link to the Agent sessions settings", () => {
  const { t, calls } = tracking();
  for (const node of layouts(configWith({ sessions: false, agent: { enabled: false } }), t)) {
    expect(switchOf(node)).toBeUndefined();
    const link = byTag(node, "a").find((a) => String(a.props.class).includes("agent-toggle"));
    expect(String(link?.props.href)).toBe("/settings?section=agents");
    expect(textOf(link)).toBe("Disabled");
    expect(link?.props.title).toBe(SESSIONS_OFF);
  }
  expect(calls).toEqual([]);
});

test("the agent picker appears only with two agents and sessions on for the project; default agent clears the choice", () => {
  const picker = (config: Config) => byTag(Row({ row, stages: [], now: 0, tracking: tracking().t, config }), "select");
  expect(picker(configWith())).toHaveLength(0);
  expect(picker(configWith({ agents: 2, agent: { enabled: false } }))).toHaveLength(0);
  expect(picker(configWith({ agents: 2, sessions: false }))).toHaveLength(0);

  const { t, calls } = tracking();
  for (const node of layouts(configWith({ agents: 2, agent: { enabled: true, agentId: "my-agent" } }), t)) {
    const [select] = byTag(node, "select");
    expect(select.props.value).toBe("my-agent");
    expect(byTag(select, "option").map(textOf)).toEqual(["default agent", "Claude Code", "My agent"]);
    (select.props.onChange as (e: unknown) => void)({ currentTarget: { value: "" } });
  }
  expect(calls).toEqual(['agent a {"agentId":null}', 'agent a {"agentId":null}']);
});

test("Rename turns the name into a field: Enter and blur save, Escape cancels, each once", () => {
  const { t, calls } = tracking();
  for (const node of layouts(configWith(), t)) {
    const pencil = byTag(node, "button").find((b) => b.props["aria-label"] === "Rename alpha-infra");
    expect(click(pencil!)).toBe(true);
  }
  expect(calls).toEqual(["startRename a", "startRename a"]);

  const editing = tracking({ renaming: "a" });
  for (const node of layouts(configWith(), editing.t)) {
    expect(byTag(node, "input").filter((i) => i.props["aria-label"] === "New name for alpha-infra")).toHaveLength(1);
    expect(byTag(node, "a").some((a) => String(a.props.class) === "repo-link")).toBe(false);
  }

  const field = byTag(RenameField({ id: "a", name: "alpha-infra", tracking: editing.t }), "input")[0];
  expect(field.props.defaultValue).toBe("alpha-infra");
  const key = (k: string, el: { value: string; dataset: Record<string, string> }) =>
    (field.props.onKeyDown as (e: unknown) => void)({ key: k, currentTarget: el, stopPropagation: () => {}, preventDefault: () => {} });
  const blur = (el: { value: string; dataset: Record<string, string> }) => (field.props.onBlur as (e: unknown) => void)({ currentTarget: el });
  editing.calls.length = 0;

  const saved = { value: "Beta SOC", dataset: {} };
  key("Enter", saved);
  blur(saved);
  const cancelled = { value: "x", dataset: {} };
  key("Escape", cancelled);
  blur(cancelled);
  const left = { value: "Gamma", dataset: {} };
  blur(left);
  // A blank name is refused by `rename` and the field stays open, so a later Enter still saves.
  const blank = { value: " ", dataset: {} };
  key("Enter", blank);
  blank.value = "Delta";
  key("Enter", blank);
  expect(editing.calls).toEqual(["rename a alpha-infra->Beta SOC", "cancelRename", "rename a alpha-infra->Gamma", "rename a alpha-infra-> ", "rename a alpha-infra->Delta"]);
});

test("Labels opens the project's dialog, whose edits are saved at once", () => {
  const { t, calls } = tracking();
  for (const node of layouts(configWith(), t)) {
    const button = byTag(node, "button").find((b) => b.props["aria-label"] === "Labels of alpha-infra");
    expect(click(button!)).toBe(true);
  }
  expect(calls).toEqual(["openLabels a", "openLabels a"]);

  const config = configWith();
  const open = tracking({ labelsOpen: "a", busy: { a: "labels" }, errors: { a: "invalid config" } });
  const dialog = RepoLabelsDialog({ repo: config.repos[0], repos: config.repos, detected: [{ label: "go", marker: "go.mod" }], tracking: open.t });
  const [modal] = byComponent(dialog, Modal);
  (modal.props.onClose as () => void)();
  const [editor] = byComponent(modal.props.children, RepoLabelsEditor);
  expect(editor.props.detected).toEqual([{ label: "go", marker: "go.mod" }]);
  (editor.props.onChange as (patch: unknown) => void)({ labels: ["client"] });
  expect(open.calls).toEqual(["closeLabels", 'labels a {"labels":["client"]}']);
  expect(textOf(modal.props.children)).toContain("Saving…");
  expect(textOf(modal.props.children)).toContain("invalid config");
  expect(labelTitle({ label: "client", kind: "custom" })).not.toContain("Settings");
});

test("the labels dialog hands the shared label colours to the editor and saves a colour choice through tracking", () => {
  const config = configWith();
  const open = tracking({ labelsOpen: "a", errors: { a: "hue must be null or a whole number from 0 to 359" } });
  const dialog = RepoLabelsDialog({ repo: config.repos[0], repos: config.repos, detected: [{ label: "go", marker: "go.mod" }], labelColors: { client: 290 }, tracking: open.t });
  const [modal] = byComponent(dialog, Modal);
  const [editor] = byComponent(modal.props.children, RepoLabelsEditor);
  expect(editor.props.colors).toEqual({ client: 290 });
  const onColor = editor.props.onColor as (label: string, hue: number | null) => void;
  onColor("client", 27);
  onColor("go", 190);
  onColor("client", null);
  expect(open.calls).toEqual(["labelColor a client 27", "labelColor a go 190", "labelColor a client null"]);
  // A failed save keeps the colour and shows the reason in the dialog.
  expect(textOf(modal.props.children)).toContain("hue must be null");
});

test("the colour picker offers Auto and every assignable hue, marks the current choice and reports the one chosen", () => {
  const chosen: (number | null)[] = [];
  const picker = LabelColorPicker({ label: "Client", colors: { client: 295 }, onChoose: (hue) => chosen.push(hue) });
  expect(picker.props["aria-label"]).toBe("Colour of Client");
  const options = byTag(picker, "button");
  expect(options).toHaveLength(REPO_HUES.length + 1);
  expect(textOf(options[0])).toContain("Auto");
  // 295 is stored, 290 is the nearest hue the palette has: that one is pressed, and nothing else.
  expect(options.filter((o) => o.props["aria-pressed"]).map((o) => o.props["aria-label"])).toEqual([`Colour ${REPO_HUES.indexOf(290) + 1} of ${REPO_HUES.length}`]);
  (options[0].props.onClick as () => void)();
  (options[1].props.onClick as () => void)();
  expect(chosen).toEqual([null, REPO_HUES[0]]);
  const auto = LabelColorPicker({ label: "go", colors: undefined, onChoose: () => {} });
  expect(byTag(auto, "button")[0].props["aria-pressed"]).toBe(true);
});

test("a project still being scanned offers none of its settings", () => {
  const pending = { id: "p", name: "beta-soc", path: "/w/acme/beta-soc" };
  for (const node of [PendingTableRow({ row: pending, columns: 8 }), PendingTile({ row: pending })]) {
    expect(byTag(node, "button")).toHaveLength(0);
    expect(byTag(node, "select")).toHaveLength(0);
    expect(byTag(node, "input")).toHaveLength(0);
  }
});

test("without a config entry yet, a row shows only what it showed before", () => {
  const node = Row({ row, stages: [], now: 0, tracking: tracking().t });
  expect(switchOf(node)).toBeUndefined();
  const labels = byTag(node, "button").map((b) => String(b.props["aria-label"]));
  expect(labels).toContain("Disable alpha-infra");
  expect(labels.some((l) => l.startsWith("Rename") || l.startsWith("Labels"))).toBe(false);
});
