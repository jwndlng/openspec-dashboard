import { expect, test } from "bun:test";
import type { PullRequest, PullRequestsResponse } from "../src/shared/types.ts";
import {
  DEFAULT_PR_FILTERS,
  ghSetup,
  isStale,
  newestFetchedAt,
  openCount,
  parsePrFilters,
  pullRequestEntries,
  pullRequestNotices,
  pullRequestsQuery,
  serializePrFilters,
} from "../src/ui/pullRequestsState.ts";

const DAY = 24 * 3600_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const pr = (patch: Partial<PullRequest> & { number: number }): PullRequest => ({
  title: `change ${patch.number}`,
  url: `https://github.com/acme/alpha-infra/pull/${patch.number}`,
  author: "octo",
  head: `feat/change-${patch.number}`,
  base: "main",
  draft: false,
  state: "open",
  createdAt: ago(DAY),
  review: "none",
  reviewRequestedFromViewer: false,
  checks: "none",
  ...patch,
});

const REPOS = [
  { id: "alpha", name: "alpha-infra" },
  { id: "alpha-clone", name: "alpha-infra-2" },
  { id: "beta", name: "beta-soc" },
  { id: "notes", name: "plain-notes" },
];

const response = (): PullRequestsResponse => ({
  viewer: "demo-user",
  repos: [
    {
      repoId: "alpha",
      github: "acme/alpha-infra",
      status: "ok",
      fetchedAt: ago(3 * 60_000),
      pullRequests: [pr({ number: 1, createdAt: ago(2 * DAY), draft: true }), pr({ number: 2, createdAt: ago(2 * 3600_000), review: "approved", checks: "passing" })],
    },
    // A second clone of the same GitHub repository: the API repeats the list, the view must not.
    { repoId: "alpha-clone", github: "acme/alpha-infra", status: "ok", fetchedAt: ago(3 * 60_000), pullRequests: [pr({ number: 1, createdAt: ago(2 * DAY), draft: true }), pr({ number: 2, createdAt: ago(2 * 3600_000) })] },
    {
      repoId: "beta",
      github: "acme/beta-soc",
      status: "ok",
      fetchedAt: ago(60_000),
      pullRequests: [pr({ number: 42, url: "https://github.com/acme/beta-soc/pull/42", reviewRequestedFromViewer: true }), pr({ number: 40, state: "merged", mergedAt: ago(4 * 3600_000) })],
    },
    { repoId: "notes", status: "unavailable", reason: "not a git repository", pullRequests: [] },
  ],
});

test("filters round-trip through the query string, with the defaults omitted", () => {
  expect(parsePrFilters("")).toEqual(DEFAULT_PR_FILTERS);
  expect(serializePrFilters(DEFAULT_PR_FILTERS)).toBe("");
  const filters = { repo: "beta", state: "open" as const, mine: true };
  expect(serializePrFilters(filters)).toBe("?repo=beta&state=open&mine=1");
  expect(parsePrFilters(serializePrFilters(filters))).toEqual(filters);
  // An unknown state falls back to showing both groups.
  expect(parsePrFilters("?state=nonsense").state).toBe("all");
  expect(pullRequestsQuery("beta")).toBe("?repo=beta");
});

test("open pull requests come first, newest first, and recently closed ones follow", () => {
  const groups = pullRequestEntries(response(), REPOS);
  expect(groups.open.map((e) => e.pr.number)).toEqual([2, 42, 1]);
  expect(groups.closed.map((e) => e.pr.number)).toEqual([40]);
  expect(groups.open.map((e) => e.repoName)).toEqual(["alpha-infra", "beta-soc", "alpha-infra"]);
});

test("a pull request of two clones is listed once, under the first repository, with the other named", () => {
  const groups = pullRequestEntries(response(), REPOS);
  expect(groups.open.filter((e) => e.pr.number === 1)).toHaveLength(1);
  expect(groups.open.find((e) => e.pr.number === 1)?.alsoIn).toEqual(["alpha-infra-2"]);
  expect(groups.open.find((e) => e.pr.number === 42)?.alsoIn).toEqual([]);
});

test("the repository filter shows only that repository, even for a shared GitHub repository", () => {
  const onlyBeta = pullRequestEntries(response(), REPOS, { ...DEFAULT_PR_FILTERS, repo: "beta" });
  expect(onlyBeta.open.map((e) => e.pr.number)).toEqual([42]);
  expect(onlyBeta.closed.map((e) => e.pr.number)).toEqual([40]);
  // The second clone on its own still shows the shared project's pull requests.
  const onlyClone = pullRequestEntries(response(), REPOS, { ...DEFAULT_PR_FILTERS, repo: "alpha-clone" });
  expect(onlyClone.open.map((e) => e.pr.number)).toEqual([2, 1]);
  expect(onlyClone.open[0].repoName).toBe("alpha-infra-2");
});

test("the state and review filters combine with the repository filter", () => {
  expect(pullRequestEntries(response(), REPOS, { ...DEFAULT_PR_FILTERS, state: "open" }).closed).toEqual([]);
  expect(pullRequestEntries(response(), REPOS, { ...DEFAULT_PR_FILTERS, state: "closed" }).open).toEqual([]);
  const mine = pullRequestEntries(response(), REPOS, { ...DEFAULT_PR_FILTERS, mine: true });
  expect(mine.open.map((e) => e.pr.number)).toEqual([42]);
  expect(mine.closed).toEqual([]);
  expect(pullRequestEntries(response(), REPOS, { repo: "alpha", state: "all", mine: true }).open).toEqual([]);
});

test("unavailable and failed repositories become notices, not entries", () => {
  const answer = response();
  answer.repos[0] = { ...answer.repos[0], status: "failed", reason: "gh timed out" };
  const notices = pullRequestNotices(answer, REPOS);
  expect(notices).toEqual([
    { repoId: "alpha", repoName: "alpha-infra", status: "failed", reason: "gh timed out", fetchedAt: answer.repos[0].fetchedAt, hasList: true },
    { repoId: "notes", repoName: "plain-notes", status: "unavailable", reason: "not a git repository", hasList: false },
  ]);
  // A failed repository keeps showing its last good list.
  expect(pullRequestEntries(answer, REPOS).open.map((e) => e.pr.number)).toEqual([2, 42, 1]);
});

test("a machine-wide gh problem is explained once, and lists no repository as failing", () => {
  const answer = response();
  answer.repos = answer.repos.map((r) => (r.github ? { ...r, status: "unavailable" as const, reason: "GitHub CLI not installed", setup: "gh-missing" as const, pullRequests: [] } : r));
  expect(ghSetup(answer)?.kind).toBe("gh-missing");
  expect(ghSetup(answer)?.how).toContain("cli.github.com");
  expect(pullRequestNotices(answer, REPOS).map((n) => n.repoId)).toEqual(["notes"]);

  const out = response();
  out.repos = out.repos.map((r) => (r.github ? { ...r, status: "unavailable" as const, reason: "not signed in", setup: "gh-signed-out" as const } : r));
  expect(ghSetup(out)?.how).toContain("gh auth login");
  expect(ghSetup(response())).toBeUndefined();
});

test("the fetch age is the newest of the shown lists, and staleness ignores repositories that cannot be queried", () => {
  expect(newestFetchedAt(response())).toBe(response().repos[2].fetchedAt);
  expect(isStale(response(), 5 * 60_000)).toBe(false);
  expect(isStale(response(), 60_000)).toBe(true);
  expect(isStale(undefined, 5 * 60_000)).toBe(true);
  // Only repositories that are not on GitHub: nothing could be fetched, so nothing is stale.
  expect(isStale({ repos: [{ repoId: "notes", status: "unavailable", pullRequests: [] }] }, 5 * 60_000)).toBe(false);
  expect(isStale({ repos: [{ repoId: "alpha", github: "acme/alpha-infra", status: "never", pullRequests: [] }] }, 5 * 60_000)).toBe(true);
});

test("the overview's count is the open pull requests, with those awaiting the user's review", () => {
  const answer = response();
  expect(openCount(answer, "beta")).toEqual({ open: 1, awaitingMe: 1, fetchedAt: answer.repos[2].fetchedAt, reason: undefined });
  expect(openCount(answer, "alpha").open).toBe(2);
  expect(openCount(answer, "notes")).toEqual({ awaitingMe: 0, reason: "not a git repository" });
  expect(openCount(answer, "unknown").reason).toContain("not been fetched");
  expect(openCount(undefined, "alpha").open).toBeUndefined();
  // A failed repository with an earlier list still shows that list's count.
  answer.repos[0] = { ...answer.repos[0], status: "failed", reason: "gh timed out" };
  expect(openCount(answer, "alpha")).toMatchObject({ open: 2, reason: "gh timed out" });
});
