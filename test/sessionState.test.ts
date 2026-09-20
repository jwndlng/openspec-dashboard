import { expect, test } from "bun:test";
import { defaultAgentSessions, defaultConfig, newRepoConfig } from "../src/server/config.ts";
import type { Session } from "../src/shared/types.ts";
import { parseToolList, resumeCommand, searchWithSession, sessionBadge, sessionForChange, sessionIdFromSearch, sessionsEnabledFor } from "../src/ui/sessionState.ts";

const session = (patch: Partial<Session>): Session => ({ id: "s", repoId: "r", change: "c", action: "implement", cliSessionId: "11111111-1111-4111-8111-111111111111", state: "waiting", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", turns: 1, costUsd: 0, lastSeq: 1, ...patch });

test("starters need the global switch; repositories are included unless switched off", () => {
  const repo = newRepoConfig("/w/demo-ops", true);
  const make = (enabled: boolean, included: boolean, tracked = true) => ({ ...defaultConfig(), repos: [{ ...repo, enabled: tracked, agent: included ? undefined : { enabled: false, allowedTools: [] } }], agentSessions: { ...defaultAgentSessions(), enabled } });
  expect(sessionsEnabledFor(make(true, true), repo.id)).toBe(true);
  expect(sessionsEnabledFor(make(false, true), repo.id)).toBe(false);
  expect(sessionsEnabledFor(make(true, false), repo.id)).toBe(false);
  expect(sessionsEnabledFor(make(true, true, false), repo.id)).toBe(false); // untracked repositories never qualify
  expect(sessionsEnabledFor(null, repo.id)).toBe(false);
});

test("a card shows its open session, else its latest failure, else nothing", () => {
  const closed = session({ id: "a", state: "closed", createdAt: "2026-01-01T00:00:00Z" });
  const failed = session({ id: "b", state: "failed", createdAt: "2026-01-02T00:00:00Z" });
  const open = session({ id: "c", state: "running", createdAt: "2026-01-03T00:00:00Z" });
  expect(sessionForChange([closed, failed, open], "r", "c")?.id).toBe("c");
  expect(sessionForChange([closed, failed], "r", "c")?.id).toBe("b");
  expect(sessionForChange([failed, session({ id: "d", state: "closed", createdAt: "2026-01-05T00:00:00Z" })], "r", "c")).toBeUndefined();
  expect(sessionForChange([open], "r", "other")).toBeUndefined();
});

test("badges carry text, and failures their reason", () => {
  expect(sessionBadge(session({ state: "running" })).label).toContain("working");
  expect(sessionBadge(session({ state: "waiting" }))).toMatchObject({ label: expect.stringContaining("waiting for you"), tone: "warn" });
  expect(sessionBadge(session({ state: "failed", failure: "auth", error: "not logged in" }))).toMatchObject({ tone: "danger", title: "not logged in" });
});

test("resume command runs from the worktree and quotes odd paths", () => {
  expect(resumeCommand(session({}))).toBeUndefined();
  expect(resumeCommand(session({ worktreePath: "/w/demo-ops/.claude/worktrees/c" }))).toBe("cd /w/demo-ops/.claude/worktrees/c && claude --resume 11111111-1111-4111-8111-111111111111");
  expect(resumeCommand(session({ worktreePath: "/w/my repos/x" }))).toContain("cd '/w/my repos/x' &&");
});

test("the session parameter coexists with board filters in the URL", () => {
  expect(sessionIdFromSearch("?q=cache&session=abc")).toBe("abc");
  expect(sessionIdFromSearch("?q=cache")).toBeUndefined();
  expect(searchWithSession("?q=cache&stale=14", "abc")).toBe("?q=cache&stale=14&session=abc");
  expect(searchWithSession("?q=cache&session=abc", undefined)).toBe("?q=cache");
  expect(searchWithSession("?session=abc", undefined)).toBe("");
});

test("allowed-tools text area: one pattern per line", () => {
  expect(parseToolList(" Bash(bun run check*) \n\n Bash(bun test*)\n")).toEqual(["Bash(bun run check*)", "Bash(bun test*)"]);
});
