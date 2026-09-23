import { useState } from "preact/hooks";
import type { Worktree } from "../shared/types.ts";
import { checkoutMarkers } from "./checkoutMarkers.ts";
import { splitBranchLabel } from "./format.ts";
import { IconGitBranch } from "./icons.tsx";
import { Modal } from "./modal.tsx";
import { checkoutSummary } from "./overviewState.ts";

/**
 * Branch name that never outgrows its container: the head is clipped with an ellipsis, the tail always
 * shows. All characters stay in the DOM (copyable); the full name is the tooltip and accessible name.
 */
export function BranchBadge({ branch, hint }: { branch: string; hint: string }) {
  const { head, tail } = splitBranchLabel(branch);
  return (
    <span class="badge branch mono truncate" title={`${branch} — ${hint}`} role="img" aria-label={`branch ${branch}`}>
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

/** Checkouts with work the user should look at: uncommitted, unpushed or stale. */
export function checkoutsNeedingAttention(checkouts: Worktree[]): number {
  return checkouts.filter((w) => checkoutMarkers(w).some((m) => m.kind === "uncommitted" || m.kind === "unpushed" || m.kind === "stale")).length;
}

/**
 * The repository header's checkouts, calm: the main checkout's chip, and one button — `5 branches` — that opens the
 * full list in a dialog. When checkouts hold uncommitted, unpushed or stale work, the button says how many.
 */
export function CheckoutSummaryButton({ checkouts, repoName }: { checkouts: Worktree[]; repoName: string }) {
  const [open, setOpen] = useState(false);
  const main = checkouts.find((w) => w.isMain);
  const summary = checkoutSummary(checkouts);
  const attention = checkoutsNeedingAttention(checkouts);
  return (
    <>
      {main && <CheckoutChip checkout={main} />}
      <button type="button" class={`control branches-button ${attention ? "attention" : ""}`} aria-haspopup="dialog" onClick={() => setOpen(true)} title="Every checkout of this repository">
        <IconGitBranch size={13} />
        {summary.branches} {summary.branches === 1 ? "branch" : "branches"}
        {attention > 0 && <span class="control-value">{attention} with work</span>}
      </button>
      {open && (
        <Modal
          label={`Branches of ${repoName}`}
          title={`Branches of ${repoName}`}
          subtitle={`${summary.text} — unpushed and behind counts are as of the last fetch`}
          icon={<IconGitBranch size={18} />}
          onClose={() => setOpen(false)}
          wide
        >
          <ul class="checkout-list">
            {checkouts.map((w) => (
              <li key={w.path}>
                <CheckoutChip checkout={w} />
                <code class="checkout-path">{w.path}</code>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
}

