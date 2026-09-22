# Proposal

## Why

A board card's most prominent control copies a shell command the user then has to paste somewhere else, while the one
thing the card is actually for — reading the change — is an invisible link stretched over the whole card. And the view
it leads to is a full page that repeats every label the card already showed, pushing the artifact text the user came
for below a header of badges. Reading a proposal should feel like glancing at a change, not like leaving the board.

## What Changes

- **BREAKING (UI)** The card's copy action ("Copy apply" / "Copy start") is removed and replaced by a visible
  **Show details** control. The copy-apply and copy-start commands disappear from the dashboard altogether; agent
  sessions are started from the card's session starters, which are unaffected.
- **BREAKING (UI)** A card is no longer one large link. Only **Show details** opens the change; it stays an anchor, so
  ⌘/middle-click still opens the detail view in a new tab. The change name becomes plain text.
- The change detail view becomes an **overlay**: the board it was opened from stays on screen behind a dimmed
  backdrop, and the overlay is dismissed with its close control, `Escape` or a click on the backdrop, returning to that
  board with its filters intact. The route, its query parameters and both routing modes are unchanged, so a detail URL
  is still linkable and still survives a reload.
- The overlay's header is reduced to the repository name, the change name and the close control, above the artifact
  tabs. The column badge, progress meter, activity age, creation and archive dates, schema badge and branch badge are
  gone from the detail view — they stay on the board. Warnings the snapshot carries for the change are still shown.
- The copy actions of the detail view ("Copy apply command", "Copy cd command", "Copy file path" in the header) are
  removed with the header. "Copy file path" remains only where it is the substitute for content: the too-large state.
- The artifact tabs, the delta-spec file list, the raw toggle, Markdown rendering, the read-only task checklist and the
  poll-driven refresh keep working as they do today, inside the overlay, with the artifact text scrolling on its own.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `kanban-board`: the "Copy apply command" requirement is replaced by a "Show details" requirement — what the card
  offers, and that the card as a whole is no longer a link; the session-starter requirement no longer refers to
  "existing copy actions".
- `change-detail`: the view is presented as an overlay over its board with a close/`Escape`/backdrop dismissal; the
  header requirement drops the status labels it lists today; the "Copy actions in the detail view" requirement is
  removed, apart from the file path offered in the too-large state.

## Impact

- `src/ui/kanban.tsx` — `ChangeCard` (copy button → Show details link, card-link no longer stretched), `CopyButton`
  stays for the repository header's "Copy cd".
- `src/ui/changeDetail.tsx` — `DetailHeader` reduced, overlay shell, dismissal, focus handling.
- `src/ui/app.tsx` — renders the board behind the overlay for the `change` route.
- `src/ui/format.ts` — `applyCommand`, `startCommand`, `copyCommandFor`, `isStartColumn` and `APPLY_COLUMNS` are
  removed; `cdCommand` and `shellQuote` stay (repository header, session panel).
- `src/ui/styles.css` — overlay, backdrop, reduced header; `.card-link` stretch removed.
- Tests: `test/changeDetail.test.ts`, `test/format.test.ts`.
- No server, API, scanner or repository behaviour changes; the dashboard stays read-only towards tracked repositories.
