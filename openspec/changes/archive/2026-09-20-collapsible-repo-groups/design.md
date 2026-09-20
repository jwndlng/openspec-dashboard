## Context

`RepoGroups` in `src/ui/kanban.tsx` renders, per column, one `<section class="repo-group repo-tint">` per repository: a `.repo-group-head` (swatch, bold name, count) followed by the cards. `Column` passes it the already filtered cards; for `Archived` the cards are first bounded to the 25 most recent. On a single-repository board (`showRepo` false) cards render flat without groups. Board filters live in the URL query string; the only browser-persisted UI preference so far is the theme (`localStorage`, pure logic in `src/ui/theme.ts` with thin storage effects, unit-tested without a DOM). The `Archived` column is specified as "always open, no collapse control of its own" — that rule is about the column and stays.

## Goals / Non-Goals

**Goals:**
- Reduce any repository group to its header line and back with one click or key press.
- `Archived` groups start minimized; everything else starts expanded.
- Choices survive reloads, scans and filter changes without any server state.
- Never hide what the user is explicitly searching for.

**Non-Goals:**
- "Collapse all / expand all" controls, per-column collapse, or per-repository collapse across columns.
- Group headers (and therefore minimizing) on single-repository boards.
- Syncing the state across browsers or putting it into the URL.
- Virtualising or lazy-loading cards.

## Decisions

### D1: State is a map of deviations from the default
`minimized(repoId, column) = overrides[key] ?? defaultMinimized(column)` with `defaultMinimized(column) = column === "Archived"` and `key = "<repoId>|<column>"`. Toggling computes the new value and **removes** the key when it equals the default, otherwise stores it. So storage only ever holds explicit deviations, newly tracked repositories and new columns get the defaults automatically, and changing a default later does not fight stale data.

*Alternative:* store the full state of every group — rejected: grows with repos × columns and freezes today's defaults for everyone who ever toggled once.

### D2: Pure module + thin storage effect, like the theme
New `src/ui/groupState.ts`: `defaultMinimized`, `groupKey`, `isMinimized`, `toggleGroup(overrides, repoId, column)`, `parseGroupState(raw)` (tolerant: invalid JSON, non-object, non-boolean values → dropped), `serializeGroupState`, `pruneGroupState(overrides, knownRepoIds)`; plus `loadGroupState()` / `saveGroupState()` wrapping `localStorage` in try/catch (private mode, quota). Storage key `openspec-dashboard.groups.v1`. Tested in `test/groupState.test.ts` without a DOM.

Pruning runs on save against the repository ids of the current snapshot (all repos, not the filtered ones), so entries of forgotten repositories do not accumulate.

### D3: One hook at board level, state passed down
`Board` owns `const [overrides, setOverrides] = useState(loadGroupState)` and a `toggle(repoId, column)` that updates state and saves. `Column` forwards `label`, `overrides`, `onToggle` and `forceExpanded` to `RepoGroups`. Keeping it in one place means a toggle in one column re-renders consistently and there is a single writer to storage. Two tabs do not live-sync (no `storage` listener); last writer wins, which is fine for a view preference.

### D4: Search forces groups open, without touching stored state
When `filters.q.trim()` is non-empty, `forceExpanded` is true: every rendered group shows its cards (all rendered groups contain matches, since grouping happens after filtering), and the toggle is disabled (`aria-disabled`, tooltip "expanded while searching") so a click cannot silently change a state the user cannot see. Clearing the search restores the stored/default state. Repository, stale and hide-archived filters do **not** force expansion — they narrow what is on the board, they do not look for a specific card.

*Alternative:* let search respect minimized groups and show "n matches" on the header — rejected as the default: finding an archived change by name is the main reason to search, and it would land in a minimized group every time.

### D5: Header is a real button
`.repo-group-head` becomes `<button type="button" aria-expanded aria-controls>`; the cards live in a sibling `<div id=…>` that is not rendered when minimized (cheaper than hiding up to 25 cards per group with CSS, and nothing focusable stays hidden). A chevron (`aria-hidden`) sits before the swatch: a CSS-drawn triangle pointing right when minimized and rotated down when expanded — text glyphs (`▸`/`▾`) rendered as a barely visible dot at 10–11px. Count stays right-aligned and is identical in both states. The `section` keeps `aria-label={repoName}`.

Styles: button reset (no border/background, inherits font, full width, `cursor: pointer`), `:hover` and `:focus-visible` states using existing tokens, and a minimized panel drops its inner gap so it is exactly one line high. Panel tint, border and group spacing from `emphasize-repo-groups` are unchanged.

### D6: `Archived` specifics
Grouping still happens after bounding to the 25 most recent, so a minimized archived group's count is the number of its cards within the bound (what expanding it will show), and the column header keeps reading `25 of <total>`. On single-repository boards the `Archived` column keeps showing cards flat — there is no group to minimize (see Open Questions).

## Risks / Trade-offs

- [Archived changes become one click further away] → Intended by the change; search opens them automatically (D4) and the choice to expand a group is remembered (D1).
- [A fully minimized column looks empty-ish] → Headers still show repository names and counts, and the column count is unchanged.
- [`localStorage` unavailable or corrupted] → Load/save are wrapped and tolerant; the board falls back to defaults and keeps working for the session via in-memory state.
- [Column labels are schema-derived strings; a renamed column orphans its overrides] → They simply fall back to defaults; pruning by repository id keeps the map small.
- [Shared files with in-flight `truncate-branch-name` and `create-change-from-dashboard`] → This change touches `RepoGroups`/`Column` props and `.repo-group*` rules only.

## Open Questions

- Should single-repository boards get a minimizable `Archived` section as well? Not needed for the stated goal (groups); can follow as its own small change if the flat 25-card column bothers in practice.
