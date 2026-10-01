import { expect, test } from "bun:test";
import { defaultAgentSessions, defaultConfig } from "../src/server/config.ts";
import type { Config, DiscoverResult, RepoSnapshot } from "../src/shared/types.ts";
import { NewProjectButton } from "../src/ui/newProject.tsx";
import { NothingTracked, PendingTableRow, PendingTile, Row, Tile } from "../src/ui/overview.tsx";
import { overviewRows, untrackedEntries } from "../src/ui/overviewState.ts";
import { FoundSummary } from "../src/ui/settings.tsx";
import { DisableButton, type Tracking, UnmanagedSection, type UntrackedSectionProps } from "../src/ui/untracked.tsx";
import { byComponent, byTag, textOf } from "./vnode.ts";

/** Records what the view asks for instead of calling the server. */
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
    openLabels: (id) => calls.push(`openLabels ${id}`),
    closeLabels: () => calls.push("closeLabels"),
  };
  return { t, calls };
}

const config: Config = {
  ...defaultConfig(),
  scanRoots: ["/w"],
  agentSessions: { ...defaultAgentSessions(), enabled: true },
  repos: [{ id: "d", path: "/w/acme/demo-agent", name: "demo-agent", enabled: false }],
};
const found: DiscoverResult = {
  candidates: [{ id: "b", path: "/w/acme/beta-soc", name: "beta-soc", enabled: false, sameRemoteAs: [{ name: "pkg-tools", path: "/w/ops/pkg-tools", tracked: true }] }],
  integratable: [{ id: "c", path: "/w/acme/chat-groups", name: "chat-groups" }],
  errors: [],
};

function section(patch: Partial<UntrackedSectionProps> = {}) {
  const { t, calls } = tracking();
  const shown: string[] = [];
  const props: UntrackedSectionProps = {
    entries: untrackedEntries(config, found),
    discovery: { result: found, running: false },
    hasRoots: true,
    query: "",
    tracking: t,
    runningIntegration: () => undefined,
    showIntegration: (id) => shown.push(id),
    onRediscover: () => calls.push("rediscover"),
    ...patch,
  };
  return { view: UnmanagedSection(props), calls, shown };
}

const buttons = (node: ReturnType<typeof section>["view"]) => byTag(node, "button");
const button = (node: ReturnType<typeof section>["view"], text: string, nth = 0) => buttons(node).filter((b) => textOf(b) === text)[nth];
const click = (b: { props: Record<string, unknown> }) => (b.props.onClick as (e: unknown) => void)({ stopPropagation: () => {} });

test("one headed list of every unmanaged project, by name, each saying what it is", () => {
  const { view } = section();
  const text = textOf(view);
  expect(textOf(byTag(view, "h2")[0])).toBe("Unmanaged projects · 3");
  expect(byTag(view, "h3")).toEqual([]);
  expect(byTag(view, "ul")).toHaveLength(1);
  const entries = byTag(view, "li");
  expect(entries.map((li) => textOf(byTag(li, "span").find((s) => s.props.class === "untracked-name")))).toEqual(["beta-soc", "chat-groups", "demo-agent"]);
  const labels = byTag(view, "span").filter((s) => String(s.props.class).includes("untracked-kind"));
  expect(labels.map(textOf)).toEqual(["OpenSpec", "no OpenSpec", "disabled"]);
  expect(String(labels[1].props.title)).toContain("no branch and no undo");
  expect(text).toContain("/w/acme/chat-groups");
  expect(text).toContain("same remote as pkg-tools");
});

test("Enable, Ignore, Integrate and Forget go to the matching entry; only a disabled repository offers Forget, and no Ignore", () => {
  const { view, calls } = section();
  // beta-soc (OpenSpec), chat-groups (no OpenSpec), demo-agent (disabled)
  expect(buttons(view).map(textOf)).toEqual(["Rediscover", "Enable", "Ignore", "Integrate", "Ignore", "Enable", "Forget"]);
  click(button(view, "Enable", 0));
  click(button(view, "Ignore", 0));
  click(button(view, "Integrate"));
  click(button(view, "Ignore", 1));
  click(button(view, "Enable", 1));
  click(button(view, "Forget"));
  click(button(view, "Rediscover"));
  expect(calls).toEqual(["enable b", "ignore b", "integrate c", "ignore c", "enable d", "forget d", "rediscover"]);
  expect(String(button(view, "Ignore").props.title)).toContain("Settings");
  const forgetTitle = String(button(view, "Forget").props.title);
  expect(forgetTitle).toContain("labels and agent settings");
  expect(forgetTitle).toContain("offered again as a discovered repository");
});

test("an action in progress shows it and blocks the entry; a failure is shown on that entry only", () => {
  const { t } = tracking({ busy: { b: "enable" }, errors: { c: "the default agent was not found" } });
  const { view } = section({ tracking: t });
  const enabling = button(view, "Enabling…");
  expect(enabling.props.disabled).toBe(true);
  expect(button(view, "Ignore", 0).props.disabled).toBe(true);
  expect(button(view, "Enable").props.disabled).toBe(false); // demo-agent's
  const alerts = byTag(view, "span").filter((s) => s.props.role === "alert");
  expect(alerts.map(textOf)).toEqual(["the default agent was not found"]);
});

test("Integrate unavailable: the reason is stated once, the entry stays listed and the button is inactive", () => {
  const { view } = section({ integrateOff: "agent sessions are disabled" });
  expect(textOf(view)).toContain("Integrate is unavailable: agent sessions are disabled.");
  expect(textOf(view).match(/unavailable/g)).toHaveLength(1);
  expect(button(view, "Integrate").props.disabled).toBe(true);
  expect(button(view, "Integrate").props.title).toBe("agent sessions are disabled");
  expect(byTag(view, "li")).toHaveLength(3);
});

test("a running integration is offered as Setting up…, which shows its session", () => {
  const { view, shown } = section({ runningIntegration: (path) => (path === "/w/acme/chat-groups" ? "int-1" : undefined) });
  expect(button(view, "Integrate")).toBeUndefined();
  click(button(view, "Setting up…"));
  expect(shown).toEqual(["int-1"]);
});

test("no workspace root: a link to the roots settings, no Rediscover", () => {
  const { view } = section({ hasRoots: false, entries: untrackedEntries(config, undefined), discovery: { running: false } });
  expect(buttons(view).map(textOf)).toEqual(["Enable", "Forget"]);
  const link = byTag(view, "a")[0];
  expect(String(link.props.href)).toContain("section=roots");
  expect(textOf(view)).toContain("No workspace root yet");
});

test("discovery running, a root error and a search without matches are all said", () => {
  const errors = [{ root: "/w/gone", message: "does not exist" }];
  const running = section({ discovery: { result: { ...found, errors }, running: true } }).view;
  expect(textOf(running)).toContain("discovering…");
  expect(button(running, "Discovering…").props.disabled).toBe(true);
  expect(textOf(running)).toContain("/w/gone: does not exist");
  expect(byTag(running, "a").some((a) => String(a.props.href).includes("section=roots"))).toBe(true);

  const none = section({ entries: [], query: "zzz" }).view;
  expect(textOf(none)).toContain("No unmanaged project matches “zzz”.");
  expect(textOf(section({ entries: [] }).view)).toContain("Every repository under the workspace roots is managed.");
});

test("Disable on a row and a tile disables without opening the repository", () => {
  const repo: RepoSnapshot = { id: "a", name: "alpha-infra", path: "/w/alpha-infra", ok: true, scannedAt: "2026-10-01T00:00:00Z", isGit: true, worktrees: [], changes: [] };
  const [row] = overviewRows({ generatedAt: "2026-10-01T00:00:00Z", repos: [repo] });
  const { t, calls } = tracking();
  for (const node of [Row({ row, stages: [], now: 0, tracking: t }), Tile({ row, stages: [], now: 0, tracking: t })]) {
    const disable = byTag(node, "button").filter((b) => b.props["aria-label"] === "Disable alpha-infra");
    expect(disable).toHaveLength(1);
    const btn = disable[0];
    let stopped = false;
    (btn.props.onClick as (e: unknown) => void)({ stopPropagation: () => (stopped = true) });
    expect(stopped).toBe(true);
  }
  expect(calls).toEqual(["disable a", "disable a"]);

  const busy = byTag(DisableButton({ id: "a", name: "alpha-infra", tracking: tracking({ busy: { a: "disable" }, errors: {} }).t }), "button")[0];
  expect(textOf(busy)).toBe("Disabling…");
  expect(busy.props.disabled).toBe(true);
  const failed = DisableButton({ id: "a", name: "alpha-infra", tracking: tracking({ errors: { a: "repository not found" } }).t });
  expect(textOf(failed)).toContain("repository not found");
});

test("a just-enabled repository shows as Scanning… in both layouts; nothing tracked offers New project in place", () => {
  const pending = { id: "p", name: "beta-soc", path: "/w/acme/beta-soc", hint: "acme" };
  const row = PendingTableRow({ row: pending, columns: 9 });
  expect(textOf(row)).toContain("Scanning…");
  expect(textOf(row)).toContain("acme/");
  expect(byTag(row, "td")[0].props.colSpan).toBe(9);
  expect(textOf(PendingTile({ row: pending }))).toContain("Scanning…");

  const empty = NothingTracked({ config });
  expect(textOf(empty)).toContain("No repositories tracked yet");
  expect(byComponent(empty, NewProjectButton)).toHaveLength(1);
  // project-creation: New project stands next to the link to Settings.
  const settings = byTag(empty, "a").find((a) => textOf(a) === "Open Settings");
  expect(String(settings?.props.href)).toContain("/settings?section=roots");
});

test("Settings counts what discovery found and points to Projects instead of listing it", () => {
  const both = FoundSummary({ candidates: 2, integratable: 1 });
  expect(textOf(both)).toContain("Found 2 using OpenSpec and 1 without OpenSpec, not tracked yet");
  expect(byTag(both, "a")[0].props.href).toBe("/");
  expect(textOf(FoundSummary({ candidates: 0, integratable: 0 }))).toBe("Every repository under these roots is tracked.");
});
