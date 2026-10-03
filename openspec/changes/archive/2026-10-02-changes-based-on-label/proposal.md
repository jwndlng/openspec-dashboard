# Proposal

## Why

A cross-cutting chore — bumping the Terraform version, rotating a base image, adopting a new lint rule — has to be
started as one change in every repository it touches. Today that means opening "New change" once per repository and
typing the same name and prompt each time. Repositories already carry labels (custom ones and detected ones such as
`terraform`), so the dashboard knows which projects a chore targets; it should let the user start the change in all of
them at once.

## What Changes

- The combined board's **New change** dialog gains a second way to choose where to create: **By label**, next to the
  existing single-project dropdown. The user picks one or more labels; the dialog lists every tracked repository that
  displays all of them, with a checkbox per repository (all checked by default), and marks the ones that are not
  eligible (disabled, failed scan, no `openspec/changes/`) as skipped with the reason.
- Submitting creates the same change name and prompt in every checked repository by calling the existing
  `POST /api/repos/<id>/changes` once per repository, one after another. The dialog then shows a per-repository
  result — created (and whether it was staged), or refused with the server's reason (for example a name clash) — and
  one refusal does not stop the others. Nothing is rolled back; a change created by mistake is removed with the
  existing **Dismiss** action.
- The projects overview, while its label filter is active, offers **New change in these projects**, which opens the
  same dialog in **By label** mode with the filter's labels pre-selected.
- No new server route, no new write and no new git command: each repository receives exactly the write a single
  "New change" already makes. Starting agents in the new changes is out of scope.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `change-creation`: the combined board's form can target every eligible repository displaying a set of labels and
  creates the change in each of them, reporting a result per repository; the projects overview offers that form when
  its label filter is active.

## Impact

- UI: `src/ui/newChangeForm.tsx` (label mode, per-repository results), `src/ui/repoGroups.ts` (label targets and
  eligibility), `src/ui/kanban.tsx` (passes labels and config to the dialog), `src/ui/overview.tsx` (the action next to
  the label filter), `src/ui/app.tsx` (hands the overview the same refresh the board gets), `src/ui/styles.css`.
- Shared: `src/shared/labels.ts` is reused (`displayedLabels`, `labelKey`) for matching; no change to label rules.
- Server: none. `POST /api/repos/<id>/changes`, `src/server/createChange.ts` and invariant 1 are unchanged.
- Tests: unit tests for the label-target selection, and UI tests for the fan-out and the per-repository results.
- Specs: `openspec/specs/change-creation/spec.md`.
