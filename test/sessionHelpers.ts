import { cp, readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { defaultAgentSessions, defaultConfig, newRepoConfig } from "../src/server/config.ts";
import { scanRepo } from "../src/server/scanner.ts";
import { ClaudeRunner } from "../src/server/sessions/claudeRunner.ts";
import { SessionManager, type ManagerDeps } from "../src/server/sessions/manager.ts";
import type { Config, Snapshot } from "../src/shared/types.ts";
import { FIXTURES, tempDir } from "./helpers.ts";

export const FAKE_CLAUDE = join(FIXTURES, "fake-claude.ts");

/** Synthetic fixture repo copied to a temp dir, because the fake CLI creates its worktree directory inside it. */
export async function tempFixtureRepo(): Promise<string> {
  // Resolved, because a child process reports its real cwd and macOS temp dirs sit behind the /var symlink.
  const dir = join(await realpath(await tempDir("osd-repo-")), "demo-ops");
  await cp(join(FIXTURES, "demo-ops"), dir, { recursive: true });
  return dir;
}

export interface Harness {
  config: Config;
  snapshot: Snapshot;
  repoId: string;
  repoPath: string;
  manager: SessionManager;
  newManager(extra?: Partial<ManagerDeps>): SessionManager;
}

export async function harness(overrides: { enabled?: boolean; optIn?: boolean; maxRunning?: number; allowedTools?: string[]; timing?: ManagerDeps["timing"] } = {}): Promise<Harness> {
  const repoPath = await tempFixtureRepo();
  const repo = { ...newRepoConfig(repoPath, true), agent: overrides.optIn === false ? undefined : { enabled: true, allowedTools: overrides.allowedTools ?? [] } };
  const config: Config = {
    ...defaultConfig(),
    repos: [repo],
    agentSessions: { ...defaultAgentSessions(), enabled: overrides.enabled ?? true, maxRunning: overrides.maxRunning ?? 2, claudePath: FAKE_CLAUDE },
  };
  const snapshot: Snapshot = { generatedAt: new Date().toISOString(), repos: [await scanRepo(repo)] };
  const newManager = (extra: Partial<ManagerDeps> = {}) =>
    new SessionManager({ getConfig: () => config, getSnapshot: () => snapshot, runner: new ClaudeRunner(() => config.agentSessions.claudePath), timing: overrides.timing, ...extra });
  return { config, snapshot, repoId: repo.id, repoPath, manager: newManager(), newManager };
}

export async function waitFor(check: () => boolean | Promise<boolean>, what: string, timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`timed out waiting for ${what}`);
}

export async function recorded(path: string): Promise<{ argv: string[]; cwd: string; hasApiKey: boolean; hasAuthToken: boolean }[]> {
  try {
    return (await readFile(path, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}
