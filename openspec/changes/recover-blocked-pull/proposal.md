# Proposal

## Why

Creating a change in the dashboard writes its `.openspec.yaml` (and optional `prompt.md`) and stages them in the main
checkout. The change's work then happens on a branch and is merged upstream — including that change directory, often
with slightly different content. The next pull is refused because "local changes would be overwritten", and the user
has to work out by hand, with git, that the blocking files are only the dashboard's own leftovers of a change that has
since landed. This happens after almost every change the dashboard creates, so pulling routinely fails for a reason the
dashboard caused itself.

## What Changes

- When a fast-forward is refused because uncommitted local files would be overwritten, the pull result SHALL list the
  blocking files instead of only passing on git's message.
- A blocking file is a **change leftover** when it lies inside `openspec/changes/<name>/`, is not in the checkout's
  current commit (it was only created and staged locally), and the incoming commits add that same file. A leftover whose
  content equals the incoming content is **identical**; otherwise it **differs**.
- When every blocking file is a change leftover, the pull result SHALL offer **Resolve and pull**: after the user
  confirms, the dashboard saves a copy of every leftover that differs to `~/.openspec-dashboard/`, removes the leftovers
  from the index and working tree, and runs the fast-forward again. The result names each replaced file and where its
  copy was saved. When nothing differs, no copy is needed.
- The server re-checks the blocking files on confirmation and never trusts the earlier result: if anything changed, or
  a blocking file is not a change leftover, nothing is touched and the pull stays refused.
- When any blocking file is not a change leftover (real local work), the pull stays refused, nothing is offered, and the
  result explains which files block and that they must be committed or set aside first.
- Diverged histories remain refused as today; the result says so plainly and never suggests forcing.
- **BREAKING (invariant)**: a new enumerated exception to "never writes to tracked repositories": removing, on the
  user's confirmation, uncommitted files the checks proved to be change leftovers, from the main checkout's index and
  working tree, immediately before a fast-forward that brings them back from upstream. The dashboard still never
  commits, pushes, stashes, resets, rebases, forces, or touches any other file.
- The demo simulates a blocked pull and its resolution.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `repository-pull`: "The update is refused rather than forced" reports the blocking files; a new requirement for
  recognising change leftovers and resolving them on confirmation, with backups and re-checks.
- `dashboard-api`: "The dashboard never writes to tracked repositories" gains the leftover-removal exception; "Pull
  endpoints" gains the confirmed resolve request.
- `demo-site`: blocked pulls and their resolution are simulated in the demo.

## Impact

- `src/server/pull.ts` — classify blocking files, the confirmed resolve step and the retried fast-forward; stays the only
  place that contacts a remote.
- `src/server/api.ts` — the resolve request under the same-origin guard.
- `src/shared/types.ts` — blocking files and resolve results in the pull result type.
- `src/ui/pull.tsx`, `src/ui/pullState.ts`, `src/ui/api.ts`, `src/ui/styles.css` — showing blocking files and the
  Resolve and pull confirmation, in the board header, the overview and the end-session dialog.
- `src/ui/demo/demoApi.ts` — simulated blocked pull.
- `test/` — pulls against temporary git repositories: identical leftover, differing leftover (copy saved), mixed with a
  real local edit (refused, untouched), leftover changed between result and confirmation (refused), diverged.
- `CLAUDE.md` (invariant 1: the new exception), `README.md` (the "what it writes" list).
- No new dependencies.
