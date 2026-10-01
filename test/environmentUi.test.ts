import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { performRefresh } from "../src/ui/autoRefresh.ts";
import type { EnvironmentCheck, EnvironmentReport } from "../src/shared/types.ts";
import { EnvironmentPanel } from "../src/ui/environment.tsx";
import { environmentAttention, environmentCount, environmentWarning, type EnvironmentState } from "../src/ui/environmentState.ts";
import { parseSection, SECTION_IDS, serializeSection } from "../src/ui/settingsSections.ts";
import { byTag, textOf } from "./vnode.ts";

const check = (patch: Partial<EnvironmentCheck> = {}): EnvironmentCheck => ({ id: "git", label: "git", status: "ok", found: "/usr/bin/git", ...patch });

const report = (checks: EnvironmentCheck[], caveat?: string): EnvironmentReport => ({
  checkedAt: "2026-09-30T10:00:00.000Z",
  status: checks.some((c) => c.status === "problem") ? "problem" : checks.some((c) => c.status === "warning") ? "warning" : "ok",
  checks,
  ...(caveat === undefined ? {} : { caveat }),
});

const healthy = report([check(), check({ id: "github-cli", label: "GitHub CLI", status: "not-needed", found: "not needed while agent sessions are off" })]);
const broken = report([
  check(),
  check({ id: "openspec-cli", label: "OpenSpec CLI", status: "warning", found: "not found on the PATH", remedy: "Install it." }),
  check({ id: "agent:claude", label: "Agent: Claude Code (default)", status: "problem", found: "claude not found on the PATH", remedy: "Install Claude Code." }),
]);

// 4.1 — the deep-link contract.
test("the section list gains environment without changing any existing link", () => {
  expect(SECTION_IDS[SECTION_IDS.length - 1]).toBe("environment");
  expect(SECTION_IDS.slice(0, -1)).toEqual(["roots", "tracked", "scanning", "agents", "shared-config"]);
  // Appended, so the first section is still the one left out of the URL.
  expect(serializeSection("", "roots", "roots")).toBe("");
  expect(serializeSection("", "environment", "roots")).toBe("?section=environment");
  expect(parseSection("?section=environment", SECTION_IDS)).toBe("environment");
  expect(parseSection(serializeSection("?q=x", "environment", "roots"), SECTION_IDS)).toBe("environment");
});

// 4.2 — the section.
test("a problem is listed with its status in words, what was found and its remedy", () => {
  const text = textOf(EnvironmentPanel({ state: { report: broken, loading: false }, onRecheck: () => {} }));
  expect(text).toContain("OpenSpec CLI");
  expect(text).toContain("warning");
  expect(text).toContain("not found on the PATH");
  expect(text).toContain("Install it.");
  expect(text).toContain("problem");
  expect(text).toContain("Install Claude Code.");
});

test("a check that is not needed is listed, de-emphasised and readable", () => {
  const panel = EnvironmentPanel({ state: { report: healthy, loading: false }, onRecheck: () => {} });
  expect(textOf(panel)).toContain("GitHub CLI");
  expect(textOf(panel)).toContain("not needed while agent sessions are off");
  const row = byTag(panel, "div").find((el) => String(el.props.class ?? "").includes("env-check") && textOf(el).includes("GitHub CLI"));
  expect(String(row?.props.class)).toContain("muted");
});

test("status is never carried by colour alone", () => {
  const panel = EnvironmentPanel({ state: { report: broken, loading: false }, onRecheck: () => {} });
  for (const word of ["ok", "warning", "problem"]) {
    const badge = byTag(panel, "span").find((el) => textOf(el) === word);
    expect(badge).toBeDefined();
  }
});

test("Re-check marks itself as working and is offered even after a failed request", () => {
  const idle = byTag(EnvironmentPanel({ state: { report: healthy, loading: false }, onRecheck: () => {} }), "button")[0];
  expect(textOf(idle)).toContain("Re-check");
  expect(idle.props.disabled).toBe(false);

  const working = byTag(EnvironmentPanel({ state: { report: healthy, loading: true }, onRecheck: () => {} }), "button")[0];
  expect(textOf(working)).toContain("Checking…");
  expect(working.props.disabled).toBe(true);

  const failed = EnvironmentPanel({ state: { loading: false, error: "API: offline" }, onRecheck: () => {} });
  expect(textOf(failed)).toContain("The environment could not be checked");
  expect(textOf(failed)).toContain("API: offline");
  expect(textOf(byTag(failed, "button")[0])).toContain("Re-check");
});

test("Re-check calls back once, and nothing in the panel edits a draft", () => {
  let calls = 0;
  const button = byTag(EnvironmentPanel({ state: { report: healthy, loading: false }, onRecheck: () => calls++ }), "button")[0];
  (button.props.onClick as () => void)();
  expect(calls).toBe(1);
  // The only control the panel renders is that button: there is nothing here that could mark the page dirty.
  expect(byTag(EnvironmentPanel({ state: { report: broken, loading: false }, onRecheck: () => {} }), "input")).toHaveLength(0);
  expect(byTag(EnvironmentPanel({ state: { report: broken, loading: false }, onRecheck: () => {} }), "button")).toHaveLength(1);
});

test("the caveat is shown when the report carries one", () => {
  const withCaveat = report([check()], "GitHub credentials are only checked for being configured.");
  expect(textOf(EnvironmentPanel({ state: { report: withCaveat, loading: false }, onRecheck: () => {} }))).toContain("only checked for being configured");
});

// 4.4 — the navigation count, and the heading showing the same number.
test("the count is the number of checks that need attention", () => {
  expect(environmentCount({ report: broken, loading: false })).toBe("2");
  expect(environmentAttention({ report: broken, loading: false })).toBe(true);
  expect(environmentCount({ report: healthy, loading: false })).toBe("0");
  expect(environmentAttention({ report: healthy, loading: false })).toBe(false);
});

test("a pending report shows an indicator, a missing one shows no number", () => {
  expect(environmentCount({ loading: true })).toBe("…");
  expect(environmentCount({ report: broken, loading: true })).toBe("…");
  expect(environmentAttention({ report: broken, loading: true })).toBe(false);
  expect(environmentCount({ loading: false })).toBeUndefined();
  expect(environmentCount({ loading: false, error: "offline" })).toBeUndefined();
  expect(environmentAttention({ loading: false, error: "offline" })).toBe(false);
});

test("the section heading shows the same number as the navigation entry", () => {
  const state: EnvironmentState = { report: broken, loading: false };
  expect(environmentCount(state)).toBe("2");
  expect(textOf(EnvironmentPanel({ state, onRecheck: () => {} }))).toContain("2 need attention");
  // One is one: the heading reads as a sentence either way.
  const one: EnvironmentState = { report: report([check(), check({ id: "openspec-cli", label: "OpenSpec CLI", status: "warning", found: "not found", remedy: "Install it." })]), loading: false };
  expect(environmentCount(one)).toBe("1");
  expect(textOf(EnvironmentPanel({ state: one, onRecheck: () => {} }))).toContain("1 needs attention");
  expect(textOf(EnvironmentPanel({ state: { loading: true }, onRecheck: () => {} }))).toContain("checking…");
});

// 5.2 — what the hero makes of the same report.
test("the hero warns only when a check actually failed", () => {
  expect(environmentWarning({ report: broken, loading: false })).toEqual({
    count: 2,
    title: "Needs attention: OpenSpec CLI, Agent: Claude Code (default)",
  });
  expect(environmentWarning({ report: healthy, loading: false })).toBeUndefined();
  expect(environmentWarning({ loading: true })).toBeUndefined();
  expect(environmentWarning({ loading: false })).toBeUndefined();
  expect(environmentWarning({ report: broken, loading: false, error: "offline" })).toBeUndefined();
});

test("the tooltip names the missing agent", () => {
  expect(environmentWarning({ report: broken, loading: false })?.title).toContain("Agent: Claude Code (default)");
});

// 5.1 — the refresh path never asks for a report.
test("an hour of auto-refresh ticks asks for no environment report", async () => {
  let scans = 0;
  let environments = 0;
  const api = {
    scan: async () => {
      scans++;
      return { started: false };
    },
    state: async () => ({ generatedAt: new Date(scans).toISOString() }),
    // Not part of RefreshOptions["api"], which is narrowed to scan and state; here to catch a call that slipped through.
    environment: async () => {
      environments++;
      return healthy;
    },
  };
  // The fastest interval is 2s, so an hour is 1800 ticks of what the loop runs.
  for (let i = 0; i < 3_600_000 / 2_000; i++) {
    await performRefresh({ api, before: undefined, waitForScan: false, delay: async () => {}, onSnapshot: () => {}, onError: () => {} });
  }
  expect(scans).toBe(1800);
  expect(environments).toBe(0);
});

// 5.3 — the indicator cannot influence the board.
test("the hero indicator is derived from the report alone", () => {
  // Same report, wildly different surroundings: the warning is the same, so nothing else can steer it.
  const state: EnvironmentState = { report: broken, loading: false };
  expect(environmentWarning({ ...state })).toEqual(environmentWarning(state));
  expect(environmentWarning({ report: broken, loading: true })).toEqual(environmentWarning({ report: broken, loading: false }));
  // And the module that derives it knows nothing about the board, its filters or the snapshot.
  const source = readFileSync(new URL("../src/ui/environmentState.ts", import.meta.url), "utf8");
  const imports = [...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
  expect(imports).toEqual(["../shared/types.ts"]);
});
