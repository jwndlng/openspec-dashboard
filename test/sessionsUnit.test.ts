import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultAgentSessions, defaultConfig, newRepoConfig, validateConfig } from "../src/server/config.ts";
import { buildClaudeArgs, childEnv } from "../src/server/sessions/claudeRunner.ts";
import { parseStreamLine, userMessageLine } from "../src/server/sessions/claudeStream.ts";
import { DEFAULT_ALLOWED_TOOLS, renderCommand, worktreeSystemPrompt } from "../src/server/sessions/manager.ts";
import { availableActions } from "../src/shared/types.ts";
import { FIXTURES } from "./helpers.ts";

const stream = (name: string) => readFileSync(join(FIXTURES, "claude-stream", name), "utf8").split("\n").flatMap(parseStreamLine);

test("config without agentSessions loads disabled with defaults; repos are not opted in", () => {
  const { agentSessions: _drop, ...old } = defaultConfig();
  const cfg = validateConfig({ ...old, repos: [newRepoConfig("/w/demo-ops", true)] });
  expect(cfg.agentSessions).toEqual(defaultAgentSessions());
  expect(cfg.agentSessions.enabled).toBe(false);
  expect(cfg.repos[0].agent).toBeUndefined();
});

test("agent settings validation: limits, placeholders and bypass attempts", () => {
  const base = defaultConfig();
  const withSessions = (patch: object) => ({ ...base, agentSessions: { ...base.agentSessions, ...patch } });
  expect(() => validateConfig(withSessions({ maxRunning: 0 }))).toThrow(/agentSessions.maxRunning/);
  expect(() => validateConfig(withSessions({ commands: { draft: "/opsx:ff {change}", implement: "/opsx:apply {change} {branch}" } }))).toThrow(/unknown placeholder/);
  expect(() => validateConfig(withSessions({ commands: { draft: "/opsx:ff", implement: "/opsx:apply {change}" } }))).toThrow(/must contain \{change\}/);
  expect(() => validateConfig(withSessions({ commands: { draft: "/opsx:ff {change} --dangerously-skip-permissions", implement: "/opsx:apply {change}" } }))).toThrow(/bypass/);
  const repo = (allowedTools: string[]) => ({ ...base, repos: [{ ...newRepoConfig("/w/demo-ops", true), agent: { enabled: true, allowedTools } }] });
  expect(validateConfig(repo(["Bash(bun run check*)"])).repos[0].agent?.allowedTools).toEqual(["Bash(bun run check*)"]);
  for (const bad of ["--dangerously-skip-permissions", "bypassPermissions", "Read,Bash(*)", "--permission-mode"]) {
    expect(() => validateConfig(repo([bad]))).toThrow(/repos.0.agent.allowedTools.0/);
  }
});

test("starters: draft while an artifact is open, implement in Ready/Implementing, none when archived", () => {
  const a = (...s: ("done" | "ready" | "blocked")[]) => s.map((status, i) => ({ id: `a${i}`, status }));
  expect(availableActions({ artifacts: a("done", "ready"), stage: "artifact" })).toEqual(["draft"]);
  expect(availableActions({ artifacts: a("done", "done"), stage: "ready" })).toEqual(["implement"]);
  expect(availableActions({ artifacts: a("done", "ready"), stage: "implementing" })).toEqual(["draft", "implement"]);
  expect(availableActions({ artifacts: a("done", "done"), stage: "done" })).toEqual([]);
  expect(availableActions({ artifacts: a("done", "done"), stage: "archived", archived: "2026-06-18" })).toEqual([]);
});

test("command templating only accepts validated change names", () => {
  expect(renderCommand("/opsx:apply {change}", "cache-api-calls")).toBe("/opsx:apply cache-api-calls");
  expect(() => renderCommand("/opsx:apply {change}", "x; rm -rf ~")).toThrow(/invalid change name/);
});

test("argument array: isolated settings, dontAsk, one allowedTools value, no bypass, resume form", () => {
  const options = { cwd: "/w/demo-ops", cliSessionId: "11111111-1111-4111-8111-111111111111", allowedTools: [...DEFAULT_ALLOWED_TOOLS, "Bash(bun run check*)"], addDirs: ["/w/demo-ops/openspec/changes/x"], systemPrompt: "rules", passApiKeyEnv: false };
  const fresh = buildClaudeArgs({ ...options, mode: { kind: "fresh", worktreeName: "cache-api-calls" } });
  expect(fresh.slice(0, 2)).toEqual(["-p", "--verbose"]);
  expect(fresh).toContain("--replay-user-messages");
  expect(fresh.join(" ")).toContain("--input-format stream-json");
  expect(fresh.join(" ")).toContain("--session-id 11111111-1111-4111-8111-111111111111 --worktree cache-api-calls");
  expect(fresh.join(" ")).toContain("--setting-sources project --permission-mode dontAsk");
  expect(fresh.filter((a) => a.startsWith("--allowedTools"))).toEqual([`--allowedTools=${[...DEFAULT_ALLOWED_TOOLS, "Bash(bun run check*)"].join(",")}`]);
  expect(fresh.join(" ")).not.toMatch(/dangerously|bypassPermissions/);
  const resume = buildClaudeArgs({ ...options, mode: { kind: "resume" } });
  expect(resume.join(" ")).toContain("--resume 11111111-1111-4111-8111-111111111111");
  expect(resume).not.toContain("--worktree");
  expect(resume).not.toContain("--session-id");
});

test("API keys are stripped from the child environment unless opted in", () => {
  const env = { PATH: "/bin", ANTHROPIC_API_KEY: "k", ANTHROPIC_AUTH_TOKEN: "t", HOME: "/h", EMPTY: undefined };
  expect(childEnv(env, false)).toEqual({ PATH: "/bin", HOME: "/h" });
  expect(childEnv(env, true)).toEqual({ PATH: "/bin", ANTHROPIC_API_KEY: "k", ANTHROPIC_AUTH_TOKEN: "t", HOME: "/h" });
});

test("system prompt pins the agent to its worktree", () => {
  const prompt = worktreeSystemPrompt("/w/demo-ops", "cache-api-calls");
  expect(prompt).toContain("Never edit, stage, commit or switch branches in the main checkout at /w/demo-ops");
  expect(prompt).toContain("git branch -m feat/cache-api-calls");
  expect(prompt).toContain("/w/demo-ops/openspec/changes/cache-api-calls");
});

test("recorded stream: two turns then an interrupted third", () => {
  const events = stream("two-turns-then-interrupt.ndjson");
  const results = events.filter((e) => e.type === "result");
  expect(results.length).toBe(3);
  expect(results[0]).toMatchObject({ isError: false, text: "one", terminalReason: "completed" });
  expect(results[2]).toMatchObject({ isError: true, terminalReason: "aborted_streaming" });
  expect(events.find((e) => e.type === "init")).toMatchObject({ apiKeySource: "none", cwd: "/w/demo-ops/.claude/worktrees/cache-api-calls" });
  // Our own messages come back as replays; the interrupted turn also carries the CLI's own, non-replayed marker.
  const users = events.filter((e) => e.type === "user");
  expect(users.filter((e) => e.type === "user" && e.replay).length).toBe(3);
  expect(users.some((e) => e.type === "user" && !e.replay)).toBe(true);
  expect(events.find((e) => e.type === "rate_limit")).toMatchObject({ status: "allowed", windows: { five_hour: { utilization: 0.09 } } });
});

test("recorded stream: denied tool call is reported as error result and in the denials", () => {
  const events = stream("denied-tool.ndjson");
  expect(events.find((e) => e.type === "tool_use")).toMatchObject({ name: "Bash" });
  expect(events.find((e) => e.type === "tool_result")).toMatchObject({ isError: true });
  const result = events.find((e) => e.type === "result");
  expect(result?.type === "result" && result.denials.map((d) => d.tool)).toEqual(["Bash"]);
});

test("recorded stream: slash command as plain message text; junk lines do not throw", () => {
  const events = stream("slash-command.ndjson");
  // The CLI replays a slash command in its expanded form, which is why the dashboard records messages when it sends them.
  const replayed = events.find((e) => e.type === "user");
  expect(replayed).toMatchObject({ replay: true });
  expect(replayed?.type === "user" && replayed.text).toContain("<command-name>/ping</command-name>");
  expect(events.at(-1)).toMatchObject({ type: "result", text: "slash-ok hello" });
  expect(parseStreamLine("not json")).toEqual([{ type: "unparsed", raw: "not json" }]);
  expect(parseStreamLine("")).toEqual([]);
  expect(JSON.parse(userMessageLine('"; rm -rf ~ #')).message.content[0].text).toBe('"; rm -rf ~ #');
});
