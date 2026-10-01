# Design

## Context

Repository management works through a draft today. `src/ui/settings.tsx` keeps a draft `Config`, runs
`POST /api/discover` against the draft roots, and lists candidates and integratable repositories (with Enable, Ignore
and Integrate). Nothing takes effect until **Save** sends the whole config with `PUT /api/config`. The overview
(`src/ui/overview.tsx`) only shows enabled repositories that are in the snapshot. When there are none it renders the
full-page `NoRepos` empty state, which points to Settings.

The server has two places that write the config. `putConfig` in `src/server/api.ts` replaces the whole config.
`confirmIntegration` in `src/server/integration.ts` reads `state.config`, appends a repository, and awaits
`saveConfig`. Neither is serialised against the other. With one writer at a time, from the Save button, that was fine.
Instant actions on the overview add more writers that can overlap. See proposal.md for the motivation and the specs
for the behaviour.

## Goals / Non-Goals

**Goals:**
- Instant, narrow config updates that cannot lose each other's change.
- One place in the UI that lists everything the user can bring into the overview.
- Settings stays a draft-and-save page for real configuration only.

**Non-Goals:**
- A server-side cache of discovery results. Discovery stays a stateless, read-only walk on request.
- Changing `PUT /api/config`'s contract, or making Settings' tracked list save instantly.

## Decisions

### Narrow endpoints instead of the client sending a whole config

The overview could reuse `PUT /api/config` with `{...config, repos: patched}`. We don't do that, for three reasons.
The client's copy can be stale, for example after an integration was confirmed on the server or a save from another
tab, and a whole-config PUT would silently undo that change. A whole-config PUT also cannot check that a path is a
real candidate. And the demo would need the same patching logic. Instead there are three routes, each stating one
intent: `POST /api/repos/track`, `POST /api/repos/<id>/enabled` and `POST /api/ignore-paths`. The server applies each
one to the config as it currently is. `track` checks the path against discovery over the saved roots and ignore
paths, in the same way `startIntegration` checks `integratablePaths`. A path the user could not have seen on the
overview cannot be tracked.

The alternative was a single `PATCH /api/config` taking JSON-patch-like operations. It is more general than we need,
and harder to validate.

### One serialised config writer

`src/server/config.ts` gets `updateConfig(state, (current) => next)`. It chains on a promise held in module state:
each update awaits the previous one, calls `fn` with the latest `state.config`, validates the result with
`validateConfig`, saves it atomically, assigns it to `state.config`, and returns the previous and the saved config.
`putConfig`, `confirmIntegration` and the three new routes all go through it. Scan triggering moves into one helper,
`afterConfigChange(state, previous)`: it restarts the scanner on an interval change and triggers a scan when the
enabled set changed. `putConfig` and the new routes call it, so their rules stay the same.

Discovery for `track` runs *before* the update is queued. It is slow and read-only, so it should not hold the queue.
Inside `fn` the route then re-checks only the cheap facts: whether the id is already configured, and the name
collision.

### Overview structure

- `src/ui/discoveryState.ts`: a small store, outside any component, holding the latest `DiscoverResult`, a `running`
  flag and a sequence number, so that only the latest run is applied. Navigating away and back keeps the last result
  on screen while a new run starts. It is used by the overview and by Settings' roots summary. Settings calls it with
  draft roots and the overview with none, so each run uses its own inputs. Results are tagged with the inputs they
  came from, so a draft-roots result is never shown on the overview.
- `src/ui/untracked.tsx`: the Unmanaged projects section, one list with a kind label per entry, the per-entry busy and error
  state, and Integrate. The integrate logic (`runningFor`, `startIntegration`, the per-row error) moves here from
  `settings.tsx` unchanged.
- `overviewState.ts` gains `untrackedEntries(config, discover, q)`: one list ordered by name then path, search, and removing
  candidates whose id is configured (to cover the gap between an Enable and the next discovery result). It also
  gains `pendingRows(config, snapshot)`, which returns enabled ids missing from the snapshot and becomes the
  `Scanning…` rows. Name hints are computed once over tracked rows, pending rows and untracked entries together,
  using `nameHints`.
- The app shell owns `config`. The overview gets an `onConfig(config)` callback, the same one Settings' `onSaved`
  uses, so a tracking action updates the shell's config. The tracked list then filters immediately, with no wait for
  a scan.
- **Disable** sits in the row's existing actions cell, next to Pull, and in the tile header. It uses
  `stopPropagation`, like the Pull button, so that the row's click-to-open does not fire.
- `NoRepos` stays for the boards. On the overview the empty tracked list is a smaller in-place empty state, and the
  section follows below it.

### Settings keeps discovery, but only as a summary

The Workspace roots section still runs discovery on root and ignore-path edits. It is the immediate feedback on a
typed root, and it reports per-root errors. It now renders one line: the counts of candidates and integratable
repositories, with a link to `/`. The `discovered` and `integratable` section ids are removed from `SECTION_IDS`, so
old deep links fall through `parseSection` as unknown. The tracked list keeps its draft checkbox, rename and forget.

### Demo

`demoApi.ts` implements `trackRepo`, `setRepoEnabled` and `ignorePath` on its in-memory config. The `Api` interface
forces this: without them, typecheck fails. The demo's `discover` already filters out tracked ids. The integratable
sample in `sampleData.ts` stays, and only where it is shown changes.

## Risks / Trade-offs

- [Settings open with a dirty draft while the user enables a repository on the overview in another tab] → Saving
  the draft would overwrite it, as it does today with any two-tab edit. Mitigation: Settings already re-seeds its
  draft from the shell's config whenever it is not dirty. We accept the dirty case and do not add merge logic.
- [Discovery on every overview open costs a walk plus a `git remote` per candidate] → It already ran on every
  Settings open. The result is cached client-side and shown at once, the walk is depth-bounded, and it never blocks
  the tracked list.
- [An Enable succeeds but the first scan fails] → The pending row turns into a normal row with the scan-failed
  warning, which is the existing behaviour for a failing repository.
- [Ignore on the overview persists at once, while Settings' Ignore did not] → It is reversible. The path is listed
  under Ignored paths in Settings with **remove**. The button tooltip says where to undo it.

## Migration Plan

No data migration. The config format is unchanged. Rollback is a plain revert, and configs written by this version
load in the previous one.
