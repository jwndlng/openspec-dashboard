import { afterAll, beforeAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ConfigValidationError, defaultAgentSessions, defaultConfig, loadConfig, newRepoConfig, repoId, saveConfig, updateConfig, validateConfig, validateIgnorePaths } from "../src/server/config.ts";
import { CLAUDE_PROFILE, DEFAULT_SHORTCUTS, FORMER_PROMPTS } from "../src/shared/agentDefaults.ts";
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

const withPrompts = (prompts: Record<string, string>, id = "claude") => {
  const agent = { ...CLAUDE_PROFILE, id, prompts };
  return { ...defaultConfig(), agentSessions: { enabled: true, agents: [agent], defaultAgent: id } };
};
const promptsOf = (input: unknown) => validateConfig(input).agentSessions.agents[0].prompts;

test("former preconfigured prompts are upgraded per starter, so one never rewrites another", () => {
  const FORMER_IMPLEMENT = "/opsx:apply {change}";
  const FORMER_SYNCING_ARCHIVE = FORMER_PROMPTS.archive?.at(-1) as string;
  expect(FORMER_PROMPTS.implement).toContain(FORMER_IMPLEMENT);
  expect(CLAUDE_PROFILE.prompts.implement).not.toBe(FORMER_IMPLEMENT);
  expect(CLAUDE_PROFILE.prompts.archive).not.toBe(FORMER_SYNCING_ARCHIVE);

  // What every installation on the previous version has saved: both former texts, verbatim. Both upgrade — and neither
  // a Validate nor an Integrate prompt is invented, because the rule only ever replaces a prompt that is there
  // (agent-sessions spec).
  const { validate: _validate, integrate: _integrate, ...upgraded } = CLAUDE_PROFILE.prompts;
  expect(promptsOf(withPrompts({ draft: "/opsx:ff {change}", implement: FORMER_IMPLEMENT, archive: FORMER_SYNCING_ARCHIVE }))).toEqual(upgraded);

  // An edited Implement prompt is the user's and stays; the untouched Archive one still upgrades.
  const edited = "/opsx:apply {change} and stop after each task";
  expect(promptsOf(withPrompts({ implement: edited, archive: FORMER_SYNCING_ARCHIVE }))).toEqual({ implement: edited, archive: CLAUDE_PROFILE.prompts.archive });

  // A removed starter stays removed, and a profile the user added is never touched.
  expect(promptsOf(withPrompts({ archive: FORMER_SYNCING_ARCHIVE })).implement).toBeUndefined();
  expect(promptsOf(withPrompts({ implement: FORMER_IMPLEMENT, archive: FORMER_SYNCING_ARCHIVE }, "my-agent"))).toEqual({ implement: FORMER_IMPLEMENT, archive: FORMER_SYNCING_ARCHIVE });

  // Nothing invents a Validate prompt for a profile that has none: the new starter is simply not offered there.
  expect(promptsOf(withPrompts({ implement: FORMER_IMPLEMENT })).validate).toBeUndefined();
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

const withShortcuts = (shortcuts: unknown) => {
  const cfg = defaultConfig();
  return { ...cfg, agentSessions: { ...cfg.agentSessions, shortcuts } };
};
const shortcutsOf = (input: unknown) => validateConfig(input).agentSessions.shortcuts;
const refuse = (input: unknown) => expect(() => validateConfig(input)).toThrow(ConfigValidationError);

test("a config that does not mention shortcuts carries the shipped ones; an empty list is the user's own", () => {
  const { agentSessions, ...noAgentSessions } = defaultConfig();
  const { shortcuts: _none, ...withoutShortcuts } = agentSessions;
  expect(shortcutsOf({ ...noAgentSessions, agentSessions: withoutShortcuts })).toEqual([...DEFAULT_SHORTCUTS]);
  expect(shortcutsOf(noAgentSessions)).toEqual([...DEFAULT_SHORTCUTS]);
  expect(shortcutsOf(withShortcuts([]))).toEqual([]);
});

test("a saved shortcut list is carried through unchanged: no default is ever added back", () => {
  const mine = [
    { id: "ship", title: "Ship it", prompt: "Commit the work, push the branch and open a pull request; ask me before force-pushing." },
    { id: "review", title: "Review", prompt: "Review your own diff and list what you would change." },
  ];
  expect(shortcutsOf(withShortcuts(mine))).toEqual(mine);
  expect(shortcutsOf(withShortcuts(structuredClone(DEFAULT_SHORTCUTS).slice(0, 1)))).toEqual([DEFAULT_SHORTCUTS[0]]);
});

test("a shortcut's title and prompt are validated where every other prompt is", () => {
  const ok = { id: "ship", title: "Ship it", prompt: "Open a pull request." };
  expect(shortcutsOf(withShortcuts([ok]))).toEqual([ok]);
  // Trimmed on the way in, like the agent name and the starter prompts.
  expect(shortcutsOf(withShortcuts([{ ...ok, title: "  Ship it  ", prompt: "  Open a pull request.  " }]))).toEqual([ok]);

  refuse(withShortcuts([{ ...ok, title: "" }]));
  refuse(withShortcuts([{ ...ok, title: "   " }]));
  refuse(withShortcuts([{ ...ok, title: "x".repeat(41) }]));
  refuse(withShortcuts([{ ...ok, prompt: "" }]));
  // A newline would submit the text past the echo check that decides about Enter.
  refuse(withShortcuts([{ ...ok, prompt: "First line\nSecond line" }]));
  refuse(withShortcuts([{ ...ok, prompt: "tab\tseparated" }]));
  refuse(withShortcuts([{ ...ok, prompt: "x".repeat(2001) }]));
  // The dashboard does not help switch off an agent's permission checks, here as anywhere else.
  refuse(withShortcuts([{ ...ok, prompt: "Run it with --dangerously-skip-permissions" }]));
  refuse(withShortcuts([{ ...ok, id: "Ship It" }]));
  refuse(withShortcuts([ok, { ...ok, title: "Again" }])); // duplicate ids
  refuse(withShortcuts([{ title: "No id", prompt: "x" }]));
  refuse(withShortcuts("not a list"));
});

test("a config file without shortcuts loads with the shipped ones and is not rewritten by loading", async () => {
  const path = join(home, "config.json");
  const { agentSessions, ...rest } = defaultConfig();
  const { shortcuts: _none, ...withoutShortcuts } = agentSessions;
  const saved = `${JSON.stringify({ ...rest, agentSessions: withoutShortcuts }, null, 2)}\n`;
  await writeFile(path, saved, "utf8");
  const { config, warning } = await loadConfig();
  expect(warning).toBeUndefined();
  expect(config.agentSessions.shortcuts).toEqual([...DEFAULT_SHORTCUTS]);
  expect(await readFile(path, "utf8")).toBe(saved);
  // Saving writes them; emptying the list and saving keeps it empty across a reload.
  await saveConfig({ ...config, agentSessions: { ...config.agentSessions, shortcuts: [] } });
  expect(JSON.parse(await readFile(path, "utf8")).agentSessions.shortcuts).toEqual([]);
  expect((await loadConfig()).config.agentSessions.shortcuts).toEqual([]);
});

const withSuffixes = (promptSuffixes: Record<string, string>, id = "claude") => {
  const agent = { ...CLAUDE_PROFILE, id, promptSuffixes };
  return { ...defaultConfig(), agentSessions: { enabled: true, agents: [agent], defaultAgent: id } };
};
const suffixesOf = (input: unknown) => validateConfig(input).agentSessions.agents[0].promptSuffixes;

test("additional instructions are validated per prompt: {change} is optional, Integrate takes no placeholder", () => {
  const saved = { implement: "Run the linter before you finish.", ship: "Mention {change} in the PR title.", integrate: "Install it for the tools I name." };
  expect(suffixesOf(withSuffixes(saved))).toEqual(saved);

  // A suffix does not have to name the change — unlike the starter prompt it extends.
  expect(suffixesOf(withSuffixes({ draft: "Ask me before you write specs." }))?.draft).toBe("Ask me before you write specs.");
  // Any other placeholder is refused, per key, naming the field.
  expect(() => validateConfig(withSuffixes({ implement: "Work in {repo}." }))).toThrow(/promptSuffixes\.implement: unknown placeholder/);
  // Integrate is substituted into at all, so its suffix may carry no placeholder either.
  expect(() => validateConfig(withSuffixes({ integrate: "Set up {change}." }))).toThrow(/promptSuffixes\.integrate: no placeholder is supported/);
  // The dashboard never helps switch an agent's permission checks off, wherever the text sits.
  expect(() => validateConfig(withSuffixes({ draft: "Run with --dangerously-skip-permissions." }))).toThrow(/promptSuffixes\.draft: must not contain a permission-bypass/);
  // Whitespace only is nothing to append, and is refused rather than stored as a blank line.
  expect(() => validateConfig(withSuffixes({ archive: "   \n  " }))).toThrow(ConfigValidationError);
});

test("a config saved before additional instructions existed loads with none, and a prompt upgrade leaves them alone", async () => {
  // The legacy file has no promptSuffixes key at all: every prompt is composed exactly as it was.
  const path = join(home, "config.json");
  await writeFile(path, `${JSON.stringify(withArchive(FORMER_ARCHIVE), null, 2)}\n`, "utf8");
  const { config, warning } = await loadConfig();
  expect(warning).toBeUndefined();
  expect(config.agentSessions.agents[0].promptSuffixes).toBeUndefined();

  // Upgrading the former Archive prompt rewrites the prompt, never the suffixes beside it.
  const withBoth = { ...withArchive(FORMER_ARCHIVE), agentSessions: { ...withArchive(FORMER_ARCHIVE).agentSessions, agents: [{ ...CLAUDE_PROFILE, prompts: { ...CLAUDE_PROFILE.prompts, archive: FORMER_ARCHIVE }, promptSuffixes: { archive: "Tell me what you archived." } }] } };
  const upgraded = validateConfig(withBoth).agentSessions.agents[0];
  expect(upgraded.prompts.archive).toBe(CLAUDE_PROFILE.prompts.archive);
  expect(upgraded.promptSuffixes).toEqual({ archive: "Tell me what you archived." });
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

test("the Resolve conflicts prompt and its suffix survive a round trip, like Ship's", () => {
  // Without this the key is silently stripped on load, and a configured prompt quietly stops being used.
  const agent = {
    ...CLAUDE_PROFILE,
    prompts: { ...CLAUDE_PROFILE.prompts, resolveConflicts: "Rebase {change} onto the default branch and fix the clashes." },
    promptSuffixes: { resolveConflicts: "We rebase here, never merge." },
  };
  const config = validateConfig({ ...defaultConfig(), agentSessions: { enabled: true, agents: [agent], defaultAgent: "claude" } });
  expect(config.agentSessions.agents[0].prompts.resolveConflicts).toBe("Rebase {change} onto the default branch and fix the clashes.");
  expect(config.agentSessions.agents[0].promptSuffixes?.resolveConflicts).toBe("We rebase here, never merge.");

  // Like Ship, it speaks about the worktree the agent sits in, so naming the change is optional.
  expect(suffixesOf(withSuffixes({ resolveConflicts: "Run the checks before pushing." }))?.resolveConflicts).toBe("Run the checks before pushing.");
  const noChange = { ...CLAUDE_PROFILE, prompts: { ...CLAUDE_PROFILE.prompts, resolveConflicts: "Make this branch merge again." } };
  expect(validateConfig({ ...defaultConfig(), agentSessions: { enabled: true, agents: [noChange], defaultAgent: "claude" } }).agentSessions.agents[0].prompts.resolveConflicts).toBe("Make this branch merge again.");

  // The usual guards still apply to it.
  const bypass = { ...CLAUDE_PROFILE, prompts: { ...CLAUDE_PROFILE.prompts, resolveConflicts: "Fix it with --dangerously-skip-permissions." } };
  expect(() => validateConfig({ ...defaultConfig(), agentSessions: { enabled: true, agents: [bypass], defaultAgent: "claude" } })).toThrow(/permission-bypass/);
  expect(() => validateConfig(withSuffixes({ resolveConflicts: "Work in {repo}." }))).toThrow(/promptSuffixes\.resolveConflicts: unknown placeholder/);
});

test("concurrent config updates are applied one after another, so neither is lost", async () => {
  const a = newRepoConfig("/tmp/serial/a", true);
  const b = newRepoConfig("/tmp/serial/b", false);
  const state = { config: await saveConfig({ ...defaultConfig(), repos: [a, b] }) };
  // The first update is slow: without the queue the second would read the config before the first is saved.
  const slow = updateConfig(state, async (current) => {
    await Bun.sleep(20);
    return { ...current, repos: current.repos.map((r) => (r.id === a.id ? { ...r, enabled: false } : r)) };
  });
  const fast = updateConfig(state, (current) => ({ ...current, repos: current.repos.map((r) => (r.id === b.id ? { ...r, enabled: true } : r)) }));
  await Promise.all([slow, fast]);
  const { config } = await loadConfig();
  expect(config.repos.map((r) => [r.path, r.enabled])).toEqual([
    ["/tmp/serial/a", false],
    ["/tmp/serial/b", true],
  ]);
  expect(state.config).toEqual(config);
});

test("a failed config update reaches its caller, saves nothing and does not block the next one", async () => {
  const state = { config: await saveConfig(defaultConfig()) };
  await expect(updateConfig(state, () => ({ ...state.config, pollIntervalSeconds: 1 }))).rejects.toThrow(ConfigValidationError);
  await expect(
    updateConfig(state, () => {
      throw new Error("refused");
    }),
  ).rejects.toThrow("refused");
  const { previous, saved } = await updateConfig(state, (current) => ({ ...current, pollIntervalSeconds: 30 }));
  expect(previous.pollIntervalSeconds).toBe(60);
  expect(saved.pollIntervalSeconds).toBe(30);
  expect((await loadConfig()).config.pollIntervalSeconds).toBe(30);
  const unchanged = await updateConfig(state, () => undefined);
  expect(unchanged.saved).toBe(unchanged.previous);
});
