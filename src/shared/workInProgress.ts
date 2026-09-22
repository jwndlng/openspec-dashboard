import type { WorkInProgress, Worktree } from "./types.ts";

/** Whether a checkout has modified or untracked items. False for unknown, uninspected and stale checkouts. */
export function hasUncommitted(w: Worktree): boolean {
  return typeof w.status === "object" && w.status.modified + w.status.untracked > 0;
}

/**
 * Roll-up of a repository's checkouts. Derived from the checkouts alone so it can never disagree with them; a checkout
 * with both uncommitted and unpushed work counts once under each.
 */
export function summarizeWorkInProgress(worktrees: Worktree[]): WorkInProgress {
  const summary: WorkInProgress = { worktrees: 0, uncommitted: 0, unpushed: 0, stale: 0, unknown: 0 };
  for (const w of worktrees) {
    if (!w.isMain) summary.worktrees++;
    if (w.prunable) summary.stale++;
    if (w.status === "unknown") summary.unknown++;
    if (hasUncommitted(w)) summary.uncommitted++;
    if ((w.unpushed ?? 0) > 0) summary.unpushed++;
  }
  return summary;
}
