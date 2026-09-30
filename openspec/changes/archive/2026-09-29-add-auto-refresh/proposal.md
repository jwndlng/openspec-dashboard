# Proposal

## Why

The board only shows what the last scan found, and getting anything newer means clicking **Refresh** by hand: the
periodic re-fetch in the UI just re-reads the snapshot the server already has, and the server rescans only every
`pollIntervalSeconds` (60 by default). While the user works in a repository — or watches an agent session tick tasks
off — the board goes quietly stale and the only cure is a click. The dashboard should be able to keep itself current,
at a cadence the user chooses, without turning the poll interval that governs the whole server into a UI setting.

## What Changes

- Add an **auto-refresh** control beside **Refresh** in the hero's status corner: a dropdown with `Off`, `2s`, `5s` and
  `10s`.
- While an interval is chosen, the dashboard repeats what **Refresh** does on that cadence — `POST /api/scan`, then
  re-fetch `GET /api/state` — so the data is genuinely re-read from the repositories rather than the same snapshot
  being fetched again.
- Auto-refresh is **off by default**. The choice is remembered per browser in `localStorage`, like the theme
  preference, and is not written to the dashboard config, so it is neither shared between machines nor able to change
  the server's `pollIntervalSeconds`.
- A tick is skipped rather than queued while a refresh is already in flight (manual or automatic), and the next tick
  is timed from the previous one finishing, so a 2s interval cannot pile up scans on a slow repository.
- Ticks stop while the page is hidden and resume when it becomes visible again, so a forgotten background tab does not
  scan every two seconds forever.
- Auto-refresh drives only a scan and a re-fetch. It never triggers the pull action, which stays bound to the user's
  explicit click.
- The existing `Refresh` button, the `updated <age>` label and the server's own poll interval keep their current
  behaviour; auto-refresh is added beside them, nothing is removed.

## Capabilities

### New Capabilities

None. Refresh behaviour and the status corner it lives in are already owned by `kanban-board`.

### Modified Capabilities

- `kanban-board`: the "Board refreshes from the snapshot" requirement gains automatic refreshing — the interval
  control, its options and default, where the choice is remembered, the no-overlap and hidden-page rules, and that a
  tick scans rather than only re-fetching. The "The dashboard opens with a hero header" requirement's status corner
  gains the control.
- `change-detail`: "The detail view follows the regular refresh" currently ties the detail view's re-read to *the poll
  interval*; it follows whatever cadence produces a new snapshot, so with auto-refresh on it re-reads on that cadence
  instead. The requirement is reworded to say so, and to keep the rule that an unchanged refresh resets neither the
  selection nor the scroll position at a 2s cadence.

## Impact

- `src/ui/app.tsx` — owns `refresh`, the periodic `loadState` effect and the status corner; gains the auto-refresh
  timer and the control.
- `src/ui/autoRefresh.ts` (new) — the interval options, parsing and the `localStorage` read/write, kept pure and
  separately testable in the shape of `src/ui/theme.ts`.
- `src/ui/styles.css` — a status-corner-sized variant of the existing `.control.select-control` used by the filter bar.
- `test/autoRefresh.test.ts` (new) — the option list, parsing, storage round-trip and the tick/skip logic.
- No server change: `POST /api/scan` and `GET /api/state` are used exactly as **Refresh** uses them, and the scanner
  already refuses to start a second concurrent full scan, which is what makes a 2s cadence safe.
- No config or API schema change, so `dashboard-api`, `repo-discovery` and `settings-page` are untouched and
  `pollIntervalSeconds` keeps its 10s floor.
- No new dependency, no network beyond what a scan already does, and nothing written to a tracked repository —
  scanning is read-only, and the pull action is explicitly not driven by the timer.
- The demo build needs no new mock operation: its `scan()` already advances the snapshot time.
