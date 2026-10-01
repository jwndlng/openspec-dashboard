# Design

## Context

`simplify-project-mgmt` gave the overview instant, narrow config writes: `POST /api/repos/track`,
`/api/repos/<id>/enabled` and `/api/ignore-paths` in `src/server/api.ts`, all applied through the serialised
`updateConfig` in `src/server/config.ts`, followed by `afterConfigChange`. On the client, `useTracking`
(`src/ui/untracked.tsx`) runs one action per repository at a time and keeps per-repository busy and error state. The
saved config goes straight to the app shell through `onConfig`.

Two lists in Settings still edit `config.repos` through the draft. The **Tracked repositories** section has the enable
checkbox, the name input and ×. The **Repositories** list in `AgentSettings` has `repo.agent.enabled` and
`repo.agent.agentId`. `PUT /api/config` sends the whole draft back, including `repos`. Repository names reach the views
from the scan snapshot (`RepoSnapshot.name`, set from the config at scan time). `enabledOnly` in
`src/ui/overviewState.ts` already reconciles the snapshot with the config for the enabled set.

See proposal.md for the motivation and the specs for the behaviour.

## Goals / Non-Goals

**Goals:**
- Everything that concerns one project is changed on its row or tile, and saved at once, with the same machinery as
  Enable and Disable.
- Settings no longer has anything that edits `config.repos`, so its stale draft cannot undo an overview change.

**Non-Goals:**
- A general `PATCH /api/repos/<id>`.
- Server-side changes to how sessions read `repo.agent`. `repoAgentEnabled` and `agentFor` stay as they are.

## Decisions

### Three narrow routes, one per intent

`POST /api/repos/<id>/name`, `POST /api/repos/<id>/agent` and `POST /api/repos/<id>/forget` sit next to
`/enabled`, and are routed and wrapped with `tracking(...)` in the same way (that wrapper maps `TrackingError` to its
status). Each one is an `updateConfig(state, fn)` whose `fn` re-reads the repository from `current`. A request that
races a Forget therefore gets a clean 404 instead of resurrecting the entry. Validation of the result is the existing
`validateConfig`, which already rejects an unknown `agentId`. The route checks it first anyway, so it can answer 400
with a clear message rather than a generic config error.

- `agent` merges into `repo.agent`. When no `agent` object exists yet, it starts from `{ enabled: true }`, matching
  `repoAgentEnabled`'s "absent means included". `agentId: null` deletes the key. A body with neither field is refused,
  so a no-op cannot look like success.
- `forget` refuses an enabled repository with 409. The UI only offers it on disabled entries. Making the server agree
  means a stale tab cannot drop a repository the user still sees as managed.
- None of the three changes the enabled set, so `afterConfigChange` triggers no scan. It still clears the
  pull-request origin cache, which is harmless and keeps all writes on one path.

Alternative: one `PATCH /api/repos/<id>` with optional `name`, `agent` and `forget`. It was rejected for the same
reason the previous change rejected a config patch: each route states one intent, is trivially validated, and maps
1:1 onto a UI action and a demo method.

### Labels move with the rest

`add-project-labels` (merged after this change was planned) put `RepoLabelsEditor` in the Tracked repositories section,
so it moves too. A fourth route, `POST /api/repos/<id>/labels` (`{ labels?, hiddenLabels? }`), replaces either list. An
empty list deletes the key, and validation is the config schema's own label rules via `validateConfig`, so the error
messages match a `PUT`. On the overview, a **Labels** button on each row and tile opens a `Modal` around the unchanged
editor. Its `onChange(patch)` calls the route instead of patching a draft. A table row has no room for an inline
editor, and a dialog keeps the suggestions datalist and the detected-label toggles together.

### Renames show at once by overlaying config names

`enabledOnly` becomes the place where the snapshot is reconciled with the config. Besides dropping disabled
repositories, it replaces each `RepoSnapshot.name` with the configured name when the two differ. Every view (overview,
boards, repo groups, top-bar error indicators, cards' `repoName`) already reads the snapshot through `shown`, so a
rename is visible everywhere at once. The next scan agrees with it.

Alternative: trigger a scan on rename. That costs a full scan for a label, and the name would still lag by the scan
duration.

### Overview controls

- The row's actions cell (`td.row-actions`) and the tile header's `tile-actions` get the agent toggle, and when it
  applies, the agent picker. Both use `stopPropagation`, like `DisableButton`, so the row's click-to-open does not fire.
  The toggle is a `<button role="switch" aria-checked>` with a visible **Enabled** / **Disabled** label. It is not a
  checkbox, so its state reads the same in both layouts and to a screen reader. When `config.agentSessions.enabled`
  is false it gets `aria-disabled`, a tooltip with the reason, and a small link to `/settings?section=agents`.
- The overview needs the project's `RepoConfig` for these controls. Row building (`overviewRows`) stays
  snapshot-based. The overview looks the config entry up by id when it renders the controls, the same way
  `pendingRows` reads the config.
- **Rename** is a small pencil button beside the name. The `RepoLink` is swapped for an `<input>` while editing. The
  editing id lives in the overview's state, so only one field is open at a time. Enter and blur save, and Escape
  cancels. The input stops click and keydown propagation, so neither the row's click-to-open nor any outer key handler
  reacts to it.
- **Forget** is a new `TrackingAction` on disabled entries in `UnmanagedSection`, beside Enable. After it succeeds it
  calls `rediscover`, like Enable and Ignore.
- `useTracking` grows `rename(id, name)`, `setAgent(id, patch)` and `forget(id)`, reusing `run`, `busy` and `errors`.
  So the rule is still one action in flight per repository, with the reason shown on that repository. Optimistic UI
  is not needed: the response is the saved config, and it goes to the shell right away.

### Settings no longer owns `repos`

`settings.tsx` drops the `tracked` section, `settingsSections.ts` drops `"tracked"` from `SECTION_IDS`, and
`AgentSettings` drops its Repositories list in favour of a one-line hint with a link to `/`. The draft still holds
`repos` because `Config` does, so **Save** sends `{ ...draft, repos: <repos of the latest config prop> }`. A draft
seeded before an overview change therefore cannot revert it.

Removing an agent profile used to clear the matching `agentId`s in the draft's repos. That now happens at save time,
on the repos taken from the latest config: any `agentId` that no longer names a profile is dropped. Otherwise
`validateConfig` would reject the save with "unknown agent".

Alternative: make `PUT /api/config` ignore `repos` on the server. That is cleaner against two tabs, but it changes the
endpoint's contract, which `test/` and other callers rely on. A two-tab conflict between a dirty Settings draft and
the overview is the same accepted risk as in `simplify-project-mgmt`.

### Demo

`demoApi.ts` implements `renameRepo`, `setRepoAgent` and `forgetRepo` on its in-memory config with the same refusals
(404, 400 and 409 as `ApiError`). The `Api` interface enforces their presence. The demo's sample has agent sessions
on, so the toggle is live there.

## Risks / Trade-offs

- [Rows get crowded: Pull, Disable, the toggle, the picker and the pencil in one cell] → The picker only appears with
  more than one profile. The toggle is compact, and the pencil sits beside the name, not in the actions cell. The
  narrow-screen table layout needs a check in the browser, which the tasks include.
- [Forget without a confirmation loses a custom name and agent choice] → Forget is offered only on already-disabled
  entries, so it always takes two deliberate clicks. Its tooltip says what is lost. The repository comes back as a
  candidate if it is still under a root.
- [Snapshot name and config name disagree until the next scan, for consumers outside `shown` (e.g. the activity
  log's recorded names)] → Those record what was observed, by design (invariant 5), and the next scan converges.
- [An old bookmark to `/settings?section=tracked`] → It falls through `parseSection` and opens at the top, as the spec
  states.

## Migration Plan

No data migration. The config format is unchanged (`repos[].name`, `repos[].agent` as before). Rollback is a plain
revert: older versions show the same settings in Settings again.
