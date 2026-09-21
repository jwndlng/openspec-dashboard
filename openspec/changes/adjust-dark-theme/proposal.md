# Proposal

## Why

The dark theme's ground sits at OKLCH lightness 0.158 (`#0b0d10`), close to black. Users who prefer a dark
interface but dislike near-black grounds find it harsh over long sessions, which is the whole working day for an
operator dashboard. Lifting the ramp costs nothing structurally: components reference tokens only, so the look is
controlled by about a dozen values in one block.

## What Changes

- Lift the dark theme's five background tokens by 0.04 OKLCH lightness, keeping their relative spacing and their
  near-neutral cool hue, so the ramp reads as a soft dark grey rather than near-black.
- Lift the dark text tokens that would otherwise fall below the 4.5:1 rule on the new, lighter backgrounds
  (`--fg-subtle`, `--fg-body`, `--fg-disabled`).
- Lift `--danger`, the one status colour that drops under 4.5:1 on the new card background.
- Lift the accent and status tokens used as chip backgrounds and borders by the same amount, so they do not end up
  darker than the ground they sit on.
- Track `--border-subtle` to the new `--bg-surface` value, as it does today.
- No change to the light theme, to layout, typography, spacing, radius or any selector; no change to the repository
  colour tokens or to how the theme is chosen, persisted and applied.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-theme`: the "Light and dark themes are available" requirement carries a scenario asserting that the dark theme
  renders "with the same colours as before this change". That scenario is what this change contradicts; it is replaced
  by one that pins the new ground and the elevation hierarchy.
- `kanban-board`: the "Visual design follows the dashboard token set" requirement names the dark ramp by its endpoints
  (`#0b0d10`…`#313437`). Those literals move.

## Impact

- `src/ui/styles.css` — values inside the dark `:root` token block only; no selector lines move.
- `src/ui/sessionPanel.tsx` — the xterm.js fallback literals (`--bg-base`, `--bg-elevated`) kept in sync with the tokens.
- `test/repoContrast.test.ts` — reads the tokens from the stylesheet, so it re-runs against the new numbers unchanged.
- No server, API, scanner or session behaviour is touched. The pre-paint script in `scripts/build-ui.ts` sets only the
  `data-theme` attribute and hardcodes no colour, so it needs no change.
