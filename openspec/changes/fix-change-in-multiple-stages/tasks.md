# Tasks

## 1. Scanner: fold leftovers into their archive

- [x] 1.1 Add `foldLeftovers(mainCopies, archived)` to `src/server/mergeChanges.ts`: a main-checkout copy whose name has an archive, and whose `created` is not later than that archive's date (missing `created` counts as not later), is removed from the copies and added to the newest archive's `otherCheckouts` with its column; verify with new cases in `test/mergeChanges.test.ts` covering the leftover, the missing `created` date, the same-day date, name reuse (kept separate, archive without other checkouts) and two archives of one name (only the newest gets it)
- [x] 1.2 Reverse the "an active copy in the main checkout is never dropped" assertion and comment in `test/mergeChanges.test.ts` to match the folding rule, and verify `bun test test/mergeChanges.test.ts` passes
- [x] 1.3 Call `foldLeftovers` in `scanRepo` (`src/server/scanner.ts`) on the main checkout's copies and archived snapshots before worktree copies are added, for git and non-git repositories alike (non-git: checkout `{ path: repo.path, isMain: true }`, active snapshots still carry no `checkout`); verify with scanner tests on temp repositories (`test/worktreeScan.test.ts`): a git repo with an untracked leftover next to its archive reports the name once, archived, with the main checkout as `Done` among its other checkouts; the same layout in a folder without git reports it once as well

## 2. Detail view: leftover badge

- [x] 2.1 Add `leftoverHint(change)` to `src/ui/format.ts` (archived, checkout is main or absent, `otherCheckouts` has a main entry → label `active copy left · <column>`, tooltip naming `openspec/changes/<name>/`, why it is there, and that removing it clears the badge); verify in `test/format.test.ts` that it returns undefined for an ordinary archive, a pending archive and an active change, and the expected label and tooltip for a leftover
- [x] 2.2 Render it as a `badge warning` in the detail header (`ChangeFacts`, `src/ui/changeDetail.tsx`) next to the pending-archive badge; verify in `test/changeDetail.test.ts` that the header of a leftover shows it and an ordinary archive's does not, and by running `bun run dev` against a temp repo with a leftover and seeing a single `Archived` card, no card in `Done`, and the badge in its detail view

## 3. Wrap-up

- [x] 3.1 Run `bun run check` (lint, typecheck, tests) and `bun run build`, and verify both succeed
- [x] 3.2 Run `openspec validate fix-change-in-multiple-stages --strict` and verify it reports the change as valid
