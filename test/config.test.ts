import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ConfigValidationError, defaultAgentSessions, defaultConfig, loadConfig, newRepoConfig, repoId, saveConfig, validateConfig } from "../src/server/config.ts";
import { useTempHome } from "./helpers.ts";

let home: string;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  ({ home, cleanup } = await useTempHome());
});
afterAll(() => cleanup());

test("first run creates default config", async () => {
  const { config, warning } = await loadConfig();
  expect(warning).toBeUndefined();
  expect(config).toEqual({ version: 1, scanRoots: [], repos: [], pollIntervalSeconds: 60, port: 4711, agentSessions: defaultAgentSessions() });
  expect(config.agentSessions.enabled).toBe(false);
  expect(JSON.parse(await readFile(join(home, "config.json"), "utf8")).port).toBe(4711);
});

test("save/load round-trip keeps enabled repos", async () => {
  const repo = newRepoConfig("/tmp/example/beta-soc", true);
  await saveConfig({ ...defaultConfig(), scanRoots: ["/tmp/example"], repos: [repo] });
  const { config } = await loadConfig();
  expect(config.repos).toEqual([repo]);
  expect(config.repos[0].name).toBe("beta-soc");
});

test("invalid config is rejected with messages", () => {
  expect(() => validateConfig({ ...defaultConfig(), pollIntervalSeconds: 1 })).toThrow(ConfigValidationError);
  expect(() => validateConfig({ ...defaultConfig(), scanRoots: ["relative/path"] })).toThrow(/absolute/);
  const repo = newRepoConfig("/tmp/a");
  expect(() => validateConfig({ ...defaultConfig(), repos: [repo, repo] })).toThrow(/duplicate/);
  expect(() => validateConfig({ ...defaultConfig(), repos: [{ ...repo, id: "000000000000" }] })).toThrow(/does not match/);
});

test("rename keeps id; id derives from path", () => {
  const repo = newRepoConfig("/tmp/x/my-repo");
  expect(repo.id).toBe(repoId("/tmp/x/my-repo"));
  expect(repo.id).toMatch(/^[a-f0-9]{12}$/);
  const renamed = validateConfig({ ...defaultConfig(), repos: [{ ...repo, name: "Renamed" }] });
  expect(renamed.repos[0].id).toBe(repo.id);
  expect(renamed.repos[0].name).toBe("Renamed");
});

test("tilde in paths is expanded", () => {
  const cfg = validateConfig({ ...defaultConfig(), scanRoots: ["~/Workspace"] });
  expect(cfg.scanRoots[0]).not.toContain("~");
  expect(cfg.scanRoots[0].endsWith("/Workspace")).toBe(true);
});

test("corrupt config is backed up and reset", async () => {
  await writeFile(join(home, "config.json"), "{ not json", "utf8");
  const { config, warning } = await loadConfig();
  expect(config.port).toBe(4711);
  expect(warning).toMatch(/moved to/);
});
