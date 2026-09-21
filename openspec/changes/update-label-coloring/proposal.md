# Proposal

## Why

Every label on a card that is not a warning or an error is currently painted in the teal brand colour: the branch
badge, the `prompt` badge, a `running` session and `pushed` work all share `.badge.brand`. Teal is also the
dashboard's accent for focus rings, primary buttons and progress, and it is a hue the per-repository colour wheel can
hand to a repository — so a card can carry a teal repository accent next to four teal labels that mean four unrelated
things. Colour, which should be the fastest cue on a dense board, currently says almost nothing.

## What Changes

- Give status labels their own palette of **semantic tokens**, separate from the brand accent and from the repository
  colours: `info` (blue) for a live agent, `branch` (orange) for anything naming a branch or uncommitted work,
  and the existing success/warning/danger roles, each with a text, border and background token per theme.
- **`running` (and `quiet`) become blue.** A live agent is the one thing on the board that is happening *now*; it gets
  a hue nothing else uses. The running badge's motion keeps working against the new tokens.
- **The branch badge becomes orange**, the same role as the `uncommitted` work badge — both are about a working copy
  that is not yet merged. `pushed` moves off brand onto the same family at a lighter weight.
- **The `prompt` badge moves off the brand hue** to a neutral label; it is a note, not a status.
- **The repository hue wheel reserves the status hues.** `assignRepoHues` draws from a fixed list of hues that each
  stay at least 12° away from every status hue and from the brand accent, so a repository can never be shown in a
  colour that means "running" or "uncommitted". Assignment stays deterministic and filter-independent. Six reserved
  bands cost hue room: the guarantee of distinct colours drops from 24 repositories to 19 — the most the circle holds once
  each status hue has a ±12° berth — still well past the 17 the spec's scenario exercises.
- A test asserts the new invariants against the real token values: every status colour keeps ≥ 4.5:1 contrast in both
  themes, and every assignable repository hue stays outside the reserved bands.

Not changing: which labels exist, what they say, when they appear, or the rule that status is always text plus colour.
This is a repaint, not a re-wording. No breaking changes.

## Capabilities

### New Capabilities

None — the labels and the colour system already have requirements; their content changes.

### Modified Capabilities

- `kanban-board`: `Visual design follows the dashboard token set` gains the rule that status colour is a semantic role
  disjoint from the brand accent and from the repository colours; a new requirement fixes which role every label on a
  card uses (blue for a live agent, orange for branch and uncommitted work, and so on); `Each repository has its own
  stable colour` gains the reserved hue bands and lowers its guarantee of distinct colours from 24 to 19.
  `The running session badge shows activity through motion` is unchanged — it already requires theme tokens.

## Impact

- `src/ui/styles.css` — new status tokens in both theme blocks, `.badge` role classes, the running-badge animation.
- `src/ui/sessionState.ts` — the `tone` union and the tone chosen by `sessionBadge` and `workBadge`.
- `src/ui/kanban.tsx` — `BranchBadge` and the `prompt` badge; `src/ui/changeDetail.tsx` uses `BranchBadge` unchanged.
- `src/ui/repoGroups.ts` — `assignRepoHues` skips the reserved bands.
- `test/repoContrast.test.ts` (contrast and band checks), `test/repoGroups.test.ts` (hue assignment),
  `test/workStatusUi.test.ts` (work badge tones).
- No server, API, config or data change; nothing about this reaches a tracked repository.
