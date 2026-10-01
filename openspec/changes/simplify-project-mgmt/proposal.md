# Proposal

## Why

Bringing a repository into the dashboard happens in Settings. The user finds the Discovered list, presses Enable,
remembers to Save, and goes back to Projects to see the repository. Disabling one works the same way in reverse, and
the integratable repositories (the ones without OpenSpec) sit in a third Settings list. All of these choices are about
what the Projects overview shows, so the overview is where the user should make them. Settings should keep only what
is real configuration: the roots, the ignore paths, names, and forgetting a repository.

## What Changes

- The Projects overview gets a second section, **Untracked & disabled**, below the tracked repositories. It lists
  three groups in a fixed order:
  - tracked repositories that are disabled, each with **Enable**;
  - discovered OpenSpec repositories that are not tracked yet (today's "candidates"), each with **Enable** and
    **Ignore**, plus the "same remote as" badge;
  - git repositories without OpenSpec (today's "integratable" repositories), each with **Integrate** (or the reason
    it is unavailable, or **Setting up…** while a session runs) and **Ignore**.
  The search filter also applies to this section. It is hidden while the Work in progress filter is on, and it looks
  the same in the Table and Tiles layouts.
- Every tracked repository on the overview, in both a row and a tile, gets a **Disable** action. Disabling moves the
  repository down into the lower section.
- Enable, Disable and Ignore on the overview **take effect immediately**: no draft, no Save. Each one is a narrow
  server-side update of the saved config, run one at a time with any other config write so that two quick clicks
  cannot lose each other's change. A scan is triggered when the set of enabled repositories changed. A repository that
  was just enabled is shown in the tracked list as **Scanning…** until its first scan arrives. It does not disappear
  from the page in between.
- Discovery runs on the overview: when the overview opens with at least one saved workspace root, after each Enable or
  Ignore, and when the user presses **Rediscover** in the section. It always uses the saved roots and ignore paths.
  Per-root errors are shown in the section with a link to the Workspace roots settings. With no roots configured, the
  section says so and links there.
- The full-page "No repositories tracked yet" empty state becomes an empty tracked section. The Untracked & disabled
  section is still shown below it, so a first-time user can enable repositories right on the landing page.
- **BREAKING (UI)**: Settings loses the **Discovered** and **Without OpenSpec** sections and their navigation entries.
  The Workspace roots section still runs discovery against the edited roots so that it can show per-root errors. It
  adds a single line with the number of untracked repositories found and a link to Projects. Tracked repositories in
  Settings keep their enable checkbox, rename and forget, all under the existing draft and Save.
- New API routes, all same-origin guarded, that write only the dashboard's own config:
  `POST /api/repos/track` (`{ path }`) adds a discovered OpenSpec repository, enabled, with its default name, or
  re-enables a configured one. `POST /api/repos/<id>/enabled` (`{ enabled }`) switches a configured repository.
  `POST /api/ignore-paths` (`{ path }`) appends an ignore path. `PUT /api/config` is unchanged.
- The demo moves its discovered and integratable sample repositories, and the simulated integration, from Settings to
  the overview. The mock API implements the new operations in memory.

## Capabilities

### New Capabilities

None. The behaviour belongs to existing capabilities.

### Modified Capabilities

- `project-overview`: the landing page and empty state now include the Untracked & disabled section. New
  requirements cover the section itself, immediate Enable/Disable/Ignore, the pending "Scanning…" row, and discovery
  on the overview.
- `repo-discovery`: discovery is triggered from the overview, not when Settings opens. The Settings view no longer
  lists candidates or integratable repositories. The shared-remote badge is shown on the overview.
- `settings-page`: the section list drops `discovered` (and the undocumented `integratable`), and the navigation-count
  requirement drops the Discovered count.
- `dashboard-api`: a new requirement for the tracking endpoints (track, enabled, ignore-paths) and the serialised
  config updates behind them.
- `demo-site`: the integratable sample repository and its simulated integration are on the overview, not in Settings.

## Impact

- `src/server/config.ts`: a serialised `updateConfig(state, fn)` used by `PUT /api/config`, the new routes and the
  integration confirmation (`src/server/integration.ts`), so concurrent config writes cannot lose updates.
- `src/server/api.ts`: the three routes, behind `crossSiteRefusal`, with scan triggering shared with `putConfig`.
- `src/shared/types.ts`, `src/shared/nameHints.ts`: request types, and name hints across both overview sections.
- `src/ui/api.ts` and `src/ui/demo/demoApi.ts`, `src/ui/demo/sampleData.ts`: the new operations, in HTTP and in
  the demo.
- `src/ui/overview.tsx`, `src/ui/overviewState.ts`, a new `src/ui/untracked.tsx` (the lower section) and
  `src/ui/discoveryState.ts` (the overview's discovery runs: latest result wins, previous result shown while
  re-running), `src/ui/empty.tsx`, `src/ui/app.tsx` (config updates from the overview), `src/ui/styles.css`.
- `src/ui/settings.tsx`, `src/ui/settingsSections.ts`: the two sections removed, the roots summary line added.
- `test/`: `api.test.ts` (new routes, guard, scan trigger, serialised writes), `config.test.ts`, `overview.test.ts`,
  `settingsSections.test.ts`, `discover.test.ts` where the triggers are asserted, the demo tests, and a new
  `untrackedUi.test.ts`.
- `README.md`: getting started now says to enable repositories on Projects.
- Invariant 1 is untouched. The new routes write only `~/.openspec-dashboard/config.json`, and discovery stays
  read-only towards repositories. Invariant 2a: each new route goes through `crossSiteRefusal`. No new dependency
  and no network.
- **Overlap**: `link-prs-to-changes` and `add-validate-phase` touch neither `overview.tsx`'s rows nor Settings'
  discovery sections. `add-validate-phase` avoids `repo-discovery`'s agent-settings requirement, and this change
  does not touch that requirement either.

## Non-goals

- Renaming or forgetting a repository from the overview. Both stay in Settings.
- Disabling or enabling from a repository's board header.
- Running discovery in the background, on a timer, or during a scan.
- Changing what discovery finds or how integration works. Only where they are shown and triggered changes.
