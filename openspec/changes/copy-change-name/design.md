# Design

## Context

Two copy buttons exist already, both text buttons: `CopyButton` in `src/ui/kanban.tsx` (shows `Copied` for 1.5 s,
used for `Copy cd`, file paths and restore commands) and a near-identical `Copy` in `src/ui/sessionPanel.tsx`. Neither
fits next to a name: they are text labels, and they claim nothing on a refused write only by accident (the `.then`
never runs). Icons live in `src/ui/icons.tsx` as Lucide path data, decorative and `aria-hidden`, on the rule that every
icon sits beside text saying the same — an icon-only control therefore has to carry the text as its accessible name.

The detail header renders `repo.name / change.name` in `DetailHeader` (`src/ui/changeDetail.tsx`); the card renders
`card.name` inside `.card-title` and already has `card.repoName`. The gone-from-snapshot header uses the same
`DetailHeader` with only name and repository, so it gets the button for free.

`add-validate-phase` is in flight and modifies the kanban-board requirement "Cards show only what an overview needs";
this change therefore adds its own requirements instead of modifying that one.

## Goals / Non-Goals

**Goals:**
- One click copies `project/change` from the detail header and from a card.
- Accessible: named by what it copies, confirmation announced in words, reachable by keyboard.
- No layout shift on the card: the name wraps the same whether the icon is shown or not.

**Non-Goals:**
- Copying anything else (path, branch, a URL to the dashboard).
- Configurable formats.
- Replacing the existing text `CopyButton` / `Copy` components.
- Copy icons in Open work, the activity feed or the Pull requests view.

## Decisions

- **Reference format in one pure helper**: `changeRef(project, change)` returns `` `${project}/${change}` `` and lives in
  `src/ui/format.ts` beside `cdCommand`, so it is unit-tested without a DOM. `project` is the repository's display
  name (`repo.name` / `card.repoName`) — the name the user sees in the header and the group, not the id.
- **One component, `CopyRefButton`**, in `src/ui/kanban.tsx` next to `CopyButton` (both views already import from
  there). A `<button type="button" class="btn ghost icon-only copy-ref">` holding `IconCopy`, switching to `IconCheck`
  for 1.5 s after the clipboard promise resolves, with `title` and `aria-label` `Copy <ref>` and, while confirmed,
  `Copied`. A visually hidden `aria-live="polite"` span carries `Copied` so screen readers hear it. The rejection is
  caught and ignored (no false confirmation, no unhandled rejection). The timer is cleared on unmount, as in
  `CopyButton`.
- **Card click isolation**: the handler calls `stopPropagation()` so no ancestor handler (today none, but the card's
  hover lift and any future card-level click) treats it as a card action.
- **Card reveal by opacity, not display**: in the card the button keeps its box (`opacity: 0`) and becomes visible on
  `.card:hover` and `:focus-visible`, so the name never re-wraps when it appears. Under `@media (hover: none)` it is
  always visible, since touch screens have no hover. The name and the button sit in a new inline row inside
  `.card-title`; the button is `flex: none` and small (12 px icon, ~20 px box) so the name keeps nearly all its width.
- **Detail header**: the button follows the `.change-name` pill inside the `h1`, always visible, same quiet ghost
  style as the close control.
- **New icon `IconCopy`**: Lucide `copy` path data, same `Icon` wrapper.

Alternatives considered: making the name itself click-to-copy (undiscoverable, and conflicts with text selection);
reusing the text `CopyButton` (too wide for a card title).

## Risks / Trade-offs

- [The clipboard API needs a secure context] → `127.0.0.1` counts as one, and the existing copy buttons already rely on
  it; in the demo site (https) it works too.
- [An always-reserved icon slot narrows the card name by ~20 px] → acceptable; names already wrap, and this keeps the
  layout stable instead of jumping on hover.
- [Overlap with `add-validate-phase` in `kanban.tsx` / `styles.css`] → this change touches only the card title and adds
  a new CSS block; resolve any textual conflict at merge time.
