// DOM-free logic of dismissing a change (openspec/specs/change-dismissal): whether the detail header offers it, and
// what the confirmation and the notice afterwards say. The server decides; this only keeps the UI honest about it.
import type { ChangeSnapshot, DismissPreview, DismissResult } from "../shared/types.ts";

export type DismissOffer = { shown: false } | { shown: true; disabledReason?: string };

/**
 * Offered for an active change the snapshot places in the main checkout — its own checkout or one of its others. A
 * change without checkout information (no git, or a snapshot from an older version) is offered; the server decides.
 * Held only by linked worktrees: shown disabled, naming the worktree.
 */
export function dismissOffer(change: ChangeSnapshot): DismissOffer {
  if (change.archived) return { shown: false };
  const checkouts = [change.checkout, ...(change.otherCheckouts ?? [])].filter((c) => c !== undefined);
  if (checkouts.length === 0 || checkouts.some((c) => c.isMain)) return { shown: true };
  const holder = checkouts[0];
  return {
    shown: true,
    disabledReason: `This change lives only in the worktree ${holder.branch ? `on ${holder.branch}` : holder.path}; it leaves the board when that worktree is removed.`,
  };
}

export function lostFiles(preview: DismissPreview): number {
  return preview.files.filter((f) => f.state === "lost").length;
}

/** The warning above the file list, when anything cannot be brought back. */
export function lossWarning(preview: DismissPreview): string | undefined {
  const lost = lostFiles(preview);
  if (lost === 0) return undefined;
  if (!preview.isGit) return "This folder has no git: every file below is deleted for good.";
  if (lost === preview.files.length) return `None of these files is committed: all ${lost} are deleted for good.`;
  return `${lost} of these files ${lost === 1 ? "has" : "have"} changes that are not committed and cannot be restored.`;
}

/** What the change leaves behind in git, for the line under the list. */
export function stagingNote(preview: DismissPreview): string {
  if (!preview.isGit) return "Nothing is committed or staged: this folder has no git.";
  return "The removal is staged in the main checkout, ready for you to commit. Nothing is committed.";
}

/** The notice once the change is gone. */
export function dismissedNotice(result: DismissResult, preview: DismissPreview): string {
  const staged = result.staged ? " Its removal is staged, ready to commit." : preview.isGit ? " Nothing was staged: git did not track it." : "";
  const stays = preview.copies.length > 0 ? ` It stays on the board while ${preview.copies.length === 1 ? "a worktree holds" : "worktrees hold"} a copy.` : "";
  return `Dismissed ${result.name}.${staged}${stays}`;
}
