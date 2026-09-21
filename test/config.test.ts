import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ConfigValidationError, defaultAgentSessions, defaultConfig, loadConfig, newRepoConfig, repoId, saveConfig, validateConfig } from "../src/server/config.ts";
import { CLAUDE_PROFILE } from "../src/shared/agentDefaults.ts";
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

const FORMER_ARCHIVE = "/opsx:archive {change}";
const withArchive = (archive: string | undefined, id = "claude") => {
  const { archive: _current, ...prompts } = CLAUDE_PROFILE.prompts;
  const agent = { ...CLAUDE_PROFILE, id, prompts: archive === undefined ? prompts : { ...prompts, archive } };
  return { ...defaultConfig(), agentSessions: { enabled: true, agents: [agent], defaultAgent: id } };
};
const archiveOf = (input: unknown) => validateConfig(input).agentSessions.agents[0].prompts.archive;

test("the former preconfigured Archive prompt is read as the current one; anything else is the user's", () => {
  const current = CLAUDE_PROFILE.prompts.archive;
  expect(current).not.toBe(FORMER_ARCHIVE);
  expect(archiveOf(withArchive(FORMER_ARCHIVE))).toBe(current);
  expect(archiveOf(withArchive(`  ${FORMER_ARCHIVE}\n`))).toBe(current); // compared after the schema's trim
  const edited = "/opsx:archive {change} and ask me before syncing";
  expect(archiveOf(withArchive(edited))).toBe(edited);
  expect(archiveOf(withArchive(undefined))).toBeUndefined(); // a removed starter stays removed
  expect(archiveOf(withArchive(FORMER_ARCHIVE, "my-agent"))).toBe(FORMER_ARCHIVE); // not the preconfigured profile
  const upgraded = validateConfig(withArchive(FORMER_ARCHIVE)).agentSessions.agents[0];
  expect(upgraded.prompts).toEqual(CLAUDE_PROFILE.prompts); // the other prompts are untouched
});

test("a config file with the former Archive prompt loads upgraded, is not rewritten by loading, and saves the new prompt", async () => {
  const path = join(home, "config.json");
  const former = `${JSON.stringify(withArchive(FORMER_ARCHIVE), null, 2)}\n`;
  await writeFile(path, former, "utf8");
  const { config, warning } = await loadConfig();
  expect(warning).toBeUndefined();
  expect(config.agentSessions.agents[0].prompts.archive).toBe(CLAUDE_PROFILE.prompts.archive);
  expect(await readFile(path, "utf8")).toBe(former);
  await saveConfig(config);
  expect(JSON.parse(await readFile(path, "utf8")).agentSessions.agents[0].prompts.archive).toBe(CLAUDE_PROFILE.prompts.archive);
  expect((await loadConfig()).config.agentSessions.agents[0].prompts.archive).toBe(CLAUDE_PROFILE.prompts.archive);
});
