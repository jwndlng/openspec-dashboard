# Design

## Context

Both halves of this feature already exist and neither knows about the other.

`change-scanner` gives every change a `branchMatch`: the branch of the linked worktree its leading copy was found in,
or else "the first branch or worktree branch whose name contains the change name". `pull-requests` gives every cached
pull request its head branch, number, URL, state, draft flag, review decision and checks summary, kept per GitHub
repository in `~/.openspec-dashboard/` and specified as **display-only**: "it MUST NOT be an input to scanning, columns,
counts of changes, the activity log or any action".

That last sentence decides the shape of this change. A pull-request badge is display, so nothing here touches the
scanner, the snapshot, `deriveStage`, any column or any count — the cache requirement needs no modification, and the
join can live entirely in the UI.

## Goals / Non-Goals

**Goals:**
- From a card, one click to the pull request for that change.
- A wrong pull request is never shown. Absence is the failure mode.
- A board with no pull requests behaves and looks exactly as it does today.

**Non-Goals:**
- Fuzzy matching, storing the link, acting on pull requests, or filtering the board by them.
- Linking a pull request to a session rather than a change.

## Decisions

### D1. The match is exact head branch to `branchMatch`

```ts
// src/shared/pullRequestLink.ts
export function linkedPullRequest(change: ChangeSnapshot, prs: readonly PullRequest[]): PullRequest | undefined
```

A pull request belongs to a change when `pr.headRefName === change.branchMatch`, compared as written, with no
normalisation beyond both being absent-safe. The repository must be the change's own.

The alternative was falling back to "head branch contains the change name". It was rejected because `branchMatch` is
already fuzzy by specification — for a change with no branch of its own it is *the first branch whose name contains the
change name* — so containment would compose one loose rule with another, and two changes with overlapping names
(`add-validate` and `add-validate-phase`) would attach to each other's pull requests. Showing the wrong pull request is
much worse than showing none: the user clicks through and acts on someone else's work.

The cost is real and accepted: a pull request opened from a branch named `jan/125-add-validate-phase` is not found.
The detail header already shows the branch, so the user can see why.

### D2. When several match, prefer open, then most recently updated

Several pull requests can share a head branch over time — one merged, one reopened, or a closed attempt followed by a
new one. The rule is: an `open` one wins (drafts included, since a draft is open); otherwise the one with the most
recent merge, close or update time. It is deterministic, and it is in the shared module so the card and the header can
never disagree.

At most one is ever shown. A change with several open pull requests on one branch is degenerate; showing the newest is
better than showing a list on a card.

### D3. The board is a third view that may refresh a stale cache

Today's requirement permits the query in exactly two situations: the user activates **Refresh**, or the user opens the
Pull requests view or a repository's pull-request dialog while the cached lists are older than five minutes. It forbids
a timer, during or after a scan, page load of any *other* view, the projects overview, and being a side effect of
another operation.

The board is added to the permitted list, with the same five-minute rule and the same single-refresh-at-a-time
guarantee. Every prohibition stays, and the projects overview stays explicitly excluded — it shows counts, which the
cache serves without contacting anything.

This is worth being precise about, because it is the one shipped rule this change alters. It is not a new *kind* of
network access: the principle the requirement encodes is "the user opening a view that shows pull requests may cause
one fetch; nothing automatic may". The board becomes such a view, so it gets the rule. What would break the principle —
fetching on a poll, during a scan, or on the overview — remains forbidden, and a test asserts no `gh` starts when the
board is opened with a fresh cache.

*Alternative:* cache-only, with a Refresh control in the board's filter bar. Rejected on the merits: after a restart,
or on any machine where the user has not visited the Pull requests view, every card would silently lack its badge, and
a badge that is usually absent teaches the user to ignore it. The alternative is recorded here because it is the
conservative option and a reviewer may prefer it — switching to it removes D3 entirely and changes nothing else.

### D4. Nothing is stored, and the scanner is untouched

The link is computed on render from the snapshot the UI already holds and the pull-request lists it already fetches for
the Pull requests view. No field is added to `ChangeSnapshot`, no cache is written, no new endpoint exists. Two
consequences worth naming: a change's pull request survives no restart of its own (it comes back with the cache, which
does persist), and the activity log never records a pull request — both exactly as the cache requirement demands.

### D5. Presentation

On the **card**, `PR #125` joins the status line that already holds the session status and the console quick link — the
line `restructe-task-title` created for exactly this kind of affordance. It is a link, targets a new tab, and states its
state as text or a symbol plus a tooltip, never colour alone (`kanban-board`: "Status labels use a semantic colour
palette"). A merged or closed pull request is still shown, quietly: knowing the work has landed is the point.

In the **detail header**, a line beside the branch carries number, title, state, review decision and checks summary,
with the same symbols the Pull requests view uses so the two read alike.

Where pull requests are unavailable — no `gh`, not signed in, not a GitHub remote — nothing is shown on cards. The
existing "unavailable and failed repositories are reported, not hidden" requirement already reports the reason in the
Pull requests view, which is where a user who wonders will look; repeating it on every card would be noise.

## Risks

- **The board now touches the network on open.** Bounded by the five-minute cache, one refresh at a time, and the
  unchanged bans on timers and scans. This is the reviewable decision (D3), and the fallback is written down.
- **A branch with no pull request looks the same as a repository where `gh` is missing.** Both show nothing. Accepted:
  the detail view and the Pull requests view both explain, and a per-card explanation would cost more than it gives.
- **`branchMatch` can point at a branch the change does not really own**, since it falls back to name containment. Then
  a genuine pull request for that branch is shown for this change. Mitigated by the exactness of D1 and by the detail
  header showing the branch the match was made on, so the user can see the reasoning.
