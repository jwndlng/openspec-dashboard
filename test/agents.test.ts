import { expect, test } from "bun:test";
import { defaultAgentSessions, defaultConfig, newRepoConfig, validateConfig } from "../src/server/config.ts";
import { agentEnv, agentFor, launchCommand, openingPrompt } from "../src/server/sessions/agents.ts";
import { Scrollback, sessionBranch, worktreeName } from "../src/server/sessions/manager.ts";
import { CLAUDE_PROFILE, DEFAULT_SHORTCUTS, FORMER_PROMPTS } from "../src/shared/agentDefaults.ts";
import { availableActions, integrateUnavailable, type AgentAvailability, type ChangeSession, type Session } from "../src/shared/types.ts";
import { agentForRepo, cardSessionControls, NEEDS_YOU_AFTER_MS, parseArgLines, sessionBadge, sessionForChange, sessionsEnabledFor, silenceDuration, slugId, startersFor } from "../src/ui/sessionState.ts";
import { fakeProfile } from "./sessionHelpers.ts";

const base = defaultConfig();
const withAgents = (agents: unknown, defaultAgent = "claude") => ({ ...base, agentSessions: { ...base.agentSessions, enabled: true, agents, defaultAgent } });

test("defaults: disabled, Claude Code preconfigured on its own login", () => {
  const d = defaultAgentSessions();
  expect(d.enabled).toBe(false);
  expect(d.agents.map((a) => a.id)).toEqual(["claude"]);
  expect(d.agents[0].command).toEqual(["claude", "{prompt}"]);
  expect(d.agents[0].unsetEnv).toContain("ANTHROPIC_API_KEY");
});

test("the shipped shortcuts: the four answers sent today, each sending exactly what its control reads", () => {
  expect(DEFAULT_SHORTCUTS.map((s) => s.title)).toEqual(["Yes, go ahead", "Yes, create a PR", "Resolve PR conflicts", "No, stop here"]);
  for (const shortcut of DEFAULT_SHORTCUTS) expect(shortcut.prompt).toBe(shortcut.title);
  expect(new Set(DEFAULT_SHORTCUTS.map((s) => s.id)).size).toBe(DEFAULT_SHORTCUTS.length);
});

test("the default configuration carries the shipped shortcuts, freshly cloned each time", () => {
  const first = defaultAgentSessions();
  expect(first.shortcuts).toEqual([...DEFAULT_SHORTCUTS]);
  first.shortcuts[0].title = "edited";
  first.shortcuts.pop();
  const second = defaultAgentSessions();
  expect(second.shortcuts).toEqual([...DEFAULT_SHORTCUTS]);
  expect(DEFAULT_SHORTCUTS[0].title).toBe("Yes, go ahead");
});

test("the preconfigured Archive prompt syncs the specs first without asking, as one line", () => {
  const archive = defaultAgentSessions().agents[0].prompts.archive ?? "";
  expect(archive.startsWith("/opsx:archive {change}")).toBe(true);
  expect(archive).toMatch(/sync the delta specs/);
  expect(archive).toMatch(/without asking/);
  expect(archive).toMatch(/already in sync, archive right away/);
  // The user's confirmation during archiving is the validation, so it is what ticks the awaiting tasks off.
  expect(archive).toMatch(/tick off the tasks left for me to validate once I have confirmed them/);
  expect(archive).not.toContain("\n");
  expect(FORMER_PROMPTS.archive).toContain("/opsx:archive {change}");
  expect(FORMER_PROMPTS.archive).not.toContain(archive);
  const prompt = openingPrompt(CLAUDE_PROFILE, "archive", "cache-api-calls") ?? "";
  expect(prompt.startsWith("/opsx:archive cache-api-calls — sync")).toBe(true);
  expect(launchCommand(CLAUDE_PROFILE, prompt)).toEqual({ argv: ["claude", prompt] }); // one argument
  expect(validateConfig(withAgents([CLAUDE_PROFILE])).agentSessions.agents[0].prompts.archive).toBe(archive); // passes the prompt rules
});

test("the preconfigured prompts carry what `- [~]` means, each on one line", () => {
  const prompts = defaultAgentSessions().agents[0].prompts;
  expect(Object.keys(prompts)).toEqual(["draft", "implement", "validate", "archive", "integrate"]);
  for (const [key, text] of Object.entries(prompts)) {
    expect([key, text.includes("\n")]).toEqual([key, false]); // a prompt may be typed into a terminal
    // Every starter names its change; Integrate is the one prompt that must not, because it runs in a folder, not a change.
    expect([key, text.includes("{change}")]).toEqual([key, key !== "integrate"]);
  }
  // Implement: do the work, then leave what only the user can judge for the user.
  expect(prompts.implement).toMatch(/^\/opsx:apply \{change\}/);
  expect(prompts.implement).toMatch(/only be verified by me/);
  expect(prompts.implement).toMatch(/`- \[~\]` instead of `- \[x\]`/);
  // Validate: one task at a time, tick off only what the user confirms.
  expect(prompts.validate).toMatch(/`- \[~\]` tasks one at a time/);
  expect(prompts.validate).toMatch(/tell me exactly what to check/);
  expect(prompts.validate).toMatch(/tick off only the ones I confirm/);
  // Both new texts survive the prompt rules, and reach the agent as one argument.
  const config = validateConfig(withAgents([CLAUDE_PROFILE])).agentSessions.agents[0].prompts;
  expect(config).toEqual(prompts);
  const opened = openingPrompt(CLAUDE_PROFILE, "validate", "cache-api-calls") ?? "";
  expect(opened).toContain("cache-api-calls");
  expect(opened).not.toContain("{change}");
  expect(launchCommand(CLAUDE_PROFILE, opened)).toEqual({ argv: ["claude", opened] });
});

test("configs from the transcript-based version load: their keys are dropped, defaults fill in", () => {
  const old = { ...base, agentSessions: { enabled: true, maxRunning: 2, idleMinutes: 30, claudePath: "claude", passApiKeyEnv: false, commands: { draft: "/opsx:ff {change}" } }, repos: [{ ...newRepoConfig("/w/demo-ops", true), agent: { enabled: true, allowedTools: ["Bash(x)"] } }] };
  const cfg = validateConfig(old);
  // No `shortcuts` key at all: such a config carries the shipped ones, so nobody's console loses its buttons.
  expect(cfg.agentSessions).toEqual({ enabled: true, agents: defaultAgentSessions().agents, defaultAgent: "claude", shortcuts: [...DEFAULT_SHORTCUTS] });
  expect(cfg.repos[0].agent).toEqual({ enabled: true });
  const { agentSessions: _drop, ...older } = base;
  expect(validateConfig(older).agentSessions.enabled).toBe(false);
});

test("profile validation", () => {
  const ok = fakeProfile({ id: "other" });
  expect(validateConfig(withAgents([ok], "other")).agentSessions.agents[0].name).toBe("Fake Agent");
  expect(() => validateConfig(withAgents([ok]))).toThrow(/defaultAgent/); // default must exist
  expect(() => validateConfig(withAgents([ok, ok], "other"))).toThrow(/unique/);
  expect(() => validateConfig(withAgents([], "other"))).toThrow();
  expect(() => validateConfig(withAgents([{ ...ok, command: [] }], "other"))).toThrow(/executable/);
  expect(() => validateConfig(withAgents([{ ...ok, command: ["{prompt}"] }], "other"))).toThrow(/placeholder/);
  expect(() => validateConfig(withAgents([{ ...ok, command: ["x", "{change}"] }], "other"))).toThrow(/only \{prompt\}/);
  expect(() => validateConfig(withAgents([{ ...ok, command: ["claude", "--dangerously-skip-permissions", "{prompt}"] }], "other"))).toThrow(/bypass/);
  expect(() => validateConfig(withAgents([{ ...ok, resumeCommand: ["claude", "--permission-mode", "bypassPermissions"] }], "other"))).toThrow(/bypass/);
  expect(() => validateConfig(withAgents([{ ...ok, prompts: { implement: "do it" } }], "other"))).toThrow(/must contain \{change\}/);
  expect(() => validateConfig(withAgents([{ ...ok, prompts: { implement: "{change} {branch}" } }], "other"))).toThrow(/only \{change\}/);
  // Integrate names no change: the folder is the working directory, so no placeholder of any kind is substituted into it.
  expect(validateConfig(withAgents([{ ...ok, prompts: { integrate: "set this project up" } }], "other")).agentSessions.agents[0].prompts.integrate).toBe("set this project up");
  expect(() => validateConfig(withAgents([{ ...ok, prompts: { integrate: "set up {change}" } }], "other"))).toThrow(/no placeholder/);
  expect(() => validateConfig(withAgents([{ ...ok, prompts: { integrate: "set up {prompt}" } }], "other"))).toThrow(/no placeholder/);
  expect(() => validateConfig(withAgents([{ ...ok, prompts: { integrate: "set up --dangerously-skip-permissions" } }], "other"))).toThrow(/bypass/);
  expect(validateConfig(withAgents([{ ...ok, prompts: {} }], "other")).agentSessions.agents[0].prompts.integrate).toBeUndefined();
  expect(() => validateConfig(withAgents([{ ...ok, id: "Bad Id" }], "other"))).toThrow(/lower-case/);
  expect(() => validateConfig({ ...withAgents([ok], "other"), repos: [{ ...newRepoConfig("/w/x", true), agent: { enabled: true, agentId: "nope" } }] })).toThrow(/unknown agent/);
});

test("launch: the prompt is one whole argument, or typed when the command has no placeholder", () => {
  const nasty = '"; rm -rf ~ # $(x)';
  expect(launchCommand(fakeProfile({ command: ["agent", "-i", "{prompt}"] }), nasty)).toEqual({ argv: ["agent", "-i", nasty] });
  expect(launchCommand(fakeProfile({ command: ["agent", "--prompt={prompt}"] }), "hi")).toEqual({ argv: ["agent", "--prompt=hi"] });
  expect(launchCommand(fakeProfile({ command: ["agent"] }), "hi")).toEqual({ argv: ["agent"], typed: "hi" });
  expect(openingPrompt(fakeProfile(), "implement", "cache-api-calls")).toBe("implement cache-api-calls");
  expect(openingPrompt(fakeProfile({ prompts: { implement: "x {change}" } }), "archive", "c")).toBeUndefined();
  expect(() => openingPrompt(fakeProfile(), "implement", "x; rm -rf ~")).toThrow(/invalid change name/);
});

test("environment: listed variables are removed, a colour terminal is announced", () => {
  const env = agentEnv(fakeProfile(), { PATH: "/bin", ANTHROPIC_API_KEY: "k", OTHER: "1", GONE: undefined });
  expect(env).toEqual({ PATH: "/bin", OTHER: "1", TERM: "xterm-256color", COLORTERM: "truecolor" });
  expect(agentEnv(fakeProfile({ unsetEnv: undefined }), { ANTHROPIC_API_KEY: "k" }).ANTHROPIC_API_KEY).toBe("k");
});

test("agent per repository, falling back to the default", () => {
  const repo = newRepoConfig("/w/demo-ops", true);
  const cfg = { ...base, repos: [{ ...repo, agent: { enabled: true, agentId: "b" } }], agentSessions: { ...base.agentSessions, enabled: true, agents: [fakeProfile({ id: "a" }), fakeProfile({ id: "b", name: "B" })], defaultAgent: "a" } };
  expect(agentFor(cfg, cfg.repos[0])?.id).toBe("b");
  expect(agentFor(cfg, repo)?.id).toBe("a");
  expect(agentForRepo(cfg, repo.id)?.name).toBe("B");
});

test("starters: stage decides, narrowed to the prompts the agent has", () => {
  const a = (...s: ("done" | "ready" | "blocked")[]) => s.map((status, i) => ({ id: `a${i}`, status }));
  expect(availableActions({ artifacts: a("done", "ready"), stage: "drafts" })).toEqual(["draft"]);
  expect(availableActions({ artifacts: a("done", "done"), stage: "ready" })).toEqual(["implement"]);
  expect(availableActions({ artifacts: a("done", "done"), stage: "done" })).toEqual(["archive"]);
  expect(availableActions({ artifacts: a("done", "done"), stage: "done", subState: "complete" })).toEqual(["archive"]);
  expect(availableActions({ artifacts: a("done", "done"), stage: "implementing" })).toEqual(["implement"]);
  expect(availableActions({ artifacts: a("done", "done"), stage: "archived", archived: "2026-06-18" })).toEqual([]);
  const repo = newRepoConfig("/w/demo-ops", true);
  const cfg = { ...base, repos: [repo], agentSessions: { ...base.agentSessions, enabled: true, agents: [fakeProfile({ prompts: { implement: "x {change}" } })], defaultAgent: "fake" } };
  expect(startersFor(cfg, { repoId: repo.id, artifacts: a("done", "done"), stage: "ready" })).toEqual(["implement"]);
  expect(startersFor(cfg, { repoId: repo.id, artifacts: a("done", "done"), stage: "done" })).toEqual([]); // no archive prompt
  const archiving = { ...cfg, agentSessions: { ...cfg.agentSessions, agents: [fakeProfile({ prompts: { archive: "a {change}" } })] } };
  for (const stage of ["done"] as const) expect(startersFor(archiving, { repoId: repo.id, artifacts: a("done", "done"), stage })).toEqual(["archive"]);
  expect(sessionsEnabledFor(cfg, repo.id)).toBe(true);
  expect(sessionsEnabledFor({ ...cfg, repos: [{ ...repo, agent: { enabled: false } }] }, repo.id)).toBe(false);
  expect(sessionsEnabledFor({ ...cfg, agentSessions: { ...cfg.agentSessions, enabled: false } }, repo.id)).toBe(false);
});

const session = (patch: Partial<ChangeSession>): ChangeSession => ({ id: "s", repoId: "r", change: "c", action: "implement", agentId: "fake", agentName: "Fake Agent", state: "running", worktreePath: "/w/wt", branch: "feat/c", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", resumable: true, ...patch });

test("a card shows the running session's badge instead of a starter, and a failed one's badge beside it", () => {
  const repo = newRepoConfig("/w/demo-ops", true);
  const cfg = { ...base, repos: [repo], agentSessions: { ...base.agentSessions, enabled: true, agents: [fakeProfile()], defaultAgent: "fake" } };
  const card = { repoId: repo.id, name: "c", artifacts: [{ id: "a0", status: "done" as const }], stage: "ready" as const };
  const mine = (patch: Partial<ChangeSession>) => session({ repoId: repo.id, change: "c", ...patch });

  // No session: the stage's starter, and nothing to show a badge for.
  expect(cardSessionControls(cfg, [], card)).toEqual({ shown: [], starters: ["implement"] });

  // A running session stands in for the starter, whatever its terminal is doing — the badge's words differ, the rule
  // does not, so no button appears and vanishes as the terminal falls silent.
  const printing = cardSessionControls(cfg, [mine({ lastOutputAt: "2026-01-01T00:00:00Z" })], card);
  expect(printing.starters).toEqual([]);
  expect(printing.shown.map((s) => s.id)).toEqual(["s"]);
  const silent = cardSessionControls(cfg, [mine({ lastOutputAt: "2020-01-01T00:00:00Z" })], card);
  expect(silent.starters).toEqual([]);
  expect(sessionBadge(silent.shown[0]).label).toContain("may need you");

  // Failed or badly ended and nothing running: the badge is shown and the starter stays, so a retry is one click away.
  for (const patch of [{ state: "failed" as const, error: "no such file" }, { state: "exited" as const, exitCode: 3 }]) {
    const after = cardSessionControls(cfg, [mine(patch)], card);
    expect(after.starters).toEqual(["implement"]);
    expect(after.shown).toHaveLength(1);
  }
  // A clean exit is not worth a badge, and leaves the starter on its own.
  expect(cardSessionControls(cfg, [mine({ state: "exited", exitCode: 0 })], card)).toEqual({ shown: [], starters: ["implement"] });

  // An archive session running next to the change's own one still counts as running: no starter.
  expect(cardSessionControls(cfg, [mine({ id: "arch", action: "archive" })], { ...card, stage: "done" }).starters).toEqual([]);

  // Another change's session is none of this card's business.
  expect(cardSessionControls(cfg, [session({ repoId: repo.id, change: "other" })], card)).toEqual({ shown: [], starters: ["implement"] });

  // `subState` has to reach `availableActions` through here, or a change awaiting confirmation would never offer
  // Validate on its card. The stock fake agent has no validate prompt, so one that has is what shows the difference.
  const done = { ...card, stage: "done" as const, subState: "validate" as const };
  const validating = { ...cfg, agentSessions: { ...cfg.agentSessions, agents: [fakeProfile({ prompts: { validate: "v {change}", archive: "a {change}" } })] } };
  expect(cardSessionControls(validating, [], done).starters).toEqual(["validate", "archive"]);
  expect(cardSessionControls(validating, [], { ...done, subState: undefined }).starters).toEqual(["archive"]);
  // And a running session still takes the starters' place, Validate included.
  expect(cardSessionControls(validating, [mine({})], done).starters).toEqual([]);

  // Feature off, or the repository switched off: no badge and no starter, as before.
  for (const off of [{ ...cfg, agentSessions: { ...cfg.agentSessions, enabled: false } }, { ...cfg, repos: [{ ...repo, agent: { enabled: false } }] }]) {
    expect(cardSessionControls(off, [mine({})], card)).toEqual({ shown: [], starters: [] });
  }
});

test("badges are honest about what a terminal can tell", () => {
  const now = Date.parse("2026-01-01T01:00:00Z");
  // The two running states are told apart by their words; tone and motion only reinforce them.
  expect(sessionBadge(session({ lastOutputAt: "2026-01-01T00:59:50Z" }), now)).toMatchObject({ icon: "●", label: "working", tone: "info", live: true });
  expect(sessionBadge(session({ lastOutputAt: "2026-01-01T00:50:00Z" }), now)).toMatchObject({ icon: "◆", label: "may need you 10m", tone: "warning" });
  expect(sessionBadge(session({ state: "exited", exitCode: 0 }), now)).toMatchObject({ label: "ended", tone: "" });
  expect(sessionBadge(session({ state: "exited", exitCode: 3 }), now)).toMatchObject({ icon: "⚠", label: "ended (3)", tone: "danger" });
  expect(sessionBadge(session({ state: "failed", error: "no such file" }), now)).toMatchObject({ tone: "danger", title: "no such file" });
});

test("only a terminal that is producing output is shown with motion", () => {
  const now = Date.parse("2026-01-01T01:00:00Z");
  const live = (patch: Partial<ChangeSession>) => sessionBadge(session(patch), now).live === true;
  expect(live({ lastOutputAt: "2026-01-01T00:59:50Z" })).toBe(true);
  expect(live({})).toBe(true); // just started, nothing printed yet
  expect(live({ lastOutputAt: "2026-01-01T00:50:00Z" })).toBe(false); // silent: may need the user
  expect(live({ state: "exited", exitCode: 0 })).toBe(false);
  expect(live({ state: "exited", exitCode: 3 })).toBe(false);
  expect(live({ state: "failed" })).toBe(false);
});

test("a silent terminal says the session may need you within seconds, never that the agent waits", () => {
  const now = Date.parse("2026-01-01T01:00:00Z");
  const badge = (silentMs: number) => sessionBadge(session({ lastOutputAt: new Date(now - silentMs).toISOString() }), now);
  expect(NEEDS_YOU_AFTER_MS).toBeLessThanOrEqual(30_000);
  expect(badge(NEEDS_YOU_AFTER_MS - 1_000).label).toBe("working");
  expect(badge(NEEDS_YOU_AFTER_MS).label).toBe("working");
  expect(badge(NEEDS_YOU_AFTER_MS + 1_000).label).toBe(`may need you ${Math.floor((NEEDS_YOU_AFTER_MS + 1_000) / 1000)}s`);
  expect(badge(45_000).label).toBe("may need you 45s");
  expect(badge(3 * 60_000 + 20_000).label).toBe("may need you 3m");
  expect(badge(10 * 60_000).label).toBe("may need you 10m");
  // worded as a possibility: nothing claims the agent is waiting or working
  for (const b of [badge(0), badge(45_000)]) expect(`${b.label} ${b.title}`).not.toMatch(/\bis waiting\b|\bwaits\b|\bis working\b/);
  expect(badge(45_000).title).toContain("may be waiting");
  // a just-started session has printed nothing yet and is not announced as needing the user
  expect(sessionBadge(session({}), now).label).toBe("working");
});

test("the two running states differ in their words, not only in colour and motion", () => {
  const now = Date.parse("2026-01-01T01:00:00Z");
  const working = sessionBadge(session({ lastOutputAt: "2026-01-01T00:59:55Z" }), now);
  const silent = sessionBadge(session({ lastOutputAt: "2026-01-01T00:59:00Z" }), now);
  expect(working.label).not.toBe(silent.label);
  expect(working.label).not.toContain("may need you");
  expect(silent.label).toStartWith("may need you");
});

test("output resuming after a silent spell returns the badge to working and drops the duration", () => {
  const now = Date.parse("2026-01-01T01:00:00Z");
  const silent = session({ lastOutputAt: "2026-01-01T00:55:00Z" });
  expect(sessionBadge(silent, now).label).toBe("may need you 5m");
  const resumed = { ...silent, lastOutputAt: "2026-01-01T00:59:59Z" };
  expect(sessionBadge(resumed, now)).toMatchObject({ label: "working", tone: "info", live: true });
});

test("a silence is stated in seconds under a minute, in minutes from there on", () => {
  expect([0, 20_000, 59_000, 59_999, 60_000, 10 * 60_000].map(silenceDuration)).toEqual(["0s", "20s", "59s", "59s", "1m", "10m"]);
});

test("a card shows its running session, or the latest one if that ended badly", () => {
  const clean = session({ id: "a", state: "exited", exitCode: 0, createdAt: "2026-01-01T00:00:00Z" });
  const crashed = session({ id: "b", state: "exited", exitCode: 3, createdAt: "2026-01-02T00:00:00Z" });
  const running = session({ id: "c", createdAt: "2026-01-03T00:00:00Z" });
  expect(sessionForChange([clean, crashed, running], "r", "c")?.id).toBe("c");
  expect(sessionForChange([clean, crashed], "r", "c")?.id).toBe("b");
  expect(sessionForChange([crashed, { ...clean, createdAt: "2026-01-05T00:00:00Z" }], "r", "c")).toBeUndefined();
});

test("small helpers", () => {
  expect(worktreeName("archive", "c")).toBe("archive-c");
  expect(worktreeName("implement", "c")).toBe("c");
  expect(sessionBranch("archive", "c")).toBe("chore/archive-c");
  expect(sessionBranch("draft", "c")).toBe("feat/c");
  expect(parseArgLines(" claude \n\n {prompt} \n")).toEqual(["claude", "{prompt}"]);
  expect(slugId("My Agent!", ["my-agent"])).toBe("my-agent-2");
  const sb = new Scrollback(10);
  for (const part of ["aaaa", "bbbb", "cccc", "dd"]) sb.push(new TextEncoder().encode(part));
  expect(new TextDecoder().decode(sb.bytes())).toBe("bbbbccccdd"); // oldest chunk dropped once over the limit
});

test("the Integrate row says why the action is unavailable, and offers it when nothing is in the way", () => {
  const agent = fakeProfile({ prompts: { integrate: "set this project up" } });
  const on = { ...base, agentSessions: { ...base.agentSessions, enabled: true, agents: [agent], defaultAgent: "fake" } };
  const found: AgentAvailability[] = [{ id: "fake", name: "Fake Agent", available: true, path: "/usr/local/bin/fake" }];

  expect(integrateUnavailable(on, found)).toBeUndefined();
  expect(integrateUnavailable({ ...on, agentSessions: { ...on.agentSessions, enabled: false } }, found)).toBe("agent sessions are disabled");
  expect(integrateUnavailable({ ...on, agentSessions: { ...on.agentSessions, defaultAgent: "gone" } }, found)).toBe("no agent is configured");
  const noPrompt = { ...on, agentSessions: { ...on.agentSessions, agents: [fakeProfile()] } };
  expect(integrateUnavailable(noPrompt, found)).toBe("Fake Agent has no Integrate prompt configured");
  expect(integrateUnavailable(on, [{ ...found[0], available: false, path: undefined }])).toBe(`Fake Agent was not found (${agent.command[0]})`);
  // Availability not known yet (the list has not been polled): the action is offered and the request decides.
  expect(integrateUnavailable(on, [])).toBeUndefined();
});

test("starters: a change awaiting validation offers Validate and Archive, never Implement", () => {
  const a = (...s: ("done" | "ready" | "blocked")[]) => s.map((status, i) => ({ id: `a${i}`, status }));
  const done = a("done", "done");
  expect(availableActions({ artifacts: done, stage: "done", subState: "validate" })).toEqual(["validate", "archive"]);
  expect(availableActions({ artifacts: done, stage: "done", subState: "validate" })).not.toContain("implement");
  // `validate` belongs to `Done` alone; nothing earlier offers it.
  for (const stage of ["backlog", "drafts", "ready", "implementing", "unknown"] as const) {
    expect(availableActions({ artifacts: done, stage })).not.toContain("validate");
  }
  // An archived change offers nothing, whatever a leftover sub-state says.
  expect(availableActions({ artifacts: done, stage: "archived", subState: "validate", archived: "2026-06-18" })).toEqual([]);
  // A snapshot cached before sub-states existed reads as `complete`.
  expect(availableActions({ artifacts: done, stage: "done" })).toEqual(["archive"]);

  // Narrowed to the prompts the agent has: without a Validate prompt only Archive is offered.
  const repo = newRepoConfig("/w/demo-ops", true);
  const card = { repoId: repo.id, artifacts: done, stage: "done" as const, subState: "validate" as const };
  const withBoth = { ...base, repos: [repo], agentSessions: { ...base.agentSessions, enabled: true, agents: [fakeProfile({ prompts: { validate: "v {change}", archive: "a {change}" } })], defaultAgent: "fake" } };
  expect(startersFor(withBoth, card)).toEqual(["validate", "archive"]);
  const archiveOnly = { ...withBoth, agentSessions: { ...withBoth.agentSessions, agents: [fakeProfile({ prompts: { archive: "a {change}" } })] } };
  expect(startersFor(archiveOnly, card)).toEqual(["archive"]);
});
