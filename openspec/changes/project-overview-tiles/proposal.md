# Proposal

## Why

The tiles layout of the projects overview has grown one control at a time, and a tile now reads as a pile of parts. Its
header packs Pull, Labels and Disable next to the name. Its footer mixes the checkout summary with the agent-session switch,
the agent picker, the PR titles picker, the Docs auto-merge switch and the Console button, and they wrap onto as many lines
as they need. The open pull request count sits on a line of its own, away from the other figures. Tiles of the same size
end up with their controls in different places, so the grid looks disorganised and is hard to scan.

## What Changes

- Every tile is split into fixed zones, each holding one kind of content, in this order: **identity** (monogram, name with
  path hint and rename, last-updated age), **status** (one badge area: scan failure, off-default-branch notice,
  work-in-progress indicator, shared-config profiles, labels), **figures** (Open, To archive and Open PRs as three
  labelled figures of the same style, side by side), **stages** (the per-stage counts), **checkouts** (the checkout
  summary on one line), and a **footer** holding only the tile's actions.
- The header holds no buttons any more apart from Rename. The footer's actions are **Console**, **Pull** (git repositories that scanned)
  and **Settings**.
- **Settings** is a disclosure. It opens a panel over the tile, without changing the tile's size, that lists the
  project's own settings as labelled lines (Agent sessions, Agent, PR titles, Docs auto-merge, Labels) and, set apart at
  the bottom, **Disable**. It closes when Settings is activated again, on Escape, on a click outside it, or when another
  tile's Settings opens.
- A tile without open changes keeps its figures, de-emphasised at zero, and shows "no open changes" where the stage counts
  would be.
- The table layout, the pending (`Scanning…`) tile, the Unmanaged projects section, sorting, search, filters and URL
  state do not change. Every setting and action keeps its behaviour; only where it sits on a tile changes.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `project-overview`: "Tiles have one size and one layout" describes the new zones, the footer actions and the Settings
  panel, and the idle tile's de-emphasised figures. "Each managed project carries its own settings on the overview" says
  that a tile offers those settings, and Disable, in its Settings panel.

## Impact

- `src/ui/overview.tsx` — `Tile` and `TileCheckouts` rearranged into the zones; the Settings disclosure; closing an open
  panel on Escape, an outside click or another panel opening.
- `src/ui/styles.css` — the tile grid rows, the figures row, the footer and the Settings panel. The in-flight
  `add-validate-phase` change also edits `styles.css`, in card and checklist rules only; no overlap with the tile rules
  is expected.
- `src/ui/projectSettings.tsx` — only if a control needs a labelled-line variant for the panel; behaviour unchanged.
- `src/ui/changelog.ts` — one entry for the reorganised tiles.
- `test/projectSettingsUi.test.ts`, `test/untrackedUi.test.ts`, `test/overview.test.ts`, `test/labelChipsUi.test.ts` —
  tile structure and the panel's controls.
- `README.md` — where a tile's settings and Disable now sit.
