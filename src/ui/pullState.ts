// Pure helpers for the pull action's UI: how an outcome reads, and what the off-default-branch notice says.
import type { PullResult, RepoSnapshot } from "../shared/types.ts";

export interface PullOutcome {
  label: string;
  tone: "" | "ok" | "warn" | "danger";
  /** Tooltip: the reason in full, and anything else worth knowing. */
  detail: string;
}

const HOOKS_NOTE = "The repository's post-merge hook was not run — the dashboard never runs hooks.";

export function pullOutcome(result: PullResult): PullOutcome {
  // git's own sentences often end with a period already
  const why = (result.reason ?? "no reason given").replace(/[.\s]+$/, "");
  const hooks = result.hooksSkipped ? ` ${HOOKS_NOTE}` : "";
  switch (result.update) {
    case "fast-forwarded": {
      const n = result.commits ?? 0;
      return { label: `+${n} ${n === 1 ? "commit" : "commits"}`, tone: "ok", detail: `Fast-forwarded ${result.branch ?? "the checkout"} to ${result.upstream ?? "its upstream"}.${hooks}` };
    }
    case "up-to-date":
      return { label: "up to date", tone: "", detail: `${result.branch ?? "The checkout"} already has everything from ${result.upstream ?? "its upstream"}.` };
    case "skipped":
      return result.fetched
        ? { label: "fetched only", tone: "warn", detail: `Fetched, but the checkout was not updated: ${why}.` }
        : { label: "nothing to pull", tone: "", detail: result.reason ?? "" };
    case "refused":
      return { label: "refused", tone: "warn", detail: `Fetched, but the checkout was left as it is: ${why}.` };
    case "failed":
      return { label: "failed", tone: "danger", detail: `Could not fetch: ${why}.` };
  }
}

/**
 * Whether an outcome has to be put in front of the user rather than just badged. True exactly when the main checkout
 * was left behind — fetched only, refused, or failed — which is the outdated view a pull was asked for to prevent;
 * a fast-forward, an up-to-date checkout and a repository with no remote need no second look.
 */
export function pullNeedsReport(result: PullResult): boolean {
  const { tone } = pullOutcome(result);
  return tone === "warn" || tone === "danger";
}

export interface BranchNotice {
  /** For a badge in a row. */
  short: string;
  /** For the repository header and tooltips. */
  long: string;
}

/** Undefined when the repository is on its default branch, or when nobody can tell what the default branch is. */
export function branchNotice(repo: Pick<RepoSnapshot, "currentBranch" | "defaultBranch" | "onDefaultBranch">): BranchNotice | undefined {
  if (repo.onDefaultBranch !== false || !repo.defaultBranch) return undefined;
  const where = repo.currentBranch ? `on ${repo.currentBranch}` : "on a detached HEAD";
  return {
    short: `${where}, not ${repo.defaultBranch}`,
    long: `This checkout is ${where}, not ${repo.defaultBranch}. Archived changes, specs and progress shown for this repository come from that branch and may be outdated. Changes that live in worktrees are read from their own checkouts and are not affected.`,
  };
}
