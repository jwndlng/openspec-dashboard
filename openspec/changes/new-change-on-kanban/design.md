# Design

## Context

`NewChangeForm` (`src/ui/newChangeForm.tsx`) takes a fixed `repoId`/`repoName` and is opened only from `RepoHeader` in
`src/ui/kanban.tsx`, which shows the button when `repo.ok`. `Kanban` renders both boards: `/board` (no `repoId`, has a
repository filter) and `/repo/<id>` (single repository, header, no repository filter). Both already receive `onReload`
from `app.tsx`, so a create on either board can trigger the immediate reload the header uses today. Focus on open is
handled by one stable `focusOnce()` ref per form instance (see `src/ui/focus.ts`).

The server side (`POST /api/repos/<id>/changes`, `src/server/createChange.ts`) is already per-repository and
authoritative about eligibility; this change is UI only.

## Goals / Non-Goals

**Goals:**
- One form component for both boards; the dropdown is the only difference.
- Eligibility and pre-selection decided by a pure, unit-tested helper.

**Non-Goals:**
- Changing the endpoint, its refusals or any write path.
- Changing the board's repository filter to reveal the new card when the chosen project is filtered out — the card
  appears once that repository is shown again; the form closing is the confirmation, as on the header.
- A keyboard shortcut for the action (a separate concern; `shortcut-addition` is in flight).

## Decisions

**Extend `NewChangeForm` instead of a second component.** It gains an optional `projects` prop
(`{ id, name }[]` plus an optional pre-selected id). With `projects` given it renders a `<select>` before the name
field and holds the chosen id in state; without it, it uses the fixed `repoId` exactly as now. Alternative — a wrapper
component that renders a dropdown and a nested form — would split the submit/disabled logic and the focus rule across
two components. Rejected.

**Pure helper `newChangeTargets(repos, filterRepoIds)`** returns `{ projects, preselected? }`: `projects` are the repos
with `ok` in snapshot order (the same test `RepoHeader` uses — the server refuses anything else with `409`, so the
client check is a convenience, not the guard); `preselected` is the only project when there is one, else the only
filtered repository that is also a project, else undefined. `RepoHeader` keeps its own `repo.ok` check. Lives next to
the other board helpers in `src/ui/repoGroups.ts`, tested in `test/repoGroups.test.ts`.

**Focus: one `focusOnce()` ref, attached to whichever field is first to fill.** The form computes at mount whether a
project was pre-selected and attaches the single stable ref to the `<select>` or to the name `<input>` accordingly.
That decision is taken once (initial state), so a later choice or poll never moves the ref and never refocuses.

**Choice goes stale → clear it.** On each render the form checks that the chosen id is still in `projects`; if not, it
treats the choice as empty (submit disabled, "choose a project" hint). No effect or state reset is needed — the value is
derived — so focus is untouched.

**Placement.** On `/board` the button sits at the end of the filter row (after the open/to-archive badge) and the form
renders between the filter row and `.board`, reusing the `.new-change` styles. The form's open state lives in `Kanban`
and is only used when `repoId` is undefined; `RepoHeader` keeps its own.

**Snapshot the pre-selection at open time.** `newChangeTargets` is evaluated when the form opens (the preselected id
becomes the form's initial state); the project list itself is re-evaluated each render so eligibility stays live.

## Risks / Trade-offs

- [The chosen repository is filtered out of the board, so the new card is not visible after the create] → accepted
  (see Non-Goals); the pre-selection from the filter makes the common case land in a visible repository.
- [Overlap with `update-detail-view`, which edits `ChangeCard` in the same file] → this change touches only `Kanban`
  and `RepoHeader`; whichever merges second rebases on a disjoint hunk.
- [Demo build: `createChange` is refused] → the form shows the demo's message, as the header's form already does.
