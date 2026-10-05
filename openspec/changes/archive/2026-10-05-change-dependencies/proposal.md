# Proposal

## Why

A feature often starts as several changes at once — a schema change, the API on top of it, the UI on top of that —
and they only work when implemented in that order. Today nothing on the board says so: every change in `Ready` offers
**Implement**, so an agent can be sent into `add-billing-ui` while `add-billing-schema`, which it builds on, is still
half-written on another branch. The order lives only in the user's head, and the board actively invites breaking it.

What is missing is a way for a change to say *"start me only once these other changes are implemented and merged"*,
for the dashboard to show that ordering, and for it to hold back **Implement** until the order allows it.

## What Changes

- **A change can declare what it depends on**, in a new file `openspec/changes/<name>/depends-on.yaml` holding a
  `depends_on:` list of change names in the same repository. It is a dashboard convention next to `prompt.md`, not an
  OpenSpec artifact: it does not count towards artifact status, and `openspec` ignores it. People and agents may write
  it by hand.
- **The scanner reads it and derives a dependency graph per repository.** Each declared dependency gets a state:
  `met` — the main checkout holds that change archived, or holds it in `Done` (every task settled), i.e. it is
  implemented and merged as of the user's last pull; `waiting` — the change exists but is not there yet; `missing` —
  no active or archived change of that name exists; `cycle` — it leads back to this change through unmet
  dependencies. A change with any dependency that is not `met`, or with a `depends-on.yaml` that cannot be read, is
  **blocked**. Each change also reports which changes depend on it. Everything is derived from the snapshot; nothing
  new is stored.
- **A blocked change is not offered Implement, and the server refuses it**, naming what it waits for. **Draft
  artifacts** stays available, so planning a whole chain can run in parallel; **Validate**, **Archive** and sessions
  already running are unaffected.
- **The card says why.** A blocked card in `Ready` or `Implementing` shows, in the place **Implement** would take,
  a "waits for" note naming its unmet dependencies (tooltip lists each with its state). No new column.
- **The detail header shows both directions**: *Depends on* with each dependency's state, and *Required by* listing
  the changes that wait for this one, each linking to that change's detail view. Missing dependencies and cycles are
  also reported as warnings on the change.
- **The New change form gets an optional "Depends on" picker** listing the target repository's active changes. When
  the user picks any, the create writes `depends-on.yaml` into the new change directory together with `.openspec.yaml`
  and `prompt.md`, inside the same exclusive-created directory and covered by the same single `git add`. This widens
  invariant 1's create-change entry by exactly that one file; no new git command, no new route. The picker is offered
  when the form targets one repository, not for label-targeted creation across several.

## Capabilities

### New Capabilities
- `change-dependencies`: the `depends-on.yaml` convention, how the scanner reads it, the dependency states (`met`,
  `waiting`, `missing`, `cycle`), when a change is blocked, the reverse "required by" list, and the snapshot fields
  carrying them.

### Modified Capabilities
- `agent-sessions`: "Session starters run a fixed prompt for a validated change" — **Implement** is withheld and
  refused for a blocked change, with the unmet dependencies as the reason.
- `kanban-board`: "Cards offer session starters and show session state" — a blocked card shows the "waits for" note
  where **Implement** would be.
- `change-detail`: "Detail header shows the change's state" — the *Depends on* and *Required by* lists.
- `change-creation`: "Submitting the form creates the change directory" writes `depends-on.yaml` when dependencies
  were picked; a new requirement for the form's "Depends on" picker.
- `dashboard-api`: "Create-change endpoint" accepts an optional `dependsOn` list and validates it; "The dashboard
  never writes to tracked repositories" lists `depends-on.yaml` among the files the create-change action writes.

## Impact

- `src/shared/types.ts` — `ChangeSnapshot.dependsOn`, `requiredBy`, `blocked`; `DependencyState`; `availableActions`
  drops `implement` for a blocked change.
- `src/shared/dependencies.ts` (new) — pure derivation of states, cycles, blocked and required-by from a repository's
  merged changes.
- `src/server/scanner.ts` — read and parse `depends-on.yaml` (bounded, failure-isolated, names validated with
  `CHANGE_NAME`), then run the derivation after copies are merged. `src/server/mergeChanges.ts` only if the parsed
  list needs carrying through the merge.
- `src/server/sessions/manager.ts` — refusal message naming unmet dependencies.
- `src/server/createChange.ts`, `src/server/api.ts` — accept, validate and write `dependsOn`.
- `src/ui/` — `newChangeForm.tsx` (picker), `kanban.tsx` (waits-for note), `changeDetail.tsx` (both lists),
  `styles.css`; `src/ui/demo/sampleData.ts` (a small chain); `src/ui/changelog.ts` (What's new).
- `test/` — a fixture repository with a dependency chain, a cycle and a missing name; tests for the derivation,
  scanner, starter gating and refusal, create-change writing and validation, card and detail rendering.
- `CLAUDE.md` invariant 1 and `README.md` — the extra file the create-change action writes; the `depends-on.yaml`
  convention.
- No new dependency (the `yaml` package is already used), no network, no new git command.

## Non-goals

- Dependencies across repositories, and a dependency picker for label-targeted creation in several repositories.
- A whole-repository graph view; this change shows each change's direct neighbours only.
- Editing a change's dependencies from the dashboard after it was created; the file is edited by hand or by an agent.
- Blocking drafting, archiving or validation, or stopping a running session when a dependency becomes unmet.
