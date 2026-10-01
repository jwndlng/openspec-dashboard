# Tasks

## 1. The match

- [x] 1.1 Create `src/shared/pullRequestLink.ts` with `linkedPullRequest(change, prs)`: same repository, `pr.headRefName === change.branchMatch` compared as written, no match without a `branchMatch`, and the tie-break open-first then most recently merged/closed/updated (design D1, D2); verify with a new `test/pullRequestLink.test.ts` covering exact match, no match, off-convention branch, `add-validate` vs `add-validate-phase`, same branch in another repository, open beats merged, two closed, and no `branchMatch`.
- [x] 1.2 Prove the function is pure and total: a test asserts it returns `undefined` rather than throwing for an empty list, a change with no branch, and a pull request list carrying fields an older cache wrote; verify with `bun run typecheck` and those tests.

## 2. The board's refresh

- [x] 2.1 In `src/ui/pullRequestsState.ts`, expose the staleness check the board uses (five minutes, per shown repository, never fetched counts as stale) and make it start at most one refresh, reusing the in-flight one when a second board opens (design D3); verify with tests: stale cache starts one refresh, fresh cache starts none, two boards opened in quick succession share one.
- [x] 2.2 Trigger that check when a board opens, and only then — not on the overview, not on a timer, not after a scan; verify with tests that opening the projects overview and letting scans run start nothing, and that a board left open for an hour starts nothing further.
- [x] 2.3 Show the cached pull requests immediately and update them when the refresh completes, without moving or re-ordering cards; verify with a UI test that cards keep their order and the badge appears in place.

## 3. Card

- [x] 3.1 Render `PR #<number>` on the card's status line beside the session status and console quick link, as a link to GitHub opening in a new tab, with the state as text or a symbol plus a tooltip, quieter for merged or closed, nothing for an archived change or when unavailable; add styles to `src/ui/styles.css`; verify with card tests for open, draft, merged, closed, absent, archived and unavailable.
- [x] 3.2 Prove a board with no pull requests is unchanged: a test renders the board with an empty cache and compares the card markup against the same board rendered without this feature's data, asserting no reserved space and no extra element.
- [x] 3.3 Confirm the link is not a filter and not a count: verify with tests in `test/boardFilters.test.ts` that clearing filters leaves the same cards, and that no column count or "to archive" count changed.

## 4. Detail header

- [x] 4.1 Add the pull-request line to the detail header in `src/ui/changeDetail.tsx` beside the branch — number, title as a link, state, review decision, checks summary — with the Pull requests view's symbols and no action of any kind; verify with tests in `test/changeDetail.test.ts` for a full header, a change without a pull request, and that no approve/merge/comment control exists.
- [x] 4.2 Say once, quietly, that pull requests are unavailable with the reason the `pull-requests` capability gives; verify with a test for `gh` missing and for a repository whose remote is not GitHub.

## 5. Demo

- [x] 5.1 Give the demo data a change with a matching pull request (one draft, one merged or closed) and a change with a branch and no pull request, and make sure opening a demo board attempts no refresh; verify with demo tests for the card link, the header line, the absence case and that nothing is fetched.

## 6. Documentation

- [x] 6.1 Note in `README.md` that a card links to its change's pull request and that opening a board may refresh a stale pull-request cache; verify by reading it against the proposal.

## 7. Validation

- [x] 7.1 Run `bun run check`; verify it passes.
- [~] 7.2 Run `bun run build` and exercise `dist/openspec-dashboard` against a repository with a real open pull request whose head branch matches a change: the card shows `PR #<number>` and links to it, the detail header shows its state, review decision and checks, and a change on a branch with no pull request shows neither (invariant: the product build, not only `bun run dev`).
- [~] 7.3 Confirm with `gh` uninstalled or signed out that no card shows a link, no card shows an error, the detail header explains once, and the board still opens without contacting anything.
