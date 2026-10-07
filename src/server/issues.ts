// Open issues of a tracked repository, read through the user's own GitHub CLI so they can be imported as changes
// (openspec/specs/issue-import).
//
// Next to the pull-request query this is the one other `gh` call the dashboard makes: `gh issue list`, read-only,
// run the same way (gh.ts: no shell, the dashboard home as working directory, the repository named with `--repo`,
// prompts disabled, a timeout) and only because the user opened the Import from issues dialog or refreshed it. It runs
// no git command but the read-only `config --get remote.origin.url`, writes nothing — not even a cache: the list lives
// in memory for the one response — and changes nothing on GitHub.
import type { GithubIssue, RepoIssues } from "../shared/types.ts";
import { failureOf, GH_TIMEOUT_MS, githubRepoFromRemote, runGh } from "./gh.ts";
import { originUrl } from "./git.ts";
import type { RepoTarget } from "./pullRequests.ts";

/** Open issues per repository; one more is asked for, to notice the limit was reached. */
export const ISSUE_LIMIT = 100;
/** Only the documented `--json` fields; anything else is parsed defensively or ignored. */
const FIELDS = "number,title,body,url,author,labels,createdAt,updatedAt";

const str = (value: unknown): string => (typeof value === "string" ? value : "");

/** One entry of `gh issue list --json …`, or undefined when it carries no usable number. */
export function parseIssue(raw: unknown): GithubIssue | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const entry = raw as Record<string, unknown>;
  const number = entry.number;
  if (typeof number !== "number" || !Number.isSafeInteger(number) || number <= 0) return undefined;
  const author = entry.author && typeof entry.author === "object" ? str((entry.author as Record<string, unknown>).login) : "";
  const labels = Array.isArray(entry.labels)
    ? entry.labels.map((label) => (label && typeof label === "object" ? str((label as Record<string, unknown>).name) : "")).filter((name) => name !== "")
    : [];
  const issue: GithubIssue = { number, title: str(entry.title), body: str(entry.body), url: str(entry.url), author, labels, createdAt: str(entry.createdAt) };
  const updatedAt = str(entry.updatedAt);
  if (updatedAt) issue.updatedAt = updatedAt;
  return issue;
}

/**
 * Lists issues on request. Holds nothing between requests but the queries still running, so that a second request
 * for the same repository waits for the running `gh` rather than starting another.
 */
export class Issues {
  private readonly inFlight = new Map<string, Promise<RepoIssues>>();
  private readonly now: () => number;
  private readonly timeoutMs: number;

  /** `timeoutMs` is only lowered by tests, which must not wait half a minute for the real one. */
  constructor(options: { now?: () => number; timeoutMs?: number } = {}) {
    this.now = options.now ?? Date.now;
    this.timeoutMs = options.timeoutMs ?? GH_TIMEOUT_MS;
  }

  list(target: RepoTarget): Promise<RepoIssues> {
    const running = this.inFlight.get(target.id);
    if (running) return running;
    const done = this.query(target).finally(() => this.inFlight.delete(target.id));
    this.inFlight.set(target.id, done);
    return done;
  }

  private async query(target: RepoTarget): Promise<RepoIssues> {
    // Not on GitHub is decided before `gh` is even looked up: no process for a repository that has no issues to list.
    if (!target.isGit) return { repoId: target.id, status: "unavailable", reason: "not a git repository", issues: [] };
    const github = githubRepoFromRemote(await originUrl(target.path));
    if (!github) return { repoId: target.id, status: "unavailable", reason: "not on GitHub", issues: [] };

    const run = await runGh(["issue", "list", "--repo", github, "--state", "open", "--limit", String(ISSUE_LIMIT + 1), "--json", FIELDS], this.timeoutMs);
    const failure = failureOf(run, "list issues");
    if (failure) return { repoId: target.id, github, status: failure.kind, reason: failure.reason, setup: failure.setup, issues: [] };
    let raw: unknown;
    try {
      raw = JSON.parse(run.out || "[]");
    } catch {
      return { repoId: target.id, github, status: "failed", reason: "gh returned output that is not JSON", issues: [] };
    }
    if (!Array.isArray(raw)) return { repoId: target.id, github, status: "failed", reason: "gh returned output that is not a list", issues: [] };
    const issues = raw
      .slice(0, ISSUE_LIMIT)
      .map(parseIssue)
      .filter((issue): issue is GithubIssue => issue !== undefined)
      // Newest first, whatever order `gh` chose; the number breaks ties.
      .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) || b.number - a.number);
    return {
      repoId: target.id,
      github,
      status: "ok",
      fetchedAt: new Date(this.now()).toISOString(),
      truncated: raw.length > ISSUE_LIMIT,
      issues,
    };
  }
}
