# Tasks

## 1. The offer's rules as a pure helper

- [x] 1.1 Add a `pullOffer` helper to `src/ui/sessionState.ts` beside `endSeverity`/`endWarning`: given the session's
      `RepoSnapshot | undefined` and the worktree's `WorkStatus | undefined`, return whether the pull is offered
      (`isGit && ok`) and whether it starts selected (offered and `work.state === "merged"`), independent of
      `removable`. Verify by typecheck (`bun run check`) and the tests in 1.2.
- [x] 1.2 Cover `pullOffer` in `test/workStatusUi.test.ts` — merged work offers and pre-selects; `uncommitted`,
      `unpushed`, `pushed` and `clean` offer without pre-selecting; a non-git repository, a repository whose scan
      failed, and a repository missing from the snapshot offer nothing; a kept (non-removable) worktree still offers.
      Verify with `bun test test/workStatusUi.test.ts`.

## 2. `PullProvider.pull` resolves with its result

- [x] 2.1 Change `pull` in `src/ui/pull.tsx` to return `Promise<PullResult>`, resolving with the result it already
      stores (and with the failure result it synthesises on a rejected call, without rejecting). Keep the badge and
      the `onPulled` rescan as they are; leave `PullButton` and `pullAll` unchanged. Verify by typecheck and that
      `bun test test/pullUi.test.ts` still passes.
- [x] 2.2 Make a `pull` for a repository whose pull is already running resolve with that running pull's result instead
      of starting a second one or resolving early, and export the context through a hook the dialog can use. Verify
      by typecheck and by 4.1's manual check (confirming the dialog while a pull runs starts no second pull).

## 3. The dialog offers, runs and reports the pull

- [x] 3.1 In `src/ui/endSessionDialog.tsx`, read the session's repository from `useSessionUi().snapshot` and render the
      pull offer from `pullOffer` — a second checkbox under the removal one, pre-selected per 1.1, with wording that
      says it fetches and fast-forwards the repository's main checkout so the board is not outdated. Verify in the
      running dashboard: the checkbox appears for a git repository and is pre-selected only for merged work.
- [x] 3.2 On confirm, after `api.closeSession` resolves, run the pull through the provider when the offer is selected,
      showing `Pulling…` on the confirm button while it runs. Verify in the dashboard against a local test remote:
      the worktree is gone before the fetch starts and the repository's Pull badge shows the outcome.
- [x] 3.3 When `pullOutcome(result).tone` is `warn` or `danger`, keep the dialog open as a report — the outcome's
      label and detail in a `notice` of that severity, a line saying the session has ended and the view may be
      outdated, and Close as the only control, closing through the existing refresh path. Close the dialog for every
      other tone. Verify in the dashboard: a diverged default branch keeps it open saying refused; a clean
      fast-forward closes it.
- [x] 3.4 Confirm nothing pulls when the offer is cleared, when the dialog is cancelled or dismissed with Escape, or
      when the session ends by itself (the agent exiting, the dashboard stopping). Verify by watching a recording
      remote as in `test/pull.test.ts` — no fetch is recorded for those paths.

## 4. Whole-change verification

Verified before the browser walk: `bun run check` green; `bun run build:demo` and `bun run build` succeed; against
the binary and a local bare remote, `POST /api/repos/<id>/pull` returned every outcome the dialog branches on.
`test/terminalSessions.test.ts` proves ending a session and removing its worktree contacts no remote.

The walk (4.1, 4.3) drove headless Chrome over the DevTools protocol against a throw-away dashboard home: the fake
agent, a tracked clone whose `origin` is an `ssh://` URL served through a `GIT_SSH_COMMAND` that logs every contact
(with the session worktrees present at that moment) before handing over to a local bare repository, and a non-git
repository. It found and fixed one defect: the pull offer's label was split into three flex columns, because `.check`
is a flex row and the repository name was a child of its own.

- [x] 4.1 Walk the spec's scenarios in the running dashboard for both `agent-sessions` requirements and
      `repository-pull`'s "From the end-session dialog" and "Already running elsewhere": merged work, unshipped work,
      offer declined, cancelled dialog, a non-git repository, refused, failed and successful pulls, and a confirm
      while a pull for the same repository is still running.
      Result: merged work pre-selects both offers; confirming logged one remote contact, made after the worktree was
      gone, fast-forwarded the checkout, showed `+2 commits` beside the board's Pull and moved the card to done without
      a reload. Unshipped work offers the pull unselected and contacts nothing; a cleared offer, Cancel and Escape
      contact nothing (Cancel/Escape also leave the session running). Diverged main keeps the dialog open as a
      `refused` report with git's reason, "has ended and its worktree was removed", and Close as the only control;
      an unreachable remote does the same as `failed` in a danger notice. A confirm while the board's Pull ran showed
      `Pulling…` disabled, logged one contact (the board's) and closed on that pull's `+8 commits`; a second click
      during the dialog's own pull started nothing. A non-git repository cannot have a session (the worktree cannot be
      created), so the dialog never exists for it; the scan-failed case is covered by `pullOffer`'s unit test.
- [x] 4.2 Check the demo site still works with no demo-specific code: the offer appears and reports from
      `demoApi.pullRepo`. Verify by opening the demo build and ending a demo session.
      Result: both running demo sessions showed the offer; `harbor-web` (off its default branch) stayed open as a
      `fetched only` report, `atlas-api` fast-forwarded and closed.
- [x] 4.3 Run `bun run check`, then `bun run build` and repeat 4.1's merged-work path against
      `dist/openspec-dashboard` so the change is proven in the compiled binary too.
      Result: `bun run check` green (447 tests); the whole 4.1 walk, not just the merged-work path, passed again
      against `dist/openspec-dashboard`.
