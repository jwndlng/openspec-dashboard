// A change can exist in several checkouts of one repository: a proposal merged to main, the implementation progressing
// in a linked worktree, stale copies on branches cut earlier. The board shows one card per change; these pure functions
// decide which copy that card is.
import type { ChangeCheckout, ChangeSnapshot, Stage } from "../shared/types.ts";

/** One checkout's view of a change. */
export interface ChangeCopy {
  change: ChangeSnapshot;
  checkout: ChangeCheckout;
}

const STAGE_RANK: Record<Stage, number> = { new: 0, artifact: 1, ready: 2, implementing: 3, done: 4, synced: 5, archived: 6 };

const instant = (iso: string | undefined) => (iso && !Number.isNaN(Date.parse(iso)) ? Date.parse(iso) : 0);

function sameProgress(a: ChangeCopy, b: ChangeCopy): boolean {
  const done = (c: ChangeCopy) => c.change.artifacts.filter((x) => x.status === "done").length;
  return a.change.column === b.change.column && done(a) === done(b) && (a.change.tasks?.done ?? 0) === (b.change.tasks?.done ?? 0) && (a.change.tasks?.total ?? 0) === (b.change.tasks?.total ?? 0);
}

/** Sort key, best first: furthest along, then most progress, then most recent, then main, then path. */
function compareCopies(a: ChangeCopy, b: ChangeCopy): number {
  const done = (c: ChangeCopy) => c.change.artifacts.filter((x) => x.status === "done").length;
  return (
    STAGE_RANK[b.change.stage] - STAGE_RANK[a.change.stage] ||
    done(b) - done(a) ||
    (b.change.tasks?.done ?? 0) - (a.change.tasks?.done ?? 0) ||
    instant(b.change.lastActivityAt) - instant(a.change.lastActivityAt) ||
    Number(b.checkout.isMain) - Number(a.checkout.isMain) ||
    a.checkout.path.localeCompare(b.checkout.path)
  );
}

/**
 * The copy a card shows. "Furthest along" rather than "most recent": a rebase touches a stale copy without advancing
 * it, so progress is the better signal and recency only breaks ties. Total and independent of input order.
 */
export function leadingCopy(copies: ChangeCopy[]): ChangeCopy {
  return [...copies].sort(compareCopies)[0];
}

/**
 * One change per name from the active copies of every checkout. `archivedOnMain` maps a change name to the date it was
 * archived in the main checkout: a worktree copy of such a change is a leftover on a branch cut before the archive and
 * is dropped — unless it was created after the archive, which makes it a new change reusing the name.
 */
export function mergeChanges(copies: ChangeCopy[], archivedOnMain: Map<string, string>): ChangeSnapshot[] {
  const byName = new Map<string, ChangeCopy[]>();
  for (const copy of copies) {
    const archived = archivedOnMain.get(copy.change.name);
    if (!copy.checkout.isMain && archived !== undefined && !((copy.change.created ?? "") > archived)) continue;
    byName.set(copy.change.name, [...(byName.get(copy.change.name) ?? []), copy]);
  }
  return [...byName.values()].map((group) => {
    const sorted = [...group].sort(compareCopies);
    const [lead, ...rest] = sorted;
    // Every branch carries main's committed changes along, so most worktrees hold a copy that says nothing new.
    // Only copies whose progress differs from the main checkout's are worth mentioning.
    const main = group.find((c) => c.checkout.isMain);
    const others = rest.filter((c) => c.checkout.isMain || !main || !sameProgress(c, main));
    return {
      ...lead.change,
      // A change found in a linked worktree is on that worktree's branch; no guessing from names needed.
      branchMatch: lead.checkout.isMain ? lead.change.branchMatch : lead.checkout.branch,
      checkout: lead.checkout,
      otherCheckouts: others.length ? others.map((o) => ({ ...o.checkout, column: o.change.column })) : undefined,
    };
  });
}
