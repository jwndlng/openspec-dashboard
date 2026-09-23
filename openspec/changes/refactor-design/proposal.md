# Proposal

## Why

The dashboard's "Dithered" look (teal on flat grey, Space Grotesk, 4px corners, all badges the same weight) makes it hard to scan a board with many cards: the column you are looking at, the primary action and a card's progress all compete at the same visual level. The user supplied a mockup (`prompt.md`) of a denser, more layered design: an indigo accent, Inter, rounded panels, a header with counts and one primary action. This change adopts that visual language and the layout ideas that real data supports, refined over several review rounds. It adds no data and no server behaviour.

## What Changes

The design went through six review rounds with the user (design.md D8–D13 record each). The end result:

- **Tokens, both themes.** An indigo accent replaces teal. Dark is a medium-dark neutral grey (`#26272b` page, surfaces up to `#4b4c51`) with clearly visible borders, and light is a matching slate/indigo set. There are radius (6/8/12px) and shadow tokens, and status roles are filled tinted chips. `info` moves to sky blue, away from the accent, and repository hues are retuned to keep their 12° berth.
- **Typography and mark.** Inter (bundled Latin subset) replaces Space Grotesk, and JetBrains Mono stays. An original product mark (a four-arc lifecycle ring) is drawn in tokens and doubles as the inline favicon. A handful of Lucide icons are inlined as path data, with no icon library and no CDN.
- **Hero header.** The big `OpenSpec Dashboard` title, a tagline, the status corner, and large navigation tabs with icons. The view's header band and filter bar continue on the same glowing ground.
- **Header bands with action areas** on the combined board, the repository board and the Projects overview. Each has a title, labelled counts, and its actions (New change, Pull, Clean up, Pull all) grouped at full size. The repository header shows the main checkout and an `<n> branches` control that opens a dialog with every checkout.
- **Filter bar**: search with a clear control, a Repositories menu, Stale presets, a Hide archived switch, removable filter tags, and a Lanes/Stack switch. The Activity page uses the same Repositories menu and tags.
- **Board**: lanes with lifecycle dots, and Stack layout below 1280px (or by choice) so it fits half a screen. Empty lanes collapse to rails.
- **Cards show only the overview**: name, update age, session status, task progress, the next-step starter, **Show details**, and a console quick link. The branch, work status, pending archive, prompt, column and completion move to the detail view's header.
- **Detail view and dialogs**: roomier padding, and the change's state in the header. New change opens as a dialog, and a shared `Modal` serves the dialogs.
- **Projects overview**: equal-size tiles with a repository monogram, big totals, the stage strip, and a `<n> worktrees · <m> branches active` summary instead of chip lists.
- **Not adopted from the mockup**, because it would break the read-only, offline or source-of-truth invariants or would invent data: moving changes between stages, ticking tasks, the user avatar, "Git Synced", the domain filter, the extra Specs/Archive/Analytics tabs, the CLI modal, schema templates, ⌘K, and the Tailwind, Google Fonts and Lucide CDN scripts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kanban-board`: the visual design requirement becomes "Visual design follows the grey and indigo token set". Card requirements are consolidated into "Cards show only what an overview needs"; the branch, work-status, pending-archive and prompt card requirements are removed, and those details move to the detail view. New requirements cover the hero header, the product mark, the header band, column lifecycle markers, the filter bar, action areas, and the Lanes/Stack layout. The status palette, repository colour, Show details (console quick link) and session-starter requirements are updated.
- `change-detail`: "Detail header shows the change's state" now shows column, tasks, age, completion, branch, pending archive, work status and prompt.
- `project-overview`: the tiles layout summarises checkouts; the repository header shows the main checkout plus a branches dialog; new requirements cover equal-size tiles and the overview band.
- `change-creation`: the form opens as a dialog.
- `activity-feed`: the feed filters use the board's Repositories menu and tags.
- `demo-site`: work-status badges are showcased in the detail view.
- `ui-theme`: "Light and dark themes are available on a grey ground".

## Impact

- `src/ui/styles.css`: token blocks for both themes, radius/shadow tokens, and restyled shell, filters, columns, cards, badges, buttons, overview, detail, settings and dialogs. This is most of the change.
- `src/ui/app.tsx` (hero), `src/ui/kanban.tsx` (bands, cards, layouts), `src/ui/overview.tsx`, `src/ui/changeDetail.tsx`, `src/ui/activity.tsx`, `src/ui/checkout.tsx`, `src/ui/sessions.tsx`, `src/ui/newChangeForm.tsx`, `src/ui/filters.ts`, `src/ui/overviewState.ts`. New: `icons.tsx`, `logo.tsx`, `logoMark.ts`, `modal.tsx`, `band.tsx`, `boardFilters.tsx`, `boardMarks.ts`.
- `src/ui/repoGroups.ts`: `REPO_HUES` retuned. `test/repoContrast.test.ts` keeps recomputing the berth and contrast from the tokens and gains a check that the filled primary button's text keeps 4.5:1.
- `src/ui/sessionPanel.tsx`: the terminal-theme fallback colours follow the new tokens.
- `src/ui/fonts/`: `Inter.woff2` added, `SpaceGrotesk.woff2` removed. `scripts/build-ui.ts` font list updated. Licence notices for the bundled fonts.
- `scripts/build-ui.ts` (fonts, favicon), `scripts/screenshots.ts` (taller overview shot). The screenshots regenerate on deploy.
- Overlaps: `review-open-work-menu`, `integrate-console-detail-view` and `settings-nav-follows-content` also edit `src/ui/styles.css` (Open work rows, console pane, settings scroll wrapper). This change only restyles those blocks through tokens and does not change their structure. Whichever lands second rebases its CSS hunks.
- No server, API, config, git or dependency change. The UI stays one self-contained HTML file with no network access.
