## Why

Since cards are grouped by repository, a column with several repositories reads as one long list: the group header is a small 11px medium-weight label, groups are separated by only 4px more than cards are, and nothing encloses the cards that belong together. Finding where one project ends and the next begins takes effort, which defeats the point of grouping.

## What Changes

- The repository name in a group header is rendered bold (weight 700; the bundled Space Grotesk already covers 300–700, so no font change).
- Each repository group becomes a visible panel: a subtle background tinted with the repository's colour, a matching hairline border, the usual 4px radius and inner padding, so header and cards are enclosed together.
- Spacing between groups becomes clearly larger than spacing between cards inside a group.
- The tint is derived from tokens (repository colour mixed into the column background with a per-theme strength token), so it adapts to dark and light themes and introduces no literal colours.
- Cards keep their own background and left accent so they still stand out from the panel; repository-coloured text keeps the required 4.5:1 contrast against the tinted panel, guarded by a test.
- Unchanged: group order, counts, filtering, the flat (ungrouped) rendering on single-repository boards, and all data/API behaviour.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `kanban-board`: adds a requirement that repository groups are visually distinct (bold name, repo-tinted enclosing panel, group spacing larger than card spacing, contrast preserved in every theme).

## Impact

- `src/ui/styles.css`: `.repo-group`, `.repo-group-head`, two new tokens (`--repo-group-mix`, `--repo-group-border-mix`) in both theme blocks.
- `src/ui/kanban.tsx`: no structural change expected (the group already is a `section.repo-group.repo-tint` wrapping header and cards).
- `test/repoContrast.test.ts` (new): computes contrast of the repository colour against the tinted panel for all 24 hues in both themes from the token values in `styles.css`.
- No server, API, config or dependency changes.
- `styles.css` is also touched by the in-flight `truncate-branch-name` change (card badge rules); this change stays within the `.repo-group*` rules and the repo token lines.
