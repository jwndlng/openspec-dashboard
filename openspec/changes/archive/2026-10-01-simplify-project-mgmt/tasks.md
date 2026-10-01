# Tasks

## 1. Serialised config writes (server)

- [x] 1.1 Add `updateConfig(state, fn)` to `src/server/config.ts`. Updates are chained one after another, each runs `validateConfig` and saves atomically, and the function returns `{ previous, saved }`. Verify with a `config.test.ts` case where two concurrent updates both persist.
- [x] 1.2 Extract `afterConfigChange(state, previous)` (scanner restart on an interval change, trigger when the enabled set changed, `forgetOrigins`). Route `putConfig` and `confirmIntegration` through `updateConfig` and the helper. Verify that the existing `api.test.ts` and `integration.test.ts` still pass.

## 2. Tracking endpoints (server)

- [x] 2.1 Add `POST /api/repos/track` `{ path }`. A configured id is re-enabled and keeps its name. Otherwise the path must be a current candidate under the saved roots and ignore paths, and is added with `enabled: true` and `availableName`. Anything else gets `404`. Verify with `trackingApi.test.ts` cases: track a candidate, re-enable a renamed repository, a 404 for an integratable repository and for a path below an ignore path, and the scan triggered.
- [x] 2.2 Add `POST /api/repos/<id>/enabled` `{ enabled }`: `404` for an unknown id, `400` for a non-boolean, the name is kept, and a scan is triggered. Verify with `trackingApi.test.ts` cases.
- [x] 2.3 Add `POST /api/ignore-paths` `{ path }`. The path is canonicalised and added once, a relative path gets `400`, and configured repositories are untouched. Verify with `trackingApi.test.ts` cases.
- [x] 2.4 Verify all three routes return `403` cross-site with the config unchanged, and that a concurrent track plus disable both persist (`trackingApi.test.ts`).

## 3. Client API and demo

- [x] 3.1 Add `trackRepo(path)`, `setRepoEnabled(id, enabled)` and `ignorePath(path)` to the `Api` interface and the HTTP client in `src/ui/api.ts`. Verify with `bun run typecheck`, which fails until the demo implements them.
- [x] 3.2 Implement the three operations in `src/ui/demo/demoApi.ts` on the in-memory config, with no persistence. Verify with a `demoApi.test.ts` case where Enable moves the sample candidate into the config, and a reload (fresh API) restores it.

## 4. Overview: state helpers

- [x] 4.1 Add `src/ui/discoveryState.ts`. It holds the latest result tagged with its inputs, a running flag, and applies only the latest run. Verify with unit tests for out-of-order completion and for a draft-roots result not being served to the overview.
- [x] 4.2 Add to `overviewState.ts`: `untrackedEntries(config, discover, q)` (Disabled, Discovered, Without OpenSpec; ordered by name then path; search applied; configured ids removed from discovered), `pendingRows(config, snapshot)`, and name hints across tracked, pending and untracked entries. Verify with `overview.test.ts` cases.

## 5. Overview: UI

- [x] 5.1 Create `src/ui/untracked.tsx`, the Untracked & disabled section: heading with count, three headed groups (empty ones omitted), path, hint and same-remote badge, Enable/Ignore with a busy state and a per-entry error, Rediscover, the discovering indicator, per-root errors and the no-roots hint linking to `/settings?section=roots`. Verify with a new `test/untrackedUi.test.ts`.
- [x] 5.2 Move Integrate from `settings.tsx` into the section: `Setting up…` while running, the unavailable reason stated once, and the start error on the entry. Verify in `untrackedUi.test.ts` with sessions on, off, and with a failed start.
- [x] 5.3 In `overview.tsx`: render the section below the tracked list in both layouts, hide it while Work in progress is on, render `Scanning…` pending rows and tiles, and replace the full-page `NoRepos` on the overview with an in-place empty tracked state. Run discovery on open when roots exist. Verify with `overview.test.ts` and `untrackedUi.test.ts`.
- [x] 5.4 Add **Disable** to the row actions cell and the tile header, with `stopPropagation`, a busy state and an error. Verify that a click disables without navigating and the repository moves to the Disabled group (`untrackedUi.test.ts`).
- [x] 5.5 Pass `onConfig` from `app.tsx` to the overview so tracking actions update the shell's config at once. After Enable or Ignore, re-run discovery. Verify that the repository moves between the lists before any scan completes.
- [x] 5.6 Style the section, groups, pending rows and Disable control in `styles.css` for light and dark themes and at 720px and below. Verify by running `bun run dev` and checking both layouts and themes.

## 6. Settings

- [x] 6.1 Remove the `discovered` and `integratable` sections from `settings.tsx` and `SECTION_IDS`, and drop the candidate and integrate state. Verify with `settingsSections.test.ts`: the section list, and `?section=discovered` parsed as unknown.
- [x] 6.2 Add the Workspace roots summary line: counts of candidates and repositories without OpenSpec, a link to Projects, and per-root errors kept. Name hints over tracked repositories only. Update the tracked-section hint text ("forgetting returns it to Projects"). Verify in a Settings UI test.

## 7. Docs and checks

- [x] 7.1 Update `README.md` (first run: add a root in Settings, enable repositories on Projects; integrating is done from Projects). Verify the text matches the UI.
- [x] 7.2 Run `bun run check` and confirm it passes. Run `bun run build`, then confirm `dist/openspec-dashboard` serves the overview with the new section and that the demo build lists and enables the sample repositories.

## 8. Managed and unmanaged projects (follow-up after review)

- [x] 8.1 Put the headline `Managed projects · <n>` above the table, tiles or empty state, and rename the lower section to `Unmanaged projects · <n>` with Rediscover beside its headline. Verify with `untrackedUi.test.ts` (headline text and count).
- [x] 8.2 Replace the three groups with one list ordered by name then path, each entry labelled `disabled`, `OpenSpec` or `no OpenSpec` (with a tooltip) and offered only its actions. Verify with `overview.test.ts` (ordering) and `untrackedUi.test.ts` (labels, no sub-headings, actions per entry).
- [x] 8.3 Update the delta specs, proposal, design and README to the two sections. Verify with `openspec validate simplify-project-mgmt --strict`.
- [x] 8.4 Visual check of both headlines and the single list in light and dark, table and tiles, and at 720px and below.

