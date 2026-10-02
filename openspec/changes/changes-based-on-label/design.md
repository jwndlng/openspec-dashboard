# Design

## Context

Creating a change is one route, `POST /api/repos/<id>/changes` (`src/server/api.ts` → `src/server/createChange.ts`),
which writes `openspec/changes/<name>/` with `.openspec.yaml` and an optional `prompt.md`, stages that directory and
triggers a rescan. It is one of the enumerated writes of invariant 1 in `CLAUDE.md`. The combined board's dialog
(`src/ui/newChangeForm.tsx`) already chooses among eligible repositories (`newChangeTargets` in `src/ui/repoGroups.ts`).
Labels a repository displays are computed in the client from the config and the snapshot by `displayedLabels` in
`src/shared/labels.ts`; the overview filters by them with AND semantics (`filterRows`, `labelOptions`).

## Goals / Non-Goals

**Goals:**
- Start one change, with one name and prompt, in every repository displaying a set of labels, from the combined board
  and from the overview's label filter.
- Keep the write surface exactly as it is: the same per-repository request, nothing new on the server.
- Show a truthful per-repository outcome, including partial failure.

**Non-Goals:**
- Starting agent sessions in the new changes, or any batch "apply" across repositories.
- Saving a label selection as a reusable "campaign" or tracking the changes as a group afterwards.
- Rolling back on partial failure (Dismiss already removes a change on purpose).
- A label mode on a single repository's board — there is nothing to fan out to.

## Decisions

### Fan out from the client over the existing route, no bulk endpoint
The dialog loops over the checked repositories and calls `api.createChange` once each, sequentially.

- *Why:* every write stays the already-enumerated create-change write, triggered by the user's explicit submit, so
  invariant 1, the `dashboard-api` "never writes" requirement and `crossSiteRefusal` need no change. Per-repository
  status codes and messages already exist and become the per-repository result as-is.
- *Alternative — `POST /api/changes` with `{ labels, name, prompt }`:* one round-trip and server-side label matching,
  but a new mutating route, a new entry to argue in the spec and the invariant, and label resolution duplicated on the
  server (labels are currently only computed in the client for display). Not worth it for a handful of repositories.
- *Sequential, not parallel:* each successful create triggers a rescan; serialising keeps the order of results and the
  progress indicator simple and avoids a burst of concurrent `git add`s. The cost is latency proportional to the
  number of repositories, which is small.

### Pure target selection in `repoGroups.ts`
A new `labelTargets(repos, config, labels)` returns, in snapshot order, every repository displaying all `labels`
(compared with `labelKey`), each with `eligible` and, when not, a `reason` ("last scan failed"). A companion
`labelChoices(repos, config)` returns the labels displayed anywhere, de-duplicated ignoring case. Both reuse
`displayedLabels`, so hidden detected labels and custom labels shadowing detected ones behave exactly as on the
overview. Pure functions keep this testable without a DOM, like the existing `newChangeTargets` tests.

Eligibility mirrors `newChangeTargets` (scan `ok`). A repository without `openspec/changes/` is not detectable from
the snapshot today; the server refuses it with `409`, which then shows as that repository's refused result — the spec
allows that because a refusal is a reported outcome, not a skipped one.

### One dialog, two modes
`NewChangeTarget`'s `projects` variant gains optional `labelRepos` input (the snapshot repositories and config needed
by `labelTargets`) and an optional `initialLabels`. When present, the form shows a segmented **One project / By label**
switch; the overview opens it with `mode: "label"` and `initialLabels` from its filter. The name/prompt fields, their
validation and `focusOnce` are shared — the first-focused field is still decided once at open (the label picker when
By label opens with no labels, otherwise the name field).

The per-repository checked state is kept as a set of *unchecked* ids, so a repository that newly matches after a label
is added starts checked without extra bookkeeping.

### A runner separated from the component
`createInRepos(repos, name, prompt, onProgress)` in `newChangeForm.tsx` performs the sequential loop and returns
`{ repoId, repoName, ok, staged?, message? }[]`, catching each `ApiError` into a refused result. The component renders
progress and results from it; tests drive it against a stubbed `api` (the client's `current` implementation is already
swappable) to prove order, continuation after a refusal and request bodies.

After the loop the dialog calls `onCreated` once (the board's `onReload`; the overview's snapshot refresh) but stays
open on the results; its submit action becomes **Done**.

### Overview entry point
`src/ui/overview.tsx` shows **New change in these projects** next to the label filter when `state.labels` is non-empty
and `labelTargets` finds at least one eligible repository among the filtered labels. It mounts the same
`NewChangeDialog`; the overview has the config and snapshot it needs.

## Risks / Trade-offs

- [Closing the browser tab mid-loop leaves some repositories created and others not] → each create is independent and
  shows up on the board; the user re-runs by label and the already-created ones are refused with a clear clash message.
- [A label matches more repositories than intended, e.g. a detected `docker`] → the list is shown with checkboxes
  before anything is written, and the submit action states the count.
- [Snapshot changes while the dialog is open (a repository's scan fails)] → targets are derived on each render; a
  repository that becomes ineligible is shown as skipped and is not sent, as the single-project form already does.
- [N rescans for N creates, and a coalesced one can miss a late create] → `Scanner.trigger` returns the in-flight scan
  when one runs, so a create landing mid-scan may not be in that snapshot. After the loop, and when at least one
  create succeeded, the dialog awaits the existing `api.scan()` once more before calling `onCreated`, so the refresh
  the spec promises includes every created change.

## Migration Plan

UI-only and additive; no config or API change. Rollback is reverting the UI commit.
