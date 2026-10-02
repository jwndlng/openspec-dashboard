# Proposal

## Why

Project labels are grey chips today: every label looks like every other, so on a long projects overview the eye has to
read each chip to find `client` or `terraform` among the rows. A colour per label makes a group recognisable at a
glance, the same way repository colours already do on the board, while the label's text stays the primary cue.

## What Changes

- Every displayed label (custom and detected) is painted in a **label colour**: a hue derived deterministically from the
  label's name ignoring case, so `client` has one colour on every row, tile, board header and in the label filter,
  across reloads and machines, with no configuration.
- Label hues are drawn from the same assignable hue set as repository colours, which keeps a 12° berth from every status
  role hue and the brand accent, so a label never looks like a status (`running`, `uncommitted`, `complete`, …).
- The user can **choose a colour for a label** in a project's labels dialog — one of the assignable hues, or **Auto** to
  return to the derived one. The choice is global per label name (ignoring case): recolouring `client` recolours it on
  every repository. It is stored in `~/.openspec-dashboard/config.json` under a new optional `labelColors` map and never
  in a repository.
- New mutating endpoint `POST /api/labels/color` with `{ label, hue }` (`hue: null` = Auto), same-origin protected,
  triggers no scan.
- The theme supplies lightness and chroma, so label text keeps a contrast ratio of at least 4.5:1 on its chip in both
  themes. Detected labels keep their icon and dashed edge; an active filter chip additionally shows a check mark and the
  brand border, so neither kind nor filter state is conveyed by colour alone.
- The kanban-board palette requirement is clarified: repository labels are groupings, not status labels, and take label
  colours instead of a status role.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `project-labels`: labels gain a derived colour and a user-chosen override stored in the dashboard configuration;
  colour picker in the labels dialog; active filter chips gain a non-colour cue.
- `dashboard-api`: new label colour endpoint.
- `kanban-board`: the semantic colour palette requirement exempts repository labels, which use label colours under the
  same hue exclusion as repository colours.

## Impact

- `src/shared/hues.ts` (new) — the assignable hue table and hash, moved out of `src/ui/repoGroups.ts`, which re-exports
  them.
- `src/shared/labels.ts` — label hue derivation and `labelColors` lookup.
- `src/shared/types.ts`, `src/server/config.ts` — optional `labelColors` in the config schema and validation.
- `src/server/api.ts` — `POST /api/labels/color`.
- `src/ui/labels.tsx`, `src/ui/projectSettings.tsx`, `src/ui/overview.tsx`, `src/ui/kanban.tsx`, `src/ui/styles.css` —
  coloured chips, colour picker in the labels dialog, active-chip check mark.
- `src/ui/api.ts`, `src/ui/untracked.tsx`, `src/ui/demo/demoApi.ts` — client and demo implementation of the new call.
- Tests: `test/labels.test.ts`, `test/config.test.ts`, `test/api.test.ts`, `test/projectSettingsUi.test.ts`,
  `test/demoApi.test.ts`, `test/repoContrast.test.ts` (label colour contrast and hue berth).
- No repository is read or written differently; no scan, git command or network access is added.
