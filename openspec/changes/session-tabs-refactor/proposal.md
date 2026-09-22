# Proposal

## Why

The dock's tab strip is hard to read. A tab whose session is not shown has no background and no border of its own, so
all that is left of it is the repository's 3px accent bar floating next to some text — it reads as a stray border, not
as a tab. The strip is 36px tall and the tabs inside it are padded tightly around a 16px badge, which makes every tab
look squeezed. And the tab that has the keyboard focus differs from the other shown tabs only by a 1px top border in
the brand colour, which is easy to miss once two or three sessions are shown.

## What Changes

- Every session tab gets a surface of its own — a background and a border — whether or not its session is shown, so a
  tab that is not shown reads as a tab and the repository accent sits on its edge instead of floating in the strip.
- A tab whose session is shown stays visually attached to the panes below it, so "not shown" and "shown" are told
  apart by shape as well as by the existing ▢/▣ mark.
- The focused tab — the pane the keyboard is in — gets a clearly stronger marking than the other shown tabs: a thicker
  brand-coloured top bar and heading-strength text, matching the focused pane's own top bar.
- The tab strip grows taller and the tabs get more vertical padding, so tab, repository name, change and badge are no
  longer pressed against each other; the space the collapsed dock reserves below the board grows with it.
- **Not changed:** what the strip lists, the order of tabs, the ▢/▣ marks, the repository colours and their contrast
  guarantees, keyboard operation, and what selecting a tab does.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `kanban-board`: adds a requirement that every tab in the dock's tab strip is drawn as a tab of its own, that shown
  and not-shown tabs differ in shape, and that the focused tab is marked more strongly than the other shown tabs.
  Existing requirements on the strip (content, marks, repository colour, contrast) are unchanged.

## Impact

- `src/ui/styles.css` — `.dock-bar`, `.session-tabs` and `.session-tab` rules (surface, border, height, focused marking).
- `src/ui/sessionState.ts` — `DOCK_TABS_HEIGHT` follows the new strip height.
- A dock-geometry test asserting the strip's CSS height equals `DOCK_TABS_HEIGHT`.
- `src/ui/sessionPanel.tsx` — only if the markup needs a hook for the new styling; behaviour stays the same.
- `test/repoContrast.test.ts` — only if a tab background other than `--bg-base`/`--bg-section` is introduced (the plan
  is to avoid that).
- The demo site uses the same stylesheet and picks the change up without its own edits.
- No server, API or dependency change.
