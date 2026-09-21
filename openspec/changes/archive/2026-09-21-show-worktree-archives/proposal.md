# Proposal

## Why

The board merges the copies of a change across a repository's checkouts and shows the one that is furthest along — except for the furthest stage of all. Archived changes are read from the main checkout only, so a change that was archived on a branch in a worktree (which is where agent sessions archive) keeps showing the main checkout's stale active copy, for example in `Implementing` at 5/6, with nothing on the card explaining why. The user sees finished, even merged, work as unfinished until the main checkout happens to be pulled.

## What Changes

- The scanner also reads `openspec/changes/archive/` of linked worktrees. An archive found there that the main checkout does not have is a **pending archive**.
- A change with a pending archive is reported **once, as archived**, with the worktree as its checkout; the active copies that still exist elsewhere (typically the main checkout) are listed as its other checkouts with their columns. **BREAKING** for the scenario "Archives come from main only": it now covers only archives the main checkout has too.
- The existing guard works in both directions: an archive does not swallow a change whose `created` date is later than the archive date (a reused name).
- The card of such a change says where the archive is and that this checkout does not have it yet, as text plus colour, with the details in its tooltip.
- Fix found on the way: a tracked project that sits in a subdirectory of its git repository was read from the top level of each worktree — another project's `openspec/`, or none. It is now read from the same subdirectory. Reading archives made this visible (the test fixtures are such projects inside this repository).
- Unchanged: archives the main checkout has, non-git repositories, worktree limits and timeouts, read-only git.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `change-scanner`: worktree archives are read; merging treats a pending archive as the leading copy.
- `kanban-board`: cards mark an archive that is not in the main checkout yet.

## Impact

- `src/server/scanner.ts`, `src/server/mergeChanges.ts`, `src/server/source.ts`, `src/server/git.ts` (`rev-parse --show-prefix`, an already allowed subcommand); `src/ui/kanban.tsx`, `src/ui/format.ts`.
- `test/worktreeScan.test.ts` and the merge tests; `README.md` if it describes the old rule.
- A few more directory listings per worktree and one `scanChange` per pending archive; within the existing worktree limits.
