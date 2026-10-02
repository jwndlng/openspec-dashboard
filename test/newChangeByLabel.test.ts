import { afterEach, expect, test } from "bun:test";
import { ApiError, type Api, httpApi, setApi } from "../src/ui/api.ts";
import { createInRepos } from "../src/ui/newChangeForm.tsx";

afterEach(() => setApi(httpApi));

const repos = [
  { id: "a", name: "alpha-infra" },
  { id: "d", name: "demo-ops" },
  { id: "x", name: "zeta-net" },
];

/** A fake backend recording every create and scan; `refuse` maps a repository id to the refusal it answers with. */
function fakeApi(refuse: Record<string, ApiError> = {}, scansBusy = 0) {
  const calls: string[] = [];
  let inFlight = 0;
  let busy = scansBusy;
  const fake: Api = {
    ...httpApi,
    createChange: async (repoId, name, prompt) => {
      inFlight++;
      expect(inFlight).toBe(1);
      calls.push(`create ${repoId} ${name} ${prompt ?? "-"}`);
      await Promise.resolve();
      inFlight--;
      if (refuse[repoId]) throw refuse[repoId];
      return { name, staged: repoId !== "x" };
    },
    scan: async () => {
      calls.push("scan");
      return { started: busy-- <= 0 };
    },
  };
  setApi(fake);
  return calls;
}

test("createInRepos sends one create per repository, one at a time and in order, then one scan", async () => {
  const calls = fakeApi();
  const progress: string[] = [];
  const results = await createInRepos(repos, "bump-terraform-1-9", "Bump to 1.9", (id) => progress.push(id));
  expect(calls).toEqual(["create a bump-terraform-1-9 Bump to 1.9", "create d bump-terraform-1-9 Bump to 1.9", "create x bump-terraform-1-9 Bump to 1.9", "scan"]);
  expect(progress).toEqual(["a", "d", "x"]);
  expect(results).toEqual([
    { repoId: "a", repoName: "alpha-infra", ok: true, staged: true },
    { repoId: "d", repoName: "demo-ops", ok: true, staged: true },
    { repoId: "x", repoName: "zeta-net", ok: true, staged: false },
  ]);
});

test("a refusal is that repository's result and does not stop the others", async () => {
  const calls = fakeApi({ d: new ApiError(409, 'a change named "bump-terraform-1-9" already exists') });
  const results = await createInRepos(repos, "bump-terraform-1-9", undefined);
  expect(calls.filter((c) => c.startsWith("create")).map((c) => c.split(" ")[1])).toEqual(["a", "d", "x"]);
  expect(results[1]).toEqual({ repoId: "d", repoName: "demo-ops", ok: false, message: 'a change named "bump-terraform-1-9" already exists' });
  expect(results[0].ok && results[2].ok).toBe(true);
});

test("the final scan is retried until one starts after the last create", async () => {
  const calls = fakeApi({}, 2);
  const waits: number[] = [];
  await createInRepos(repos.slice(0, 1), "bump", undefined, undefined, async (ms) => {
    waits.push(ms);
  });
  expect(calls).toEqual(["create a bump -", "scan", "scan", "scan"]);
  expect(waits.length).toBe(2);
});

test("no scan is asked for when every repository refused", async () => {
  const refusal = new ApiError(409, "repository has not been successfully scanned");
  const calls = fakeApi({ a: refusal, d: refusal, x: refusal });
  const results = await createInRepos(repos, "bump", undefined);
  expect(results.every((r) => !r.ok)).toBe(true);
  expect(calls).not.toContain("scan");
});
