// Text markers of a checkout chip. Pure, shared by the repository header, the overview tiles and their tests.
import type { Worktree } from "../shared/types.ts";

export interface CheckoutMarker {
  kind: "uncommitted" | "unpushed" | "behind" | "stale" | "locked" | "unknown";
  /** What the chip shows: a symbol with a number, or a word. Never colour alone. */
  text: string;
  /** Spelled out, for the tooltip and assistive technology. */
  title: string;
}

const LAST_FETCH = "as of the last fetch (the dashboard never fetches)";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** The local-only count is capped, so the cap itself means "or more". */
const capped = (n: number) => (n >= 100 ? "99+" : String(n));

/** Markers that apply to a checkout, in display order. A clean, fully pushed checkout has none. */
export function checkoutMarkers(w: Worktree): CheckoutMarker[] {
  const markers: CheckoutMarker[] = [];
  if (w.prunable) markers.push({ kind: "stale", text: "stale", title: "Stale: the worktree's directory no longer exists" });
  if (typeof w.status === "object") {
    const { modified, untracked, conflicts, upstream, ahead, behind } = w.status;
    if (modified + untracked > 0) {
      const detail = [`${modified} modified`, `${untracked} untracked`, ...(conflicts > 0 ? [`${conflicts} in conflict`] : [])].join(", ");
      markers.push({ kind: "uncommitted", text: `●${modified + untracked}`, title: `${plural(modified + untracked, "uncommitted item")} (${detail})` });
    }
    if ((w.unpushed ?? 0) > 0) {
      const n = w.unpushed ?? 0;
      const title =
        upstream && ahead !== undefined
          ? `${plural(n, "commit")} ahead of ${upstream}, ${LAST_FETCH}`
          : `${capped(n)} ${n === 1 ? "commit" : "commits"} not on any remote${w.detached ? "" : " — this branch was never pushed"}, ${LAST_FETCH}`;
      markers.push({ kind: "unpushed", text: `↑${capped(n)}`, title });
    }
    if (upstream && (behind ?? 0) > 0) markers.push({ kind: "behind", text: `↓${behind}`, title: `${plural(behind ?? 0, "commit")} behind ${upstream}, ${LAST_FETCH}` });
  }
  if (w.locked) markers.push({ kind: "locked", text: "locked", title: w.lockReason ? `Locked: ${w.lockReason}` : "Locked worktree" });
  if (w.status === "unknown") markers.push({ kind: "unknown", text: "?", title: "Status unknown: git status failed or timed out here" });
  else if (w.inspected === false) markers.push({ kind: "unknown", text: "?", title: "Not inspected: only the first worktrees of a repository get a status" });
  return markers;
}

/** Whether the snapshot knows the repository's checkouts; snapshots cached by older versions only list path/branch pairs. */
export function hasCheckoutInfo(worktrees: Worktree[]): boolean {
  return worktrees.some((w) => w.isMain);
}
