// Why an in-place change session runs in the repository folder itself. Two cases: a tracked folder that is not a git
// repository, and a git repository with no commit yet, which has nothing to branch a worktree from.

/** `isGit` is the repository's scan result; unknown (no snapshot yet) reads as "not a git repository", today's wording. */
export function inPlaceReason(path: string, isGit: boolean | undefined): string {
  return isGit
    ? `${path} has no commit yet, so there is no branch to work on and the agent works in the checkout itself. There is no branch of its own and no undo.`
    : `${path} is not a git repository, so the agent works in the folder itself. There is no branch, no commit and no undo.`;
}

/** The end-session dialog's words for what stays behind in that folder, after its path. */
export function inPlaceLeftover(isGit: boolean | undefined): string {
  return isGit
    ? ", the repository's own checkout, which has no commit yet: there is no worktree to remove and nothing to merge."
    : ", which is not a git repository: there is no worktree to remove and nothing to merge.";
}
