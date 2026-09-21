# Design

## Context

See `proposal.md` — Why. The pieces this change joins already exist and both sit inside the same providers in
`src/ui/app.tsx`:

- `EndSessionDialog` reads a fresh worktree status (`GET /api/sessions/<id>/worktree`) when it opens, decides how
  loudly to warn from `endSeverity`/`endWarning`, and on confirm calls `api.closeSession(id, removeWorktree)`.
- `PullProvider` owns every pull the UI starts: it guards against a second pull for the same repository, keeps the
  outcome per repository in memory, renders it as a badge next to `PullButton`, and triggers the app's rescan through
  `onPulled`.

The dialog is rendered inside `PullProvider`, so it can reach that context without any rewiring. `PullProvider.pull`
is today fire-and-forget (`void`), and pullability — a tracked git repository whose last scan succeeded — is the same
`isGit && ok` test `kanban.tsx` and `overview.tsx` apply, readable from `useSessionUi().snapshot`.

Constraint that shapes everything below: invariant 1 and 4 — the pull is the only thing that contacts a remote or
changes a main checkout, and it runs only on the user's explicit request. This change must add a place the user can
request it, not a new way for one to happen.

## Goals / Non-Goals

**Goals:**

- One confirmation covers ending, cleaning up and catching up, with the pull reported where the user is looking.
- The pull itself — its route, its git commands, its safety rules, its outcome vocabulary — is reused unchanged.
- The decision of whether the pull is offered and pre-selected is a pure function, testable without a DOM.

**Non-Goals:**

- No new API route, git subcommand, or server-side code. `src/server/pull.ts` is not touched.
- No change to `PullButton`, `PullAllButton`, or the badge rendering.
- No pull started by anything but a user confirming a control — no retry, no timer, no pull on the session ending by
  itself (the agent exiting, or the dashboard stopping).

## Decisions

### The dialog goes through `PullProvider`, which starts returning its result

`PullProvider.pull` becomes `(repoId) => Promise<PullResult>`, resolving with the same result it already stores. The
dialog awaits it.

Going through the provider keeps one owner for the three things that must stay true of every pull: the single-flight
guard, the badge next to the repository's own Pull control, and the `onPulled` rescan. Awaiting the promise is what
lets the dialog say what happened.

*Alternative — the dialog calls `api.pullRepo` directly:* rejected. It would duplicate the guard, skip the badge, and
make the dialog the second place that decides what a pull outcome means.

*Alternative — keep `pull` returning void and read the outcome out of `states[repoId]`:* rejected. The dialog would
have to watch a map for a value it cannot distinguish from the previous pull's, and a pull already running for the
repository has no result of its own to wait for. The promise makes "wait for this pull" expressible; for a pull that
was already running, `pull` resolves with that pull's result rather than starting a second one.

### Order on confirm: end, remove, then pull

`closeSession(id, removeWorktree)` first, the pull after it resolves.

The removal must be decided and done on the work status the user was shown. A fast-forward moves the default branch,
which is the base `workStatus` compares against, so pulling first could change whether the worktree still counts as
`merged` between the moment the user read the dialog and the moment the removal is checked. Doing the local, immediate
work first also means a remote that hangs for the full fetch timeout delays only the catching-up, never the ending the
user asked for.

*Alternative — pull first, so the removal sees the newest base:* rejected for both reasons above; it also inverts the
dialog's own wording, which offers the removal first.

### Which outcomes keep the dialog open: the outcome's own tone

`pullOutcome(result).tone` already grades every outcome: `ok` for a fast-forward, `""` for up to date and for nothing
to pull, `warn` for fetched-only and refused, `danger` for failed. The dialog stays open exactly for `warn` and
`danger` and closes otherwise.

That is the same line the spec draws — an outcome that leaves the checkout behind is stated, one that did not is not
worth a second click — and it keeps the mapping in `pullState.ts`, so a new outcome is graded once.

*Alternative — a `switch` over `result.update` in the dialog:* rejected as a second, drifting copy of that grading.

### Staying open turns the dialog into a report

When the dialog stays open, the session has already ended and the worktree is already gone: none of its buttons mean
anything any more. The body is replaced by the outcome — `pullOutcome`'s label and detail, in a `notice` of the
matching severity — with a line saying the session ended and the view may be outdated, and the only control is Close,
which runs the same refresh path as a normal close.

Everything up to that point stays as it is: `busy` disables the buttons, and the confirm button's label says
`Pulling…` while the fetch runs, so a second confirmation is impossible during it.

### The offer's rules live in `sessionState.ts`

A pure helper beside `endSeverity`/`endWarning` — given the session's `RepoSnapshot` (or its absence) and the
worktree's `WorkStatus`, it answers whether the pull is offered and whether it starts selected. The component stays a
shell around it, which is how the dialog's other decisions are already structured and how they are already tested
(`test/workStatusUi.test.ts`, `test/pullUi.test.ts`).

The rules: offered when the repository is in the snapshot with `isGit && ok`; pre-selected when it is offered and the
work status is `merged`. Deliberately independent of `removable`, so a worktree that is kept for a reason still lets
the user bring the checkout up to date.

## Risks / Trade-offs

- **A pre-selected checkbox contacts a remote for a user who confirms dialogs by habit** → It is pre-selected only for
  work the local repository already shows as `merged`, the checkbox is visible and clearable in the same dialog, and
  the action it runs is fast-forward-only and refuses rather than forces. Nothing is pre-selected for unshipped work.
- **The dialog now outlives a network call** → `src/server/pull.ts` already bounds the fetch with a timeout and
  reports `failed: timed out`, so the `Pulling…` state always ends. The session has already ended by then, and the
  report says so.
- **Two pull outcomes for one repository could disagree** → There is one store: the provider's. The dialog renders
  from the result that store resolved with, so its report and the Pull control's badge are the same outcome.
- **The demo site must not look broken** → `demoApi.pullRepo` already answers with a synthetic result, so the offer
  and its report work there with no demo-specific code.
- **Ending a session from anywhere else gains nothing** → Accepted and out of scope: the inline `Remove…` under Open
  work stays a one-click control, and the repository's own Pull button is a click away on the same view.
