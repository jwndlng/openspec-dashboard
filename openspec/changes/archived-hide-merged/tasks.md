# Tasks

## 1. Pending/merged predicate

- [x] 1.1 Add a pure `archivePending(card, worktrees)` to `src/ui/sessionState.ts`: pending when a session worktree of the same repository and change has `SHIPPABLE_WORK`, or when `card.checkout?.isMain === false` and no such worktree reports `merged`; otherwise merged (including no `checkout`, i.e. non-git or older snapshots). Verify with a new `test/archivePending.test.ts` covering every scenario of "Archived changes are told apart as merged or pending".

## 2. Filter state

- [x] 2.1 Add `hideMerged` to `Filters` in `src/ui/filters.ts`: `true` in `EMPTY_FILTERS`, parsed as `false` only from `merged=1`, serialized as `merged=1` only when off, and counted by `hasActiveFilters` only when off. Verify with cases in `test/boardFilters.test.ts` (default parse, round trip, `hasActiveFilters`, no `merged` parameter by default).

## 3. Board

- [~] 3.1 In `src/ui/kanban.tsx`, read the session worktrees from the sessions context and, while `filters.hideMerged` is on, filter the `Archived` column with `archivePending` before `recentArchived`, so the count and `25 of <total>` follow it. Apply the same filter to the "showing" count. Verify with `bun run dev` against a repository with one archive in a linked worktree and others on main: only the pending one is shown and counted.
- [~] 3.2 Add the **Hide merged** switch in `src/ui/boardFilters.tsx` directly after **Hide archived**, with the same switch markup, `aria-checked`, disabled while `hideArchived` is on, and a `title` explaining what it hides. Verify that it toggles `merged=1` in the URL, that it is disabled under **Hide archived**, and that **Clear filters** turns it back on.

## 4. Demo

- [x] 4.1 In `src/ui/demo/sampleData.ts`, move at least two sample archives into a linked worktree (checkout with `isMain: false` and a `chore/archive-<name>` branch, kept consistent with the repository's worktree list), so the default demo `Archived` column shows them. Verify with `test/demoData.test.ts`: at least two archives are pending, and there are still more than 25 archives in total.

## 5. Verification

- [x] 5.1 Run `bun run check` (lint, typecheck, tests) and `bun run build`; both pass.
