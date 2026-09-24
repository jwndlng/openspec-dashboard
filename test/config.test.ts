import { afterAll, beforeAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ConfigValidationError, defaultAgentSessions, defaultConfig, loadConfig, newRepoConfig, repoId, saveConfig, validateConfig, validateIgnorePaths } from "../src/server/config.ts";
import { CLAUDE_PROFILE } from "../src/shared/agentDefaults.ts";
import { tempDir, useTempHome } from "./helpers.ts";

let home: string;
let cleanup: () => Promise<void>;
/** A workspace with one directory, `acme/beta-soc`, that is also reachable as `link/beta-soc`. */
let work: string;

/** sha1-shaped id as an earlier version computed it: over the path exactly as it was stored. */
const legacyId = (path: string) => createHash("sha1").update(path).digest("hex").slice(0, 12);

beforeAll(async () => {
  ({ home, cleanup } = await useTempHome());
  work = realpathSync.native(await tempDir());
  await mkdir(join(work, "acme", "beta-soc"), { recursive: true });
  await symlink(join(work, "acme"), join(work, "link"));
});
afterAll(async () => {
  await rm(work, { recursive: true, force: true });
  await cleanup();
});

test("first run creates default config", async () => {
  const { config, warning } = await loadConfig();
  expect(warning).toBeUndefined();
  expect(config).toEqual({ version: 1, scanRoots: [], ignorePaths: [], repos: [], pollIntervalSeconds: 60, port: 4711, agentSessions: defaultAgentSessions() });
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

test("config without ignorePaths loads with an empty list", async () => {
  const { ignorePaths: _dropped, ...legacy } = { ...defaultConfig(), scanRoots: ["/w/acme"], pollIntervalSeconds: 90 };
  await writeFile(join(home, "config.json"), JSON.stringify(legacy), "utf8");
  const { config, warning } = await loadConfig();
  expect(warning).toBeUndefined();
  expect(config).toEqual({ ...defaultConfig(), scanRoots: ["/w/acme"], pollIntervalSeconds: 90 });
  expect(JSON.parse(await readFile(join(home, "config.json"), "utf8")).ignorePaths).toEqual([]);
});

test("legacy entries for one directory under two spellings merge; the enabled one and its name win", async () => {
  const real = join(work, "acme", "beta-soc");
  const viaLink = join(work, "link", "beta-soc");
  const legacy = {
    ...defaultConfig(),
    scanRoots: [join(work, "link"), `${join(work, "acme")}/`],
    repos: [
      { id: legacyId(real), path: real, name: "beta-soc", enabled: false },
      { id: legacyId(viaLink), path: viaLink, name: "Beta SOC", enabled: true },
    ],
  };
  await writeFile(join(home, "config.json"), JSON.stringify(legacy), "utf8");
  const { config, warning } = await loadConfig();
  expect(config.repos).toEqual([{ id: repoId(real), path: real, name: "Beta SOC", enabled: true }]);
  expect(config.scanRoots).toEqual([join(work, "acme")]);
  expect(warning).toMatch(/merged "beta-soc" into "Beta SOC"/);
  expect(warning).not.toMatch(/reset to defaults/);
  expect(JSON.parse(await readFile(join(home, "config.json"), "utf8")).repos).toEqual(config.repos);
  expect((await loadConfig()).warning).toBeUndefined(); // migrated once, stable afterwards
});

test("a legacy non-canonical path is repaired instead of resetting the config", async () => {
  const viaLink = join(work, "link", "beta-soc");
  const legacy = { ...defaultConfig(), pollIntervalSeconds: 120, repos: [{ id: legacyId(viaLink), path: viaLink, name: "Kept", enabled: true }] };
  await writeFile(join(home, "config.json"), JSON.stringify(legacy), "utf8");
  const { config, warning } = await loadConfig();
  expect(warning).toBeUndefined();
  expect(config.pollIntervalSeconds).toBe(120);
  expect(config.repos).toEqual([{ id: repoId(join(work, "acme", "beta-soc")), path: join(work, "acme", "beta-soc"), name: "Kept", enabled: true }]);
});

test("one directory has one id, however it is spelled", () => {
  expect(repoId(join(work, "link", "beta-soc"))).toBe(repoId(join(work, "acme", "beta-soc")));
  expect(newRepoConfig(`${join(work, "link", "beta-soc")}/`).path).toBe(join(work, "acme", "beta-soc"));
});

test("validation stays strict: mismatching id and two repos resolving to one directory are rejected", () => {
  const real = newRepoConfig(join(work, "acme", "beta-soc"));
  const viaLink = join(work, "link", "beta-soc");
  expect(() => validateConfig({ ...defaultConfig(), repos: [{ ...real, path: viaLink, id: legacyId(viaLink) }] })).toThrow(/does not match/);
  expect(() => validateConfig({ ...defaultConfig(), repos: [real, { ...real, path: viaLink, name: "again" }] })).toThrow(/duplicate repo id/);
});

test("ignore paths must be absolute and are stored canonically", () => {
  expect(() => validateConfig({ ...defaultConfig(), ignorePaths: ["relative/dir"] })).toThrow(/ignorePaths\.0: must be an absolute path/);
  expect(() => validateIgnorePaths(["relative/dir"])).toThrow(/ignorePaths\.0: must be an absolute path/);
  expect(validateIgnorePaths([`${join(work, "link")}/`])).toEqual([join(work, "acme")]);
  const { ignorePaths: _dropped, ...withoutIgnore } = defaultConfig();
  expect(validateConfig(withoutIgnore).ignorePaths).toEqual([]);
});

test("a saved console folder that no longer exists still loads; its shape is still checked", () => {
  const base = defaultConfig();
  const gone = validateConfig({ ...base, agentSessions: { ...base.agentSessions, consoleDir: "/w/acme/was-here-once" } });
  expect(gone.agentSessions.consoleDir).toBe("/w/acme/was-here-once");
  expect(() => validateConfig({ ...base, agentSessions: { ...base.agentSessions, consoleDir: "acme" } })).toThrow(ConfigValidationError);
  expect(validateConfig(base).agentSessions.consoleDir).toBeUndefined();
});
