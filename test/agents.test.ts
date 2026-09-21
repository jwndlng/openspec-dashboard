import { expect, test } from "bun:test";
import { defaultAgentSessions, defaultConfig, newRepoConfig, validateConfig } from "../src/server/config.ts";
import { agentEnv, agentFor, launchCommand, openingPrompt } from "../src/server/sessions/agents.ts";
import { Scrollback, sessionBranch, worktreeName } from "../src/server/sessions/manager.ts";
import { availableActions, type Session } from "../src/shared/types.ts";
import { agentForRepo, parseArgLines, searchWithSession, sessionBadge, sessionForChange, sessionIdFromSearch, sessionsEnabledFor, slugId, startersFor } from "../src/ui/sessionState.ts";
import { fakeProfile } from "./sessionHelpers.ts";

const base = defaultConfig();
const withAgents = (agents: unknown, defaultAgent = "claude") => ({ ...base, agentSessions: { enabled: true, agents, defaultAgent } });

test("defaults: disabled, Claude Code preconfigured on its own login", () => {
  const d = defaultAgentSessions();
  expect(d.enabled).toBe(false);
  expect(d.agents.map((a) => a.id)).toEqual(["claude"]);
  expect(d.agents[0].command).toEqual(["claude", "{prompt}"]);
  expect(d.agents[0].unsetEnv).toContain("ANTHROPIC_API_KEY");
  expect(d.agents[0].prompts.archive).toBe("/opsx:archive {change}");
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
  expect(availableActions({ artifacts: a("done", "ready"), stage: "artifact" })).toEqual(["draft"]);
  expect(availableActions({ artifacts: a("done", "done"), stage: "ready" })).toEqual(["implement"]);
  expect(availableActions({ artifacts: a("done", "done"), stage: "done" })).toEqual(["archive"]);
  expect(availableActions({ artifacts: a("done", "done"), stage: "archived", archived: "2026-06-18" })).toEqual([]);
  const repo = newRepoConfig("/w/demo-ops", true);
  const cfg = { ...base, repos: [repo], agentSessions: { enabled: true, agents: [fakeProfile({ prompts: { implement: "x {change}" } })], defaultAgent: "fake" } };
  expect(startersFor(cfg, { repoId: repo.id, artifacts: a("done", "done"), stage: "ready" })).toEqual(["implement"]);
  expect(startersFor(cfg, { repoId: repo.id, artifacts: a("done", "done"), stage: "done" })).toEqual([]); // no archive prompt
  expect(sessionsEnabledFor(cfg, repo.id)).toBe(true);
  expect(sessionsEnabledFor({ ...cfg, repos: [{ ...repo, agent: { enabled: false } }] }, repo.id)).toBe(false);
  expect(sessionsEnabledFor({ ...cfg, agentSessions: { ...cfg.agentSessions, enabled: false } }, repo.id)).toBe(false);
});

const session = (patch: Partial<Session>): Session => ({ id: "s", repoId: "r", change: "c", action: "implement", agentId: "fake", agentName: "Fake Agent", state: "running", worktreePath: "/w/wt", branch: "feat/c", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", resumable: true, ...patch });

test("badges are honest about what a terminal can tell", () => {
  const now = Date.parse("2026-01-01T01:00:00Z");
  expect(sessionBadge(session({ lastOutputAt: "2026-01-01T00:59:50Z" }), now)).toMatchObject({ label: "● running", tone: "brand" });
  expect(sessionBadge(session({ lastOutputAt: "2026-01-01T00:50:00Z" }), now)).toMatchObject({ label: "◆ quiet 10m", tone: "warn" });
  expect(sessionBadge(session({ state: "exited", exitCode: 0 }), now)).toMatchObject({ label: "ended", tone: "" });
  expect(sessionBadge(session({ state: "exited", exitCode: 3 }), now)).toMatchObject({ label: "⚠ ended (3)", tone: "danger" });
  expect(sessionBadge(session({ state: "failed", error: "no such file" }), now)).toMatchObject({ tone: "danger", title: "no such file" });
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
  expect(sessionIdFromSearch("?q=x&session=abc")).toBe("abc");
  expect(searchWithSession("?q=x&session=abc", undefined)).toBe("?q=x");
  const sb = new Scrollback(10);
  for (const part of ["aaaa", "bbbb", "cccc", "dd"]) sb.push(new TextEncoder().encode(part));
  expect(new TextDecoder().decode(sb.bytes())).toBe("bbbbccccdd"); // oldest chunk dropped once over the limit
});
