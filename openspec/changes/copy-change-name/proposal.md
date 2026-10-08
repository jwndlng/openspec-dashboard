# Proposal

## Why

A change is referred to across tools — in an agent prompt, a chat message, an issue — as `project/change`, and today
that has to be typed or pieced together from the repository name and the change name, which sit in different places
on screen and only the change name can be selected cleanly. One click next to the change name should put the full
reference on the clipboard.

## What Changes

- The change detail header gets a small copy icon button right after the change name. Activating it copies
  `<project-name>/<change-name>` (the repository's display name as shown in the header, a slash, the change name) to
  the clipboard and briefly confirms with a check mark.
- Each Kanban card gets the same copy icon after its name, quiet until the card is hovered or the button focused, so the
  reference can be copied straight from the board without opening the detail view. It does not open the detail view
  and does not shorten or push the name.
- The button is icon-only, so it carries an accessible name and tooltip (`Copy demo-ops/cloud-deployment`) and
  announces the copied state in words, never by the icon alone.
- A new `IconCopy` (Lucide path data, like the other icons) is added to `src/ui/icons.tsx`.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `change-detail`: "Detail header shows the change's state" — the header additionally offers copying
  `project/change`.
- `kanban-board`: "Cards show only what an overview needs" — a card additionally offers copying `project/change`
  next to its name; the reference includes the repository name although the card still does not show it.

## Impact

- `src/ui/icons.tsx` — `IconCopy`.
- `src/ui/format.ts` — a `changeRef(project, change)` helper.
- `src/ui/kanban.tsx` — a `CopyRefButton` component and its use in `ChangeCard`.
- `src/ui/changeDetail.tsx` — the button in `DetailHeader`.
- `src/ui/styles.css` — sizing and hover/focus reveal of the icon button.
- `test/` — a unit test for the reference format; existing `test/changeDetail.test.ts` stays green.
- No server, API or snapshot change; nothing written anywhere; no network. The Clipboard API is used as the existing
  copy buttons already do.
