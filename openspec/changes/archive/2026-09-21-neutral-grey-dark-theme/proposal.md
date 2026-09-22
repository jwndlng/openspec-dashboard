## Why

The dark theme reads as navy blue rather than dark: its backgrounds (`#080d16`…`#243350`) have roughly twice as much blue as red, its body text is blue-grey, and its borders are translucent teal. With the board now carrying real colour — per-repository hues, status badges, the teal brand — a saturated blue ground competes with all of it and makes the colours that carry meaning harder to read. A neutral grey ground lets those colours do their job and is easier on the eyes over a long session.

## What Changes

- Replace the dark theme's **background** tokens (`--bg-base`, `--bg-section`, `--bg-raised`, `--bg-surface`, `--bg-elevated`) with a near-neutral grey ramp: grey with at most a slight cool tint, not pure `#rrggbb` greys with equal channels and not navy. The five-step elevation hierarchy (page → section → raised → surface → elevated) and its relative spacing stay the same.
- Replace the dark **text** tokens (`--fg-heading`, `--fg-body`, `--fg-subtle`, `--fg-disabled`) with neutral greys in place of today's blue-greys, keeping every text token at or above 4.5:1 on the backgrounds it is used on.
- Replace the dark **border** tokens (`--border`, `--border-light`, `--border-subtle`, `--border-strong`) with neutral translucent greys instead of translucent teal, so panels and cards are outlined in grey. Teal stays reserved for what it signals: focus rings, active chips/tabs, primary buttons and progress.
- **Unchanged:** the teal brand tokens, the success / warning / danger tokens, typography, radius, spacing, and the whole light theme. No component CSS changes — this is a token swap in the dark `:root` block only.
- Re-check the **per-repository colour** tokens (`--repo-l`, `--repo-c`, `--repo-soft-l`, the group tint mixes) against the grey ground. They were tuned on navy; adjust only if the repository colours lose legibility or the group tint disappears.
- Update the `theme-color`/pre-paint background if the HTML shell hardcodes the old base colour, so the first painted frame matches the new ground.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities
- `kanban-board`: "Visual design follows the dashboard token set" names the dark palette by value (backgrounds `#080d16`…`#243350`); it changes to the new neutral grey range and states that the dark ground is neutral grey with teal used only as an accent. The token names, the light palette, the tokens-only rule, the 4.5:1 contrast rule and the offline guarantee are unchanged.

## Impact

- `src/ui/styles.css`: the dark token block only (about 13 colour values, possibly the four `--repo-*` tuning values). No selectors change.
- `scripts/build-ui.ts`: only if it references the old base colour.
- `README.md`: only if it describes the dark theme's look.
- No server, API, data-model, dependency or test-logic changes. Verification is a contrast script run over the new values plus a visual check of the overview, combined board, a repository board and Settings in dark mode — and a confirmation that the light theme is pixel-identical.
- In-flight changes that also edit `src/ui/styles.css` (`truncate-branch-name`, `collapsible-repo-groups`, `add-change-detail-view`, `create-change-from-dashboard`, `dedupe-discovery`) add or change *selectors*; this change only touches values inside the dark `:root` block, so textual conflicts are unlikely. Any new component they add inherits the grey ground automatically, as long as it keeps to tokens.
- Open choice carried into the design: near-neutral (slight cool tint, recommended — pure neutral tends to look flat and slightly warm next to teal) versus pure neutral grey. The proposal assumes near-neutral; switching is a matter of different values, not different scope.
