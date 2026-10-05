// Auto-merge of docs-only pull requests (agent-sessions, Ship): the read-only check, and what Ship hands the agent.
import { afterAll, afterEach, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { worktreesDir } from "../src/server/paths.ts";
import { shipPrompt } from "../src/server/sessions/agents.ts";
import { shipsOnlyOpenSpec } from "../src/server/sessions/workStatus.ts";
import { ensureWorktree } from "../src/server/sessions/worktree.ts";
import { AUTO_MERGE_NOTICE, reportShip } from "../src/ui/sessionState.ts";
import { useTempHome } from "./helpers.ts";
import { installFakeGh } from "./ghHelpers.ts";
import { git, harness, tempGitRepo, waitFor, watch, type Harness } from "./sessionHelpers.ts";

setDefaultTimeout(30_000);

let cleanup: () => Promise<void>;
const managers: Harness["manager"][] = [];

beforeAll(async () => {
  ({ cleanup } = await useTempHome());
});
afterEach(async () => {
  for (const m of managers.splice(0)) await m.shutdown();
});
afterAll(() => cleanup());

async function worktree(repoPath: string, name: string): Promise<string> {
  const path = join(worktreesDir(), `t-${Math.random().toString(36).slice(2, 8)}`, name);
  await ensureWorktree(repoPath, path, `feat/${name}`);
  return path;
}

async function put(wt: string, file: string, content = "x"): Promise<void> {
  await mkdir(join(wt, file, ".."), { recursive: true });
  await writeFile(join(wt, file), content);
}

const commitAll = (wt: string) => {
  git(wt, "add", "-A");
  git(wt, "commit", "-q", "-m", "work");
};

test("only files under openspec/, committed or not, count as docs-only", async () => {
  const repo = await tempGitRepo();
  const wt = await worktree(repo, "docs");
  await put(wt, "openspec/changes/rotate-keys/proposal.md");
  commitAll(wt);
  expect(await shipsOnlyOpenSpec(wt, "main")).toBe(true);

  // uncommitted on top: a modified tracked file (status starts with a space) and an untracked one, both inside
  await put(wt, "openspec/changes/rotate-keys/proposal.md", "changed");
  await put(wt, "openspec/specs/secrets/spec.md");
  expect(await shipsOnlyOpenSpec(wt, "main")).toBe(true);
});

test("anything outside openspec/ — committed, untracked, look-alike or renamed in — is not docs-only", async () => {
  const repo = await tempGitRepo();
  const cases: [string, (wt: string) => Promise<void>][] = [
    ["committed code", async (wt) => {
      await put(wt, "openspec/changes/rotate-keys/tasks.md");
      await put(wt, "src/keys.ts");
      commitAll(wt);
    }],
    ["an untracked file at the root", async (wt) => {
      await put(wt, "openspec/changes/rotate-keys/tasks.md");
      commitAll(wt);
      await put(wt, "notes.txt");
    }],
    ["look-alike paths", async (wt) => {
      await put(wt, "docs/openspec/notes.md");
      await put(wt, "openspec-notes.md");
      commitAll(wt);
    }],
    ["a staged rename from src/ into openspec/", async (wt) => {
      await put(wt, "src/moved.md", "a file that is renamed");
      commitAll(wt);
      git(wt, "push", "-q", ".", "HEAD:refs/heads/base-with-src");
      await mkdir(join(wt, "openspec"), { recursive: true });
      await rename(join(wt, "src/moved.md"), join(wt, "openspec/moved.md"));
      git(wt, "add", "-A");
    }],
  ];
  for (const [what, make] of cases) {
    const wt = await worktree(repo, what.replace(/[^a-z]+/g, "-").replace(/-$/, ""));
    await make(wt);
    const base = what.startsWith("a staged rename") ? "base-with-src" : "main";
    expect({ what, docsOnly: await shipsOnlyOpenSpec(wt, base) }).toEqual({ what, docsOnly: false });
  }
});

test("an unknown base, an unreadable base and an empty diff fail closed", async () => {
  const repo = await tempGitRepo();
  const wt = await worktree(repo, "closed");
  expect(await shipsOnlyOpenSpec(wt, "main")).toBe(false); // nothing to ship at all
  await put(wt, "openspec/changes/rotate-keys/proposal.md");
  commitAll(wt);
  expect(await shipsOnlyOpenSpec(wt, undefined)).toBe(false);
  expect(await shipsOnlyOpenSpec(wt, "no-such-ref")).toBe(false);
  expect(await shipsOnlyOpenSpec(join(wt, "gone"), "main")).toBe(false);
});

/** A running session of `upgrade-runtime` whose project has the setting as given, with `files` written into it. */
async function shipping(autoMergeDocs: boolean | undefined, files: string[], opts: { resume?: boolean } = {}) {
  const h = await harness();
  h.config.repos[0].agent = { enabled: true, ...(autoMergeDocs === undefined ? {} : { autoMergeDocs }) };
  managers.push(h.manager);
  const s = await h.manager.open({ repoId: h.repoId, change: "upgrade-runtime", action: "implement" });
  const seen = await watch(h.manager, s.id);
  await waitFor(() => seen.text().includes("fake-agent ready"), "the agent");
  for (const file of files) await put(s.worktreePath, file);
  if (opts.resume) {
    h.manager.write(s.id, "exit\r");
    await waitFor(() => h.manager.get(s.id).state === "exited", "exit");
  }
  const agent = h.config.agentSessions.agents[0];
  return { h, s, seen, plain: shipPrompt(agent, "upgrade-runtime"), withAutoMerge: shipPrompt(agent, "upgrade-runtime", { autoMerge: true }) };
}

test("Ship asks for auto-merge in an opted-in project when only OpenSpec documents are shipped", async () => {
  const gh = await installFakeGh();
  try {
    const { h, s, seen, withAutoMerge } = await shipping(true, ["openspec/changes/upgrade-runtime/notes.md", "openspec/specs/runtime/spec.md"]);
    const refs = git(h.repoPath, "for-each-ref");
    const result = await h.manager.ship(s.id);
    expect(result).toMatchObject({ submitted: true, autoMerge: true });
    await waitFor(() => seen.text().includes(`you said: ${withAutoMerge}`), "the ship prompt with the auto-merge instruction");
    // The dashboard itself merged nothing: no gh, no ref moved.
    expect(await gh.calls()).toEqual([]);
    expect(git(h.repoPath, "for-each-ref")).toBe(refs);
  } finally {
    gh.restore();
  }
});

test("Ship asks for auto-merge when it starts an ended agent again, too", async () => {
  const { h, s, seen, withAutoMerge } = await shipping(true, ["openspec/changes/upgrade-runtime/notes.md"], { resume: true });
  expect(await h.manager.ship(s.id)).toMatchObject({ submitted: true, autoMerge: true });
  await waitFor(() => seen.text().includes('args=["--resumed"]') && seen.text().includes(`you said: ${withAutoMerge}`), "resume command plus the prompt");
});

test("Ship's prompt is today's when the project did not opt in, or code is shipped", async () => {
  for (const [autoMergeDocs, files] of [
    [true, ["openspec/changes/upgrade-runtime/notes.md", "src/runtime.ts"]],
    [false, ["openspec/changes/upgrade-runtime/notes.md"]],
    [undefined, ["openspec/changes/upgrade-runtime/notes.md"]],
  ] as const) {
    const { h, s, seen, plain } = await shipping(autoMergeDocs, [...files]);
    expect(await h.manager.ship(s.id)).toMatchObject({ submitted: true, autoMerge: false });
    await waitFor(() => seen.text().includes(`you said: ${plain}`), "the plain ship prompt");
    expect(seen.text()).not.toContain("enable auto-merge");
  }
});

test("both Ship controls report the auto-merge notice only when Ship asked for auto-merge", () => {
  const seen: string[] = [];
  const ui = { reportUnsent: (id?: string) => seen.push(`unsent ${id}`), reportAutoMerge: (id?: string) => seen.push(`autoMerge ${id}`) };
  reportShip(ui, "s1", { submitted: true, autoMerge: true });
  reportShip(ui, "s1", { submitted: true, autoMerge: false });
  reportShip(ui, "s1", { submitted: false, autoMerge: true });
  expect(seen).toEqual(["unsent undefined", "autoMerge s1", "unsent undefined", "autoMerge undefined", "unsent s1", "autoMerge s1"]);
  expect(AUTO_MERGE_NOTICE).toContain("auto-merge");
  expect(AUTO_MERGE_NOTICE).toContain("merges nothing");
});
