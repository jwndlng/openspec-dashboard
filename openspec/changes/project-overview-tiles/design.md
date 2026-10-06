# Design

## Context

`Tile` in `src/ui/overview.tsx` is a hook-free function: `test/projectSettingsUi.test.ts` and `test/untrackedUi.test.ts`
call it directly and walk the returned node tree to find and activate its controls. Its CSS grid
(`src/ui/styles.css`, `.tile`) has four rows — head 40px, badges 46px, body `1fr`, footer `minmax(44px, auto)` — and the
PR line is a fifth, unplanned child, so it lands in the body row and pushes the figures around. The footer (`.checkouts`)
holds `TileCheckouts` plus `AgentControls`, which wraps onto extra lines. The settings controls in
`src/ui/projectSettings.tsx` each return `null` when they do not apply (no agent picker with one profile, no PR titles or
auto-merge without git, and so on) and each stops click propagation. The required zones are in the delta spec.

## Goals / Non-Goals

**Goals:**
- Fixed zones with fixed heights, so the same part sits at the same height on every tile.
- The settings move out of the footer without any change to the controls' behaviour, labels or accessible names.
- `Tile` stays hook-free and its controls stay reachable by walking its node tree.

**Non-Goals:**
- The table row, the pending tile's body, the Unmanaged projects section, the band and the filter bar.
- New settings, new actions, or a different behaviour for any existing control.

## Decisions

**Native `<details>` for Settings.** The disclosure is `<details class="tile-settings">` with a `<summary>` button. It
needs no state in `Tile`, so `Tile` stays hook-free, and the panel's controls are always in the tree — the existing
tests that find Disable, the toggles and the pickers on a tile keep working once they look inside the panel. `<details>`
also gives the open state (`open` attribute, exposed as expanded) and keyboard activation for free. The `details`
element stops click propagation, so neither the summary nor anything in the panel opens the board.
*Alternative:* a `useState` popover — rejected, it makes `Tile` a hook component that the tests cannot call directly.

**One panel open, Escape, outside click — handled once in `Overview`.** A single effect in `Overview` adds a document
`keydown` (Escape) and `pointerdown` listener and a capture-phase `toggle` listener. On a `toggle` that opened a
`details.tile-settings`, every other open one is closed. On Escape, the open panel closes and focus returns to its
summary. On a `pointerdown` outside the open panel, it closes. One listener set for the whole grid instead of one per
tile, and no state is kept: the DOM's `open` attribute is the state.

**The panel overlays the tile.** The tile becomes `position: relative`; the panel is absolutely positioned inside it,
covering the zones below the identity zone, with its own `overflow-y: auto`. Because the tile already has
`overflow: hidden` and a fixed height, the panel can neither grow the tile nor spill onto a neighbour. The footer stays
visible below it so Settings can be activated again to close it.

**Labelled lines from the existing controls.** The panel renders each control by calling it as a function (all are
hook-free) and wraps a non-`null` result in a line `<div class="setting-line"><span>Agent sessions</span>…</div>`. A
control that does not apply returns `null` and so produces no line — the "shown in the panel exactly when shown on a
row" rule follows from reusing the same functions. Labels and Disable reuse `LabelsButton` and `DisableButton`;
Disable sits after a divider. `projectSettings.tsx` changes only if a control's visible text duplicates its new line
label (for example `Docs auto-merge: On` can stay as is; the line label then reads `Auto-merge`), and never its
`aria-label` or tooltip.

**Grid rows.** `.tile` gets explicit rows: identity 40px, status 46px, figures auto, stages `minmax(44px, 1fr)`,
checkouts 18px and the footer 52px. The checkout summary has its own line rather than sharing the footer with the
actions: beside Console, Pull and Settings a 340px tile had room for only part of `n worktrees · m branches active`. The figures row is a three-column grid (Open, To archive, Open PRs) using the existing `.tile-totals`
number style; `OpenPrCount` moves into it with a label under its number. The idle tile renders the same figures with
the `zero` class and puts "no open changes" in the stages row. The footer is a flex row of `ProjectConsoleButton`,
`PullButton` and the Settings summary (an icon button with an accessible name, pushed to the right), which never wrap.

## Risks / Trade-offs

- [A very narrow tile (below 340px, on a phone) may not fit the whole checkout summary] → it ends with an ellipsis and
  keeps its tooltip.
- [A panel taller than the tile when every setting applies] → the panel scrolls inside the tile; five lines and Disable
  fit the current 296px tile at default font size.
- [The tile's hover lift (`transform`) under an open panel looks jumpy] → no lift while `.tile:has(details[open])`.
- [Outside-click handling closes a panel when the user clicks a dialog it opened (Labels)] → the Labels dialog renders
  outside the tile; closing the panel underneath it is harmless and expected.

## Migration Plan

UI only; no data, config or API change. Rollback is reverting the commit.
