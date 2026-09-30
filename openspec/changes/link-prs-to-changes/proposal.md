# Proposal

## Why

The dashboard now knows every tracked repository's pull requests (`pull-requests`), and it knows which branch each
change's work sits on (`branchMatch`, `change-scanner`). It just never puts the two together. The Pull requests view
lists `#125 · feat/add-validate-phase`, the board shows a card called `add-validate-phase`, and nothing on screen says
they are the same piece of work. To get from a change to its pull request the user reads the branch name off the detail
view, opens another view, and finds it by eye.

`list-recently-opened-prs` named this as its own follow-up: *"Linking pull requests to OpenSpec changes or agent
sessions (possible follow-up)."* This is that follow-up. It adds no new data source and no new endpoint — only the join
the two capabilities were already shaped for.

## What Changes

- **A change is linked to a pull request by its head branch.** A cached pull request whose head branch equals the
  change's `branchMatch` exactly is that change's pull request. Nothing fuzzier: a change whose branch was named off
  convention shows no pull request rather than someone else's. At most one is shown — the open one if there is one,
  otherwise the most recently updated — and the link is derived on display, never stored in the snapshot.
- **The card shows it.** `PR #125` sits on the card's status line beside the session status and the console quick link,
  as a link opening the pull request on GitHub in a new tab. It carries the state as text or a symbol, never colour
  alone: draft, open, merged or closed. Nothing is shown for a change with no linked pull request, so a board without
  pull requests looks exactly as it does today.
- **The detail header shows the whole story**, where branch, checkouts and work status already live: number, title,
  state, review decision and checks summary, each with the same text-plus-symbol treatment the Pull requests view uses.
- **The board becomes a third place that may fetch.** Opening the board when the cached lists are older than five
  minutes runs one refresh, exactly as opening the Pull requests view or a repository's pull-request dialog already
  does. This modifies the shipped requirement "GitHub is contacted only when the user asks", which today bans fetching
  "on page load of any other view" — the board is such a view. What that requirement actually protects is unchanged and
  stays spelled out: **no timer, no scan, no side effect of another operation, and never more than one refresh at a
  time.** The board is simply the third view that shows pull requests, so it gets the same rule as the other two. This
  is the one thing in this change that deserves a reviewer's attention, and it is the reason the alternative — a
  cache-only badge that is absent until the user visits another view — was rejected: a badge that is usually missing is
  worse than no badge.
- **No new API and no new server module.** `GET /api/pull-requests` (cached, no network) and
  `POST /api/pull-requests/refresh` already exist; the join happens in the UI from the snapshot it already has. So
  `dashboard-api` needs no delta, and neither does the scanner.
- The demo links a simulated pull request to a change.

## Capabilities

### Modified Capabilities
- `pull-requests`: "GitHub is contacted only when the user asks" adds the board as a third view that may refresh a
  stale cache, keeping every prohibition it already carries.

### New Requirements in Existing Capabilities
- `pull-requests`: how a pull request is matched to a change, and which one is shown when several match.
- `kanban-board`: the card's pull-request link.
- `change-detail`: the detail header's pull-request line.
- `demo-site`: a linked pull request in the demo.

These are added as **new requirements rather than modifications** of "Cards show only what an overview needs",
"Detail header shows the change's state" and "Agent sessions are enabled and simulated in the demo", because
`restructe-task-title` is in flight against the first and two deltas must not contend for one block. It is the same
shape `integrate-console-detail-view` used for "Cards show the work status of their change's worktree".

## Impact

- `src/shared/pullRequestLink.ts` (new) — the pure match: change + cached lists → the pull request to show, and which
  one wins when several match. Shared so the card, the detail header and the tests use one rule.
- `src/shared/types.ts` — no new stored field; the link is derived. (`PullRequest` already carries the head branch,
  number, URL, state, review decision and checks.)
- `src/ui/pullRequestsState.ts` — the board's staleness check and the one refresh it may start.
- `src/ui/app.tsx` or the board's entry point — trigger that check when the board opens.
- Card rendering and `src/ui/changeDetail.tsx` — the link and the header line; `src/ui/styles.css`.
- `src/ui/demo/sampleData.ts` — a simulated pull request whose head branch matches a demo change.
- `test/` — a new `pullRequestLink.test.ts` (exact match, no match, several matches, open beats merged, archived
  change), `pullUi`/`cardProgress`-style card tests, `changeDetail.test.ts`, `boardFilters.test.ts` (the badge is not a
  filter), a test that opening the board with a fresh cache starts no `gh`, and a demo test.
- `README.md` — the board shows a change's pull request.
- **Overlap**: `restructe-task-title` owns the card content requirement (avoided, see above). `add-cleanup-capabilities`
  owns `dashboard-api`'s "never writes" (untouched — no new route). No dependency on an unarchived change.
- No new dependency. No new invariant. The only behavioural change towards GitHub is the third view.

## Non-goals

- Matching by anything but an exact head branch: no containment, no fuzzy naming, no PR title parsing. A change with an
  off-convention branch simply shows nothing.
- Storing the link in the snapshot or the activity log. The cache stays display-only, as its requirement demands.
- Acting on a pull request — merging, approving, commenting, reopening. The dashboard stays read-only towards GitHub.
- Filtering or sorting the board by pull-request state, and counting pull requests in a column header.
- Creating a pull request. **Ship** already asks the agent to do that.
- Linking a pull request to a *session* rather than a change, the other half of the follow-up that was deferred.
