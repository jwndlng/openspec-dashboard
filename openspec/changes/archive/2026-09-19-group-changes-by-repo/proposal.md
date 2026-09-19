## Why

On the combined Kanban, cards from 17+ repositories are interleaved in every column, so it is hard to see which changes belong together: the only cue is a small grey repository label on each card, and every card looks the same. Grouping each column's cards by repository and giving every repository its own colour makes "these are the same project" readable at a glance, and lets the eye follow one repository across columns.

## What Changes

- Within every board column (including the expanded `Archived` column), cards are **grouped by repository**: each group has a small header with the repository name and the number of cards in the group, and its cards sit together under it. Groups appear in the same order (repository name, case-insensitive) in every column, so a repository is found in the same relative place across the board.
- Every tracked repository gets **its own colour**, assigned automatically and deterministically from the repository id, so it is the same across reloads, scans and filter changes. Repositories tracked at the same time get distinct colours (up to the palette size).
- The repository colour is shown on the group header, as an accent stripe on each of the group's cards, on the card's repository label, and on the repository filter chips, which thereby double as the colour legend.
- Colours are theme-aware: the repository only contributes a hue; saturation and lightness come from the theme so the colours stay legible in both dark and light themes. Colour is never the only cue — the repository name is always shown alongside it.
- No configuration: colours are not user-editable and nothing is persisted (see design non-goals).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities
- `kanban-board`: adds two requirements — cards within a column are grouped by repository, and each repository has a distinct, stable, theme-aware colour used on groups, cards and filter chips. Existing requirements are unchanged (in particular "Cards show repository, name, progress, activity and branch", which the in-flight `add-project-overview` change already modifies, is deliberately not touched).

## Impact

- `src/ui/repoGroups.ts` (new): pure helpers — hue assignment for a set of repository ids, and grouping/ordering of a column's cards by repository.
- `src/ui/kanban.tsx`: `Column` and `ArchivedColumn` render repository groups; cards, group headers and filter chips receive the repository hue as a CSS custom property.
- `src/ui/styles.css`: group header and accent styles; repository colour derived from `--repo-hue` with per-theme saturation/lightness tokens (no literal colours in components).
- `test/repoGroups.test.ts` (new): unit tests for hue assignment (deterministic, distinct, stable under filtering) and grouping order.
- `README.md`: one line on grouping and colours.
- No server, API, snapshot, config-file or dependency changes.
- Interplay with in-flight changes: `add-project-overview` introduces a single-repository board; there, group headers are redundant and are omitted (one group), while the repository colour can still accent its header. No conflicting spec deltas.
