// The Pull requests view's pure parts: filters ↔ URL, de-duplicating repositories that share a GitHub repository,
// grouping into open and recently closed, sorting, and the counts the overview and the board header show.
// Free of DOM access at import time, so it can be unit-tested.
import type { PullRequest, PullRequestsResponse, RepoPullRequests } from "../shared/types.ts";

export type PrStateFilter = "open" | "closed" | "all";

export interface PrFilters {
  /** A repository id; unset means every enabled repository. */
  repo?: string;
  /** `all` shows both groups, which is the default. */
  state: PrStateFilter;
  /** Only pull requests whose review is requested from the signed-in user. */
  mine: boolean;
}

export const DEFAULT_PR_FILTERS: PrFilters = { state: "all", mine: false };

export function parsePrFilters(search: string): PrFilters {
  const p = new URLSearchParams(search);
  const state = p.get("state");
  return {
    repo: p.get("repo") || undefined,
    state: state === "open" || state === "closed" ? state : "all",
    mine: p.get("mine") === "1",
  };
}

/** Defaults are omitted, so a plain `/pull-requests` stays a plain `/pull-requests`. */
export function serializePrFilters(filters: PrFilters): string {
  const p = new URLSearchParams();
  if (filters.repo) p.set("repo", filters.repo);
  if (filters.state !== "all") p.set("state", filters.state);
  if (filters.mine) p.set("mine", "1");
  const text = p.toString();
  return text ? `?${text}` : "";
}

/** The query that opens the view filtered to one repository, as the overview and the board header link to it. */
export function pullRequestsQuery(repoId: string): string {
  return serializePrFilters({ ...DEFAULT_PR_FILTERS, repo: repoId });
}

/** A repository as the view knows it: the name and order come from the snapshot, the list from the API. */
export interface PrRepo {
  id: string;
  name: string;
}

export interface PrEntry {
  pr: PullRequest;
  /** The repository this entry is listed under: the first, in the view's order, of those sharing the GitHub repository. */
  repoId: string;
  repoName: string;
  github?: string;
  /** Names of the other tracked repositories that are clones of the same GitHub repository. */
  alsoIn: string[];
}

export interface PrGroups {
  open: PrEntry[];
  closed: PrEntry[];
}

/** When a pull request last moved: merged or closed if it has, else opened. */
export function prTime(pr: PullRequest): number {
  const t = Date.parse(pr.mergedAt ?? pr.closedAt ?? pr.createdAt);
  return Number.isNaN(t) ? 0 : t;
}

/** The moment an entry is shown with: its age in the list it appears in. */
export function prAgeAt(pr: PullRequest): string | undefined {
  return pr.state === "open" ? pr.createdAt : (pr.mergedAt ?? pr.closedAt ?? pr.createdAt);
}

const newestFirst = (a: PrEntry, b: PrEntry) => prTime(b.pr) - prTime(a.pr) || b.pr.number - a.pr.number;

/** The response's entries for the repositories the filter allows, in the order the repositories are given. */
function shown(response: PullRequestsResponse, repos: PrRepo[], filters: PrFilters): { repo: PrRepo; list: RepoPullRequests }[] {
  const byId = new Map(response.repos.map((r) => [r.repoId, r]));
  return repos
    .filter((repo) => filters.repo === undefined || repo.id === filters.repo)
    .flatMap((repo) => {
      const list = byId.get(repo.id);
      return list ? [{ repo, list }] : [];
    });
}

/**
 * One entry per pull request: two clones of one project would otherwise list everything twice, so a pull request is
 * kept under the first repository that has it and the other names go into `alsoIn`.
 */
export function pullRequestEntries(response: PullRequestsResponse, repos: PrRepo[], filters: PrFilters = DEFAULT_PR_FILTERS): PrGroups {
  const entries = new Map<string, PrEntry>();
  for (const { repo, list } of shown(response, repos, filters)) {
    for (const pr of list.pullRequests) {
      const key = `${list.github ?? repo.id}#${pr.number}`;
      const seen = entries.get(key);
      if (seen) {
        if (!seen.alsoIn.includes(repo.name)) seen.alsoIn.push(repo.name);
        continue;
      }
      entries.set(key, { pr, repoId: repo.id, repoName: repo.name, github: list.github, alsoIn: [] });
    }
  }
  const wanted = [...entries.values()].filter((e) => !filters.mine || (e.pr.reviewRequestedFromViewer && e.pr.state === "open"));
  return {
    open: filters.state === "closed" ? [] : wanted.filter((e) => e.pr.state === "open").sort(newestFirst),
    closed: filters.state === "open" ? [] : wanted.filter((e) => e.pr.state !== "open").sort(newestFirst),
  };
}

export interface PrNotice {
  repoId: string;
  repoName: string;
  status: RepoPullRequests["status"];
  reason?: string;
  fetchedAt?: string;
  /** A list is still shown for this repository, from an earlier fetch. */
  hasList: boolean;
}

/**
 * Repositories with nothing to list and something to say. Those blocked by the machine's `gh` are left out: the view
 * explains that once, with `ghSetup`, rather than repeating it per repository.
 */
export function pullRequestNotices(response: PullRequestsResponse, repos: PrRepo[], filters: PrFilters = DEFAULT_PR_FILTERS): PrNotice[] {
  return shown(response, repos, filters)
    .filter(({ list }) => (list.status === "unavailable" || list.status === "failed") && !list.setup)
    .map(({ repo, list }) => ({ repoId: repo.id, repoName: repo.name, status: list.status, reason: list.reason, fetchedAt: list.fetchedAt, hasList: list.pullRequests.length > 0 }));
}

export interface GhSetup {
  kind: "gh-missing" | "gh-signed-out";
  what: string;
  how: string;
}

/** The one explanation the view shows when the machine's `gh` is the problem, rather than any single repository. */
export function ghSetup(response: PullRequestsResponse): GhSetup | undefined {
  const kind = response.repos.find((r) => r.setup)?.setup;
  if (kind === "gh-missing") return { kind, what: "The GitHub CLI is not installed.", how: "Install gh (cli.github.com), then refresh." };
  if (kind === "gh-signed-out") return { kind, what: "The GitHub CLI is not signed in.", how: "Run gh auth login in a terminal, then refresh." };
  return undefined;
}

/** When the shown lists were last fetched: the newest of them, so the age in the header is not an old repository's. */
export function newestFetchedAt(response: PullRequestsResponse): string | undefined {
  let best: string | undefined;
  for (const repo of response.repos) {
    if (repo.fetchedAt && (!best || Date.parse(repo.fetchedAt) > Date.parse(best))) best = repo.fetchedAt;
  }
  return best;
}

/** Whether any shown list is old enough to be worth fetching again when a view opens. */
export function isStale(response: PullRequestsResponse | undefined, freshnessMs: number, now = Date.now()): boolean {
  if (!response) return true;
  const queryable = response.repos.filter((r) => r.github !== undefined);
  if (queryable.length === 0) return false;
  return queryable.some((r) => !r.fetchedAt || now - Date.parse(r.fetchedAt) >= freshnessMs);
}

export interface PrCount {
  /** Open pull requests of this repository; undefined when there is no list to count. */
  open?: number;
  /** Of those, the ones whose review is requested from the signed-in user. */
  awaitingMe: number;
  fetchedAt?: string;
  /** Why there is no count, for the placeholder's tooltip. */
  reason?: string;
}

/** What the overview's column and the board header's control read; never a reason to contact GitHub. */
export function openCount(response: PullRequestsResponse | undefined, repoId: string): PrCount {
  const list = response?.repos.find((r) => r.repoId === repoId);
  if (!list) return { awaitingMe: 0, reason: "pull requests have not been fetched yet" };
  if (list.status === "never") return { awaitingMe: 0, reason: "pull requests have not been fetched yet" };
  if (list.pullRequests.length === 0 && list.status !== "ok") return { awaitingMe: 0, reason: list.reason };
  const open = list.pullRequests.filter((pr) => pr.state === "open");
  return { open: open.length, awaitingMe: open.filter((pr) => pr.reviewRequestedFromViewer).length, fetchedAt: list.fetchedAt, reason: list.reason };
}
