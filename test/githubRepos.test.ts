import { afterAll, beforeAll, expect, test } from "bun:test";
import { listGithubRepos } from "../src/server/gh.ts";
import { dashboardHome } from "../src/server/paths.ts";
import { ghRepo, installFakeGh, type GhHarness } from "./ghHelpers.ts";
import { useTempHome } from "./helpers.ts";

let cleanupHome: () => Promise<void>;
let gh: GhHarness;

const SCENARIO = {
  login: "jdoe",
  owners: {
    jdoe: [
      ghRepo({ nameWithOwner: "jdoe/alpha-infra", description: "Infrastructure", pushedAt: "2026-09-01T10:00:00Z" }),
      ghRepo({ nameWithOwner: "jdoe/demo-ops", description: "Operations", isPrivate: true, pushedAt: "2026-10-01T10:00:00Z" }),
      { nameWithOwner: "not a repo" },
    ],
    acme: [ghRepo({ nameWithOwner: "acme/beta-soc", isArchived: true })],
  },
};

beforeAll(async () => {
  cleanupHome = (await useTempHome()).cleanup;
  gh = await installFakeGh(SCENARIO);
});
afterAll(async () => {
  gh.restore();
  await cleanupHome();
});

test("without an owner the signed-in account is listed, newest push first, and only gh api user and gh repo list run", async () => {
  await gh.forget();
  const list = await listGithubRepos(undefined, new Set(["jdoe/demo-ops"]));
  expect(list.status).toBe("ok");
  expect(list.owner).toBe("jdoe");
  expect(list.truncated).toBe(false);
  expect(list.repos).toEqual([
    { repo: "jdoe/demo-ops", description: "Operations", private: true, archived: false, pushedAt: "2026-10-01T10:00:00Z", added: true },
    { repo: "jdoe/alpha-infra", description: "Infrastructure", private: false, archived: false, pushedAt: "2026-09-01T10:00:00Z", added: false },
  ]);
  const calls = await gh.calls();
  expect(calls.map((c) => c.argv.slice(0, 3))).toEqual([
    ["api", "user", "--jq"],
    ["repo", "list", "jdoe"],
  ]);
  expect(calls.every((c) => c.cwd.endsWith(dashboardHome().split("/").at(-1) ?? ""))).toBe(true);
});

test("another owner is listed without asking who is signed in", async () => {
  await gh.forget();
  const list = await listGithubRepos("acme", new Set());
  expect(list.owner).toBe("acme");
  expect(list.repos.map((r) => [r.repo, r.archived])).toEqual([["acme/beta-soc", true]]);
  expect((await gh.calls()).map((c) => c.argv[0])).toEqual(["repo"]);
});

test("signed out, failed and missing gh each say so", async () => {
  await gh.scenario({ ...SCENARIO, mode: "not-logged-in" });
  const signedOut = await listGithubRepos(undefined, new Set());
  expect(signedOut).toMatchObject({ status: "unavailable", setup: "gh-signed-out", repos: [] });
  expect(signedOut.reason).toContain("gh auth login");

  await gh.scenario({ ...SCENARIO, perRepo: { acme: { mode: "fail", stderr: "gh: Could not resolve to a User with the login of 'acme'. https://jdoe:ghp_secret@example.test" } } });
  const failed = await listGithubRepos("acme", new Set());
  expect(failed.status).toBe("failed");
  expect(failed.reason).toContain("Could not resolve");
  expect(failed.reason).not.toContain("ghp_secret");
  await gh.scenario(SCENARIO);

  const path = process.env.PATH;
  process.env.PATH = "/nonexistent";
  await gh.forget();
  try {
    const missing = await listGithubRepos(undefined, new Set());
    expect(missing).toMatchObject({ status: "unavailable", setup: "gh-missing", repos: [] });
    expect(missing.reason).toContain("install gh");
  } finally {
    process.env.PATH = path;
  }
  expect(await gh.calls()).toEqual([]);
});
