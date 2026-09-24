import { expect, test } from "bun:test";
import { defaultAgentSessions, defaultConfig, newRepoConfig, validateConfig } from "../src/server/config.ts";
import { agentEnv, agentFor, launchCommand, openingPrompt } from "../src/server/sessions/agents.ts";
import { Scrollback, sessionBranch, worktreeName } from "../src/server/sessions/manager.ts";
import { CLAUDE_PROFILE, FORMER_ARCHIVE_PROMPTS } from "../src/shared/agentDefaults.ts";
import { availableActions, type ChangeSession, type Session } from "../src/shared/types.ts";
import { agentForRepo, NEEDS_YOU_AFTER_MS, parseArgLines, sessionBadge, sessionForChange, sessionsEnabledFor, silenceDuration, slugId, startersFor } from "../src/ui/sessionState.ts";
import { fakeProfile } from "./sessionHelpers.ts";

const base = defaultConfig();
const withAgents = (agents: unknown, defaultAgent = "claude") => ({ ...base, agentSessions: { enabled: true, agents, defaultAgent } });

test("defaults: disabled, Claude Code preconfigured on its own login", () => {
  const d = defaultAgentSessions();
  expect(d.enabled).toBe(false);
  expect(d.agents.map((a) => a.id)).toEqual(["claude"]);
  expect(d.agents[0].command).toEqual(["claude", "{prompt}"]);
  expect(d.agents[0].unsetEnv).toContain("ANTHROPIC_API_KEY");
});

test("the preconfigured Archive prompt syncs the specs first without asking, as one line", () => {
  const archive = defaultAgentSessions().agents[0].prompts.archive ?? "";
  expect(archive.startsWith("/opsx:archive {change}")).toBe(true);
  expect(archive).toMatch(/sync the delta specs/);
  expect(archive).toMatch(/without asking/);
  expect(archive).toMatch(/already in sync, archive right away/);
  expect(archive).not.toContain("\n");
  expect(FORMER_ARCHIVE_PROMPTS).toEqual(["/opsx:archive {change}"]);
  expect(FORMER_ARCHIVE_PROMPTS).not.toContain(archive);
  const prompt = openingPrompt(CLAUDE_PROFILE, "archive", "cache-api-calls") ?? "";
  expect(prompt.startsWith("/opsx:archive cache-api-calls — sync")).toBe(true);
  expect(launchCommand(CLAUDE_PROFILE, prompt)).toEqual({ argv: ["claude", prompt] }); // one argument
  expect(validateConfig(withAgents([CLAUDE_PROFILE])).agentSessions.agents[0].prompts.archive).toBe(archive); // passes the prompt rules
});

test("configs from the transcript-based version load: their keys are dropped, defaults fill in", () => {
  const old = { ...base, agentSessions: { enabled: true, maxRunning: 2, idleMinutes: 30, claudePath: "claude", passApiKeyEnv: false, commands: { draft: "/opsx:ff {change}" } }, repos: [{ ...newRepoConfig("/w/demo-ops", true), agent: { enabled: true, allowedTools: ["Bash(x)"] } }] };
  const cfg = validateConfig(old);
  expect(cfg.agentSessions).toEqual({ enabled: true, agents: defaultAgentSessions().agents, defaultAgent: "claude" });
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
  const cfg = { ...base, repos: [{ ...repo, agent: { enabled: true, agentId: "b" } }], agentSessions: { enabled: true, agents: [fakeProfile({ id: "a" }), fakeProfile({ id: "b", name: "B" })], defaultAgent: "a" } };
  expect(agentFor(cfg, cfg.repos[0])?.id).toBe("b");
  expect(agentFor(cfg, repo)?.id).toBe("a");
  expect(agentForRepo(cfg, repo.id)?.name).toBe("B");
});

test("starters: stage decides, narrowed to the prompts the agent has", () => {
  const a = (...s: ("done" | "ready" | "blocked")[]) => s.map((status, i) => ({ id: `a${i}`, status }));
  expect(availableActions({ artifacts: a("done", "ready"), stage: "drafts" })).toEqual(["draft"]);
  expect(availableActions({ artifacts: a("done", "done"), stage: "ready" })).toEqual(["implement"]);
  expect(availableActions({ artifacts: a("done", "done"), stage: "done" })).toEqual(["archive"]);
  expect(availableActions({ artifacts: a("done", "done"), stage: "done" })).toEqual(["archive"]);
  expect(availableActions({ artifacts: a("done", "done"), stage: "implementing" })).toEqual(["implement"]);
  expect(availableActions({ artifacts: a("done", "done"), stage: "archived", archived: "2026-06-18" })).toEqual([]);
  const repo = newRepoConfig("/w/demo-ops", true);
  const cfg = { ...base, repos: [repo], agentSessions: { enabled: true, agents: [fakeProfile({ prompts: { implement: "x {change}" } })], defaultAgent: "fake" } };
  expect(startersFor(cfg, { repoId: repo.id, artifacts: a("done", "done"), stage: "ready" })).toEqual(["implement"]);
  expect(startersFor(cfg, { repoId: repo.id, artifacts: a("done", "done"), stage: "done" })).toEqual([]); // no archive prompt
  const archiving = { ...cfg, agentSessions: { ...cfg.agentSessions, agents: [fakeProfile({ prompts: { archive: "a {change}" } })] } };
  for (const stage of ["done"] as const) expect(startersFor(archiving, { repoId: repo.id, artifacts: a("done", "done"), stage })).toEqual(["archive"]);
  expect(sessionsEnabledFor(cfg, repo.id)).toBe(true);
  expect(sessionsEnabledFor({ ...cfg, repos: [{ ...repo, agent: { enabled: false } }] }, repo.id)).toBe(false);
  expect(sessionsEnabledFor({ ...cfg, agentSessions: { ...cfg.agentSessions, enabled: false } }, repo.id)).toBe(false);
});

const session = (patch: Partial<ChangeSession>): ChangeSession => ({ id: "s", repoId: "r", change: "c", action: "implement", agentId: "fake", agentName: "Fake Agent", state: "running", worktreePath: "/w/wt", branch: "feat/c", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", resumable: true, ...patch });

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
