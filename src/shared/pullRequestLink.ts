// Which cached pull request belongs to a change (openspec/specs/pull-requests: "A pull request is linked to a change
// by its head branch"). Derived on display, never stored: the card, the detail header and the tests share this one rule
// so they can never disagree. Pure and total — whatever an older cache wrote, it answers or returns undefined.
import type { ChangeSnapshot, PullRequest, RepoPullRequests } from "./types.ts";

/** When a pull request last moved: merged or closed if it has, else opened; 0 when no date can be read. */
function lastMoved(pr: Partial<PullRequest>): number {
  for (const at of [pr.mergedAt, pr.closedAt, pr.createdAt]) {
    if (typeof at !== "string") continue;
    const t = Date.parse(at);
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

/** Open (drafts included) before anything else, then the most recently merged, closed or opened, then the higher number. */
function better(a: PullRequest, b: PullRequest): PullRequest {
  const openA = a.state === "open";
  const openB = b.state === "open";
  if (openA !== openB) return openA ? a : b;
  const byTime = lastMoved(a) - lastMoved(b);
  if (byTime !== 0) return byTime > 0 ? a : b;
  return (Number(a.number) || 0) >= (Number(b.number) || 0) ? a : b;
}

/**
 * The change's pull request: one of its own repository's cached pull requests whose head branch is exactly the change's
 * `branchMatch`, compared as written. No containment, no normalisation, nothing read from a title — showing someone
 * else's pull request is worse than showing none. A repository whose pull requests are unavailable links nothing.
 */
export function linkedPullRequest(
  change: Pick<ChangeSnapshot, "repoId" | "branchMatch">,
  lists: readonly RepoPullRequests[] | undefined,
): PullRequest | undefined {
  const branch = change.branchMatch;
  if (typeof branch !== "string" || branch === "" || !Array.isArray(lists)) return undefined;
  let best: PullRequest | undefined;
  for (const list of lists) {
    if (!list || list.repoId !== change.repoId || list.status === "unavailable" || !Array.isArray(list.pullRequests)) continue;
    for (const pr of list.pullRequests) {
      if (!pr || typeof pr !== "object" || pr.head !== branch) continue;
      best = best ? better(best, pr) : pr;
    }
  }
  return best;
}
