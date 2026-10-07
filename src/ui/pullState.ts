// Pure helpers for the pull action's UI: how an outcome reads, what a blocked pull's files mean, and what the
// off-default-branch notice says.
import type { PullBlockingFile, PullResult, RepoSnapshot } from "../shared/types.ts";

export interface PullOutcome {
  label: string;
  tone: "" | "success" | "warning" | "danger";
  /** Tooltip: the reason in full, and anything else worth knowing. */
  detail: string;
}

const HOOKS_NOTE = "The repository's post-merge hook was not run — the dashboard never runs hooks.";
const LEFTOVERS_NOTE = "They are all leftovers of changes created here; Resolve and pull can replace them.";

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

export function pullOutcome(result: PullResult): PullOutcome {
  // git's own sentences often end with a period already
  const why = (result.reason ?? "no reason given").replace(/[.\s]+$/, "");
  const hooks = result.hooksSkipped ? ` ${HOOKS_NOTE}` : "";
  switch (result.update) {
    case "fast-forwarded": {
      const n = result.commits ?? 0;
      const replaced = result.resolved?.length ? ` ${count(result.resolved.length, "leftover file")} ${result.resolved.length === 1 ? "was" : "were"} replaced with the incoming version.` : "";
      return { label: `+${n} ${n === 1 ? "commit" : "commits"}`, tone: "success", detail: `Fast-forwarded ${result.branch ?? "the checkout"} to ${result.upstream ?? "its upstream"}.${replaced}${hooks}` };
    }
    case "up-to-date":
      return { label: "up to date", tone: "", detail: `${result.branch ?? "The checkout"} already has everything from ${result.upstream ?? "its upstream"}.` };
    case "skipped":
      return result.fetched
        ? { label: "fetched only", tone: "warning", detail: `Fetched, but the checkout was not updated: ${why}.` }
        : { label: "nothing to pull", tone: "", detail: result.reason ?? "" };
    case "refused": {
      // A resolve never fetches, so it must not claim it did.
      const lead = result.fetched ? "Fetched, but the checkout was left as it is" : "The checkout was left as it is";
      const files = result.blocking?.length ?? 0;
      if (files === 0) return { label: "refused", tone: "warning", detail: `${lead}: ${why}.` };
      const blocked = `${lead}: ${count(files, "uncommitted file")} the incoming commits also change.`;
      if (result.resolvable) return { label: "blocked by leftovers", tone: "warning", detail: `${blocked} ${LEFTOVERS_NOTE}` };
      return { label: "blocked", tone: "warning", detail: `${blocked} ${why}.` };
    }
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
  return tone === "warning" || tone === "danger";
}

/** What one blocking file is, in the words the confirmation shows next to its path. */
export function blockingNote(file: PullBlockingFile): string {
  if (file.kind !== "leftover") return "your own uncommitted work — it is never touched";
  return file.differs ? "leftover, differs from the incoming version — a copy will be kept" : "leftover, the same as the incoming version";
}

/** The one line above the Resolve and pull button: what confirming does, counted. */
export function resolveSummary(files: PullBlockingFile[]): string {
  const differing = files.filter((f) => f.differs).length;
  const copies = differing === 0 ? "Nothing differs, so no copy is needed." : `${count(differing, "file")} ${differing === 1 ? "differs" : "differ"}; a copy of each is saved under ~/.spec-control/ first.`;
  return `Replaces ${count(files.length, "file")} with the version the incoming commits bring, then fast-forwards. ${copies}`;
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
