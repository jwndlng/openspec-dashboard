# Design

## Context

`PullButton` (`src/ui/pull.tsx`) renders `btn sm` on the board header and `btn sm ghost` when called with `compact`,
which only the overview's row (`Row`) and tile (`Tile`) in `src/ui/overview.tsx` do. `.btn.ghost` has a transparent
border and background until hover. Beside it, the project **Console** button is `btn sm … on-project`, styled by
`.project-console-btn.on-project` (24px high, `0 8px` padding, 11px text, `--border-strong` border, transparent
background, `--bg-surface` on hover). The gear after them is an icon-only ghost button and stays that way.

## Goals / Non-Goals

**Goals:**
- Pull on an overview row and tile is bordered at rest and the same size as Console, in light and dark themes.

**Non-Goals:**
- The board header's Pull, **Pull all**, the outcome badges, the blocked-pull dialog and the gear's look.
- Any change to what Pull does.

## Decisions

- **Replace `compact` with `variant?: "board" | "overview"`.** The prop now names where the button sits rather than a
  look that no longer exists; `"overview"` adds the class `on-overview` and no `ghost`. The default stays the board
  look, so `kanban.tsx` is untouched.
- **Share Console's rule rather than copy its values.** `.pull-btn.on-overview` joins the selector list of
  `.project-console-btn.on-project` and its `:hover`, so the two controls cannot drift apart. Alternative considered:
  dropping `ghost` and keeping plain `btn sm` — bordered, but 3px taller and a size larger than Console on the same line.
- **Tests read the vnode and the stylesheet**, as `test/overviewStyles.test.ts` and `test/projectSettingsUi.test.ts`
  already do: the `PullButton` in a row and a tile is given `variant: "overview"`, the rule for `.pull-btn.on-overview`
  sets a visible `border-color`, and `ghost` is not applied to it.

## Risks / Trade-offs

- [The row's actions cell grows by a border's width] → the actions already stay on one line with the bordered Console
  (project-overview "Table rows keep their content inside their own cells"); check at 200% zoom in the browser.
