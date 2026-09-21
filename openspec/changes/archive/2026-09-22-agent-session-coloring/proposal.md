# Proposal

## Why

With three panes and a strip of tabs, the dock is the one place where several repositories sit next to each other with
nothing to tell them apart but a small grey repository name. Everywhere else on the board a repository is recognisable
at a glance by its colour — group panel, card accent, filter chip, activity entry. The tab strip is the only repository
list in the UI that is colourless, so finding "the tab of the other project" means reading every label.

## What Changes

- Each agent session tab in the dock's tab strip carries its repository's colour: an accent border along the tab's
  leading edge, the same 3px repository accent a card has, and the repository name inside the tab rendered in that
  colour instead of the subtle grey.
- The colour is the very same one the board shows — derived from the repository id by `assignRepoHues` over all
  repositories of the snapshot, so a tab, its cards, its group panel and its filter chip always agree, and filters
  never change it.
- Colour stays a second cue only: the tab already shows the repository name beside the change name, and the existing
  shown/focused marks (`▣`/`▢`, the brand-coloured top border) keep saying which sessions have a pane. Those marks stay
  brand-coloured so that "which session am I looking at" and "which project is this" never compete.
- A session whose repository is not in the current snapshot — switched off in Settings, or excluded — keeps today's
  untinted tab.
- Nothing else changes: no new state, no new API field, no change to session behaviour, ordering or keyboard handling.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `kanban-board`: "Each repository has its own stable colour" extends the list of places the repository colour is shown
  to the agent session tabs in the dock, and states that the repository colour there MUST NOT replace the marks that say
  which sessions are shown and focused.

## Impact

- `src/ui/sessionPanel.tsx`: `SessionTabs` computes the snapshot's hues (`assignRepoHues`, already used by the board and
  the activity feed) and puts `repo-tint` plus `--repo-hue` on each tab; the repository name gets its own class.
- `src/ui/styles.css`: `.session-tab.repo-tint` — leading accent border and repository-coloured name; the existing
  `.session-tab.shown` / `.active` borders must keep working beside it. (The in-flight `settings-nav-follows-content`
  change also edits this file, in the `.settings-*` rules only.)
- `src/ui/sessionState.ts`: a small pure helper so the tint decision (hue, or none for a repository outside the
  snapshot) is testable without a DOM.
- `test/`: unit tests for that helper, and an extension of `test/repoContrast.test.ts` to the two backgrounds a tab's
  repository-coloured text sits on (`--bg-base` for the strip, `--bg-section` for a shown tab) across all 24 hues in
  both themes.
- No server, API, config, dependency or spec-file changes beyond the one delta; the demo site gets the colours for free.
