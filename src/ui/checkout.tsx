import type { Worktree } from "../shared/types.ts";
import { checkoutMarkers } from "./checkoutMarkers.ts";
import { splitBranchLabel } from "./format.ts";

/**
 * Branch name that never outgrows its container: the head is clipped with an ellipsis, the tail always
 * shows. All characters stay in the DOM (copyable); the full name is the tooltip and accessible name.
 */
export function BranchBadge({ branch, hint }: { branch: string; hint: string }) {
  const { head, tail } = splitBranchLabel(branch);
  return (
    <span class="badge brand mono truncate" title={`${branch} — ${hint}`} role="img" aria-label={`branch ${branch}`}>
      <span aria-hidden="true">⎇</span>
      <span class="text" aria-hidden="true">
        <span class="head">{head}</span>
        {tail && <span class="tail">{tail}</span>}
      </span>
    </span>
  );
}

/** One checkout of a repository — the main checkout or a linked worktree — with its state as text markers. Offers no action. */
export function CheckoutChip({ checkout }: { checkout: Worktree }) {
  const where = checkout.isMain ? "main checkout" : "worktree";
  return (
    <span class="checkout">
      {checkout.branch ? (
        <BranchBadge branch={checkout.branch} hint={`${where} at ${checkout.path}`} />
      ) : (
        <span class="badge mono" title={`${checkout.bare ? "bare repository" : "detached HEAD"} — ${where} at ${checkout.path}`}>
          {checkout.bare ? "bare" : `detached${checkout.head ? ` @ ${checkout.head}` : ""}`}
        </span>
      )}
      {checkout.isMain && <span class="where">main checkout</span>}
      {checkoutMarkers(checkout).map((m) => (
        <span key={m.kind} class={`marker ${m.kind}`} title={m.title} role="img" aria-label={m.title}>
          {m.text}
        </span>
      ))}
    </span>
  );
}

export function CheckoutChips({ checkouts }: { checkouts: Worktree[] }) {
  return (
    <>
      {checkouts.map((w) => (
        <CheckoutChip key={w.path} checkout={w} />
      ))}
    </>
  );
}
