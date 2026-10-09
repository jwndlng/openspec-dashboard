import { afterAll, beforeAll, expect, test } from "bun:test";
import { realpathSync } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultConfig, loadConfig, newRepoConfig } from "../src/server/config.ts";
import { configPath } from "../src/server/paths.ts";
import { markSetupDone, setupState, suggestRoots } from "../src/server/setup.ts";
import type { Config } from "../src/shared/types.ts";
import { tempDir, useTempHome } from "./helpers.ts";

let cleanup: () => Promise<void>;
/** Stands in for the user's home directory: the suggestions never look at the real one in a test. */
let userHome: string;

beforeAll(async () => {
  ({ cleanup } = await useTempHome());
  userHome = realpathSync.native(await tempDir());
});
afterAll(async () => {
  await rm(userHome, { recursive: true, force: true });
  await cleanup();
});

test("suggestions are the well-known folders that exist, minus roots, ignore paths and files", async () => {
  await mkdir(join(userHome, "Workspace"));
  await mkdir(join(userHome, "Developer"));
  await mkdir(join(userHome, "repos"));
  await mkdir(join(userHome, "unrelated"));
  await writeFile(join(userHome, "code"), "a file, not a folder");
  const config = { scanRoots: [join(userHome, "Workspace")], ignorePaths: [join(userHome, "repos")] };
  expect(await suggestRoots(userHome, config)).toEqual([join(userHome, "Developer")]);
});

test("a folder is suggested once, with its on-disk spelling", async () => {
  await mkdir(join(userHome, "Projects"));
  const suggested = await suggestRoots(userHome, { scanRoots: [], ignorePaths: [] });
  // `projects` is on the list too; on a case-insensitive volume it resolves to the same folder and is not repeated.
  expect(suggested.filter((path) => path.toLowerCase().endsWith("/projects"))).toEqual([join(userHome, "Projects")]);
});

test("the setup state reports the flag", async () => {
  const pending = await setupState({ ...defaultConfig(), setup: "pending" }, userHome);
  expect(pending.pending).toBe(true);
  expect(pending.home).toBe(userHome);
  expect((await setupState(defaultConfig(), userHome)).pending).toBe(false);
});

test("marking setup done drops the flag and nothing else, and writes nothing a second time", async () => {
  const { config: fresh } = await loadConfig();
  const repo = newRepoConfig(join(userHome, "Developer", "alpha-infra"), true);
  const state: { config: Config } = { config: { ...fresh, scanRoots: [join(userHome, "Developer")], repos: [repo], setup: "pending" } };
  const saved = await markSetupDone(state);
  expect(saved.setup).toBeUndefined();
  expect(saved.scanRoots).toEqual([join(userHome, "Developer")]);
  expect(saved.repos).toEqual([repo]);
  expect(saved.agentSessions).toEqual(fresh.agentSessions);
  const written = (await stat(configPath())).mtimeMs;
  await Bun.sleep(5);
  expect(await markSetupDone(state)).toBe(state.config);
  expect((await stat(configPath())).mtimeMs).toBe(written);
});
