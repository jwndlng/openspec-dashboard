# Design

## Context

The motivation and scope are in proposal.md. The mockup is `prompt.md`, a Tailwind/CDN page with fake data. We take its visual language and layout, not its markup or scripts.

Current state that shapes the approach:

- All styling is one hand-written `src/ui/styles.css`. Components use tokens only (`--bg-*`, `--fg-*`, `--brand*`, status roles, `--radius`). The light theme overrides colour tokens under `:root[data-theme="light"]`.
- `scripts/build-ui.ts` inlines JS, CSS and base64 fonts into one `dist/ui/index.html`, and a pre-paint script sets `data-theme`. The UI must work in the compiled binary and offline (invariant 4).
- `test/repoContrast.test.ts` parses the token blocks out of `styles.css`. It proves 4.5:1 contrast for status roles and repository-coloured text, and a 12° OKLCH hue berth between `REPO_HUES` (`src/ui/repoGroups.ts`) and every status and accent hue in both themes.
- OKLCH hues of the colours involved: teal brand today about 194°, indigo `#6366f1`/`#4f46e5` about 277°, `info` today `#6ba6ff` about 258° (light `#1d4ed8` about 264°), sky `#38bdf8` about 233°, sky-700 `#0369a1` about 243°. Today's `REPO_HUES` include 231 and 243, and 277 would collide with the new accent.

## Goals / Non-Goals

**Goals:**

- One restyle through the tokens, so every view (board, overview, detail, settings, activity, dialogs, demo) changes together and both themes stay symmetrical.
- Keep every existing accessibility and colour guarantee, re-proved by the existing tests against the new numbers.
- Keep the bundle small and self-contained.

**Non-Goals:**

- Utility-class CSS (Tailwind) or any CSS build step. We keep the hand-written stylesheet.
- New views, new data, or anything that changes state (see proposal "Not adopted").
- Reworking the new-change form into the mockup's drawer, or the detail overlay into its modal. Both are restyled in place.

## Decisions

### D1. Tokens, not a rewrite

Keep every existing token name so component CSS changes only where the layout changes. Add:

- a radius scale `--radius-sm: 6px` (buttons, chips, badges, inputs), `--radius: 8px` (cards, fields, dialogs' inner blocks) and `--radius-lg: 12px` (columns, panels, the detail overlay, dialogs). Today's single `--radius` users are re-mapped by element size.
- `--shadow-sm` (card hover, pills) and `--shadow-lg` (overlays, menus), with colour inside the token.
- `--on-brand` (text on a filled primary button, white in both themes) and `--brand-ring` (focus ring).
- `--bg-overlay`, a translucent top-bar ground used with `backdrop-filter: blur()`. It falls back to `--bg-section` where the filter is unsupported.

Alternative considered: port Tailwind. Rejected. It adds a build dependency, and Tailwind classes would scatter literal colours through the TSX, which breaks the "tokens only" rule and the contrast test's single source.

### D2. Palette values

Dark: `--bg-base #090a0f`, `--bg-section #0e1117`, `--bg-raised #141822`, `--bg-surface #1b202e`, `--bg-elevated #283044` (OKLCH chroma ≤ 0.038, hue 264–276°). Text: heading `#f1f5f9`, body `#cbd5e1`, subtle `#94a3b8` (6.3:1 on `--bg-surface`), disabled `#475569`. Brand: `--brand #6366f1`, `--brand-strong #4f46e5` (filled primary, white text 6.3:1), `--brand-fg #a5b4fc`, and `--brand-soft`/`--brand-softer` as indigo tints that are lighter than `--bg-raised`. Borders: `#ffffff14` / `#ffffff0a` / `#ffffff24` style translucent whites.

Light: `--bg-base #f8fafc`, `--bg-section #f1f5f9`, `--bg-raised #ffffff`, `--bg-surface #e2e8f0`, `--bg-elevated #cbd5e1`. Text: heading `#0f172a`, body `#334155`, subtle `#475569`. Brand: `#4f46e5`, strong `#4338ca`, fg `#4338ca`, soft `#e0e7ff`, softer `#eef2ff`. Borders: translucent slate.

The exact values are tuned during implementation until `test/repoContrast.test.ts` passes. The spec fixes only the anchors (page `#090a0f`/`#f8fafc`, brand `#6366f1`/`#4f46e5`) and the rules.

### D3. `info` moves to sky; repository hues are recomputed

With an indigo accent at 277°, today's `info` blue (258°/264°) would sit 13–19° away. That is legal for the 12° repo rule, but "an agent is running" would read as "accent". Move `info` to sky: dark `#4fb0f7` and light `#0369a1`, both at about 243° (≥ 5.4:1 on their badge grounds). Implementation showed the two `info` hues must match: with dark at 233° (`#38bdf8`) and light at 243°, the arc between them left room for only 18 repository hues. The spec now requires ≥ 24° between `info` and the accent.

Teal leaves the palette, so 194° is free for repositories. Recompute `REPO_HUES` with the same rule: 12° from every status and accent hue in both themes and 12° from each other. With both themes' hues reserved, the free arcs hold exactly 19 (see the comment on `REPO_HUES`), so the spec's 19 distinct colours holds. The test already derives the forbidden hues from the tokens, so it fails if the list is wrong. Keep `assignRepoHues` unchanged apart from the list, and accept that repositories may get a different colour once after upgrading (see Risks).

Alternative considered: keep blue `info` and accept the closeness. Rejected, because blue next to indigo is the most likely confusion on a busy board.

### D4. Fonts

Replace `SpaceGrotesk.woff2` with `Inter.woff2`: the Latin variable-weight subset (about 45–50 KB, comparable to the fonts bundled today), taken once from the upstream OFL release or the `@fontsource-variable/inter` package's `latin-wght-normal` file. It is copied into `src/ui/fonts/`, and no dependency is added. `scripts/build-ui.ts` gets `{ family: "Inter", file: "Inter.woff2", weight: "100 900" }` and `--font-sans` becomes `"Inter", ui-sans-serif, system-ui, sans-serif`. Add `src/ui/fonts/README.md` naming the source and licence (SIL OFL 1.1) of both bundled fonts, because the binary redistributes them. Enable Inter's `cv11`/`ss01` only if they improve digit legibility in counts. That is optional.

### D5. Icons

A new `src/ui/icons.tsx` exports a few tiny Preact components (`IconSearch`, `IconPlus`, `IconBranch`, `IconRefresh`, `IconSun`, `IconMoon`, `IconMonitor`, `IconLayers`). Each is a 24×24 `stroke="currentColor"` SVG whose path data is copied from Lucide (ISC licence, noted in the module header), with `aria-hidden="true"` and `focusable="false"`. Existing text glyphs that carry meaning (`⎇`, `✎`, `⚠`, `⑂`) stay, because specs and tests read them.

Alternative considered: bundle `lucide-preact`. Rejected. It is a new dependency for eight icons.

### D6. Shell and board layout

- **Top bar** (`app.tsx`): logo mark (a gradient tile from `--brand-strong` to `--brand`, holding `IconLayers`; not `--info`, which means a running agent) plus `OpenSpec Dashboard`, then `nav` as a segmented control. The active link is a raised pill with an accent border, and the Activity count pill is kept. The right side keeps its order. The theme button shows an icon plus its `Theme: …` text, and Refresh gets `IconRefresh`.
- **Header band** (`kanban.tsx`): a new `BoardBand` for the combined board holds the title, two count chips (`Open n`, `To archive n`, both from today's badge computation) and the primary **New change** (`btn primary` with `IconPlus`). `RepoHeader` gets the `band` class and the same two chips next to its existing row, and its New change becomes the primary button too. The filter row loses the count badge and the button.
- **Toolbar**: the search input is wrapped in `.search` with an absolutely positioned `IconSearch`. `reset` becomes `Clear filters`. The right side shows `Showing n changes`, where n is the number of cards in the columns on screen (archived cards count only while the `Archived` column is shown). Repo chips, stale and hide-archived keep their behaviour and URL persistence.
- **Column head**: `<span class="stage-dot" data-kind=…>` with `aria-hidden`, then name and count pill. A pure `columnKind(label, artifactColumns)` in `src/ui/format.ts` returns `neutral | accent | success | muted | warning`. It follows the lifecycle names from `src/shared/columns.ts`, so a schema's artifact columns stay neutral. Unit-tested.
- **Card**: restructured top to bottom: repo label (combined board) or name, plus Show details; the name; the artifact strip; the meter; the meta badges. A pure `artifactChips(card)` returns `{ initial, name, done }[]` in display order. It uses `displayOrder` and `artifactLabel` from `src/shared/columns.ts`, so the strip and the columns never disagree, and it returns `[]` for an unreadable change. Unit-tested. Hover lift is `transform: translateY(-1px)` plus `--shadow-sm` inside `@media (prefers-reduced-motion: no-preference)`.

### D7. What stays behaviourally identical

Only markup order and classes change. Filters, URL query, grouping, minimizing, Show details as the only link, session controls, detail overlay focus and inert handling, and theme resolution and pre-paint all keep their logic. Any test asserting the old labels (`n open · m to archive`, `reset`) is updated to the new ones, and no test is deleted.

### D8. Fidelity pass: closer to the mockup

After the first implementation was reviewed against `prompt.md`, the user asked for a closer match. This pass keeps every invariant and changes the following:

- **Top bar**: a three-part layout, with brand on the left, the navigation centred, and status and actions on the right. It is 56px high.
- **Status badges are filled chips**: each role gets a `--<role>-bg` token (a translucent tint of the role) next to its text and border. `test/repoContrast.test.ts` composites the tint over `--bg-section` and `--bg-raised` and checks 4.5:1 against the result. This replaces the old "one shared badge background" rule in the "Status labels" requirement.
- **Cards** follow the mockup's order: name in `--brand-fg` mono plus the repository tag, the intent line (`promptSummary`, a pure helper in `boardMarks.ts`), the artifact strip above a hairline, the full-width progress bar, and a footer with the age as quiet mono text, the badges and session controls, then **Show details** with a chevron. The coloured left edge goes. On the combined board the repository tag carries the repository colour, and a single-repository board shows none, as its requirement already omits the name there. The card is 12px round and lifts 2px on hover with an accent border, which is an active state.
- **Columns** are lanes that fill the board's height. Each has a 10px lifecycle dot, a 12px uppercase title and a square count chip, with 16px gaps between lanes.
- **Repository group panels** keep their tint (a spec rule) but mix less of the colour, so the lanes read calmer.
- **Header band**: a mono subtitle, a divider between the title and the counts, and filled count chips. The primary button gets an accent glow shadow (`--shadow-brand`).
- **Detail overlay**: 16px radius and a stronger backdrop blur. The change name is drawn as an accent-tinted mono chip.
- **WebKit scrollbars**: 6px with a rounded thumb, taking their colours from tokens.

### D9. Second review: lighter dark theme, filter bar, action areas, tiles

The user found the near-black theme too dark (borders invisible), the tiles uneven, the filter row dated and the actions cramped.

- **Dark palette** lifts to a dark slate (`#161a23` → `#394152`). Borders become 18/11/30% white. `--danger` lightens to `#ff6b8e` on the same hue, because `#ff3d75` fell to 4.2:1 on the lighter cards. Light borders go up as well. `test/repoContrast.test.ts` now also requires borders at ≥ 1.3:1 against the column and card grounds, and a page lighter than `#101214` but darker than `#20242c`. The earlier D2 values are superseded.
- **Filter bar** (`src/ui/boardFilters.tsx`, new):
  - search with a clear button;
  - a **Repositories** menu button with a popover checklist (swatch, name, error mark); the repository chips go;
  - **Stale** as a `<select>` of presets that keeps a custom URL value;
  - **Hide archived** as a `role="switch"` button;
  - removable tags for the selected repositories and the stale threshold;
  - **Clear filters**, and the count at the end.
  
  The pure helpers `staleOptions` and `activeTags` are unit-tested, and the `Filters` model and URL format are unchanged. The popover closes on Escape, outside pointer-down and focus leaving it, and the button carries `aria-expanded`.
- **Action areas**: the band becomes a two-part row (`.band-main` and `.band-actions`). The repository header puts Pull, Clean up and New change into its actions; the checkout chips, config badges and age move to a status row under the title. Inside `.band-actions`, small buttons render at full size. Below 900px the area wraps as one block.
- **Overview**: a `Projects` band with Tracked, Open and To archive counts and **Pull all** in its actions. A bar below holds the search, the WIP toggle, a segmented Table/Tiles control and, for tiles, the sort.
- **Tiles**: a CSS grid of fixed rows inside a fixed-height tile (`grid-template-rows`). It holds a monogram in the repository colour (hues from `assignRepoHues` over all repositories, as on the board), large Open and To archive numbers, the stage strip, and the badges and checkout chips each in a bounded area that scrolls. Rows of the tile grid are equal because every tile has the same height.

### D10. Third review: a grey dark theme, a roomier detail view

- **Dark palette** becomes a medium-dark neutral grey: `#26272b`, `#2d2e33`, `#35363b`, `#3e3f44`, `#4b4c51`, each with RGB channels within 6 of one another. It supersedes D2 and D9. On the lighter cards, `info`, `success` and `danger` lighten on their own hues (`#6cbcf9`, `#1fc48f`, `#ff8aa6`), which keeps them ≥ 4.5:1 on their tints and at least 12° from every repository hue. The test now checks "near-neutral grey" instead of the slate hue band, with the page bounded between `#1a1b1e` and `#2a2b2f`.
- **Detail view**: the header lost its padding when `.repo-head` became part of the band styles. It now has its own `.detail-head` rule. One `--detail-pad` (28px, 16px on narrow screens) insets the header, tabs, file list, content, console header, shortcut row and terminal. The content gets 28px of top padding and a toolbar separated by a hairline.

### D11. Fourth review: a hero header and a product mark

- **Mark** (`src/ui/logoMark.ts`, data only): a ring of four arcs for the four stages, fading clockwise behind a leading arc that ends in a bright dot, with a small rounded square at the centre, on a 48-unit tile. `logo.tsx` draws it in the accent tokens (`stop-color` through `style`, strokes in `currentColor` = `--on-brand`). `scripts/build-ui.ts` embeds the same data as an SVG data-URI favicon. It can't read CSS variables, so it uses the dark accent values literally. That is the one literal colour outside `styles.css`, and a comment names the tokens it mirrors.
- **Hero** (`app.tsx`): the mark at 60px, then `OpenSpec` + a gradient-clipped `Dashboard` at `clamp(34px, 4.4vw, 56px)` weight 800, a tagline, the status corner in the top-right grid cell, and the navigation as large tabs with Lucide icons on a glassy track. The ground is `.app::before`: two `color-mix` accent glows and a 22px dot grid, masked to fade out by about 620px. The band and filter bar become transparent, so the view's header continues on the hero ground. The filter bar's bottom border closes the hero. The board and overview side padding aligns with the hero at 24px.
- **Trade-off**: the hero takes about 320px of height on the board, which is less room for lanes. The user asked for a big header, and the lanes still fill the rest of the window and scroll inside.

### D12. Fifth review: an overview card, a half-screen board, summarised tiles

- **Card**: only the name with the update age under it, the session status beside it (`SessionControls part="status"`: working, quiet, may need you, failed), the task bar, and a footer with the starters (`part="starters"`) and **Show details**. The `no tasks` and error marks stay. The rest moves to `ChangeFacts` in the detail header: repository tag, branch, completion age, pending archive, work status (`WorkStatus`), the prompt (`promptBody`, the form's heading stripped), the column and the task meter. The artifact strip and intent line go (the tabs mark written artifacts). Separation: a `--shadow-card` token, `--border` edges and a hairline above the footer.
- **Layouts**: `Filters.layout` (`auto | lanes | stack`, URL `layout=`, not a filter). `resolveLayout` + a `matchMedia` hook pick Stack below 1280px. Stack makes columns full-width sections whose `.cards` is a grid of repository groups; the page scrolls (`.app:has(.board.stacked)`), so the hero scrolls away. In Lanes, empty lanes become 50px rails with a vertical name, and `--lane-width` drops to 272px below 1600px. The hero compacts below 1280px.
- **Tiles**: `checkoutSummary` gives `<n> worktrees · <m> branches active` (linked worktrees; distinct checked-out branches, main included, detached excluded), with every checkout in the tooltip. The chip list goes and the tile shrinks to 296px.
- **Activity**: the board's `RepoMenu` and `FilterTagList` (now exported) replace its chip row, and the kinds become a segmented toggle group with **Clear filters**.

### D13. Sixth review: console quick link, dialogs, a calm repository header

- **`Modal`** (`src/ui/modal.tsx`): the detail view's look (blurred backdrop, 16px panel, titled header with an accent icon tile, close control) as a reusable dialog, with Escape and backdrop-click closing and an optional `canClose` guard. The New change form uses it (`NewChangeDialog`), guarded while the request runs, instead of an inline strip.
- **Console quick link**: a terminal-icon link in the card's top-right, next to the session status, shown when `consoleAvailable` says the change has a session or session worktree. It leads to `consoleTarget(card, from)`, the detail view with `artifact=console`. Icon-only by design, to keep the footer on one line: the spec's icon rule names it as the one exception, carried by its tooltip and accessible name.
- **Repository header**: the main checkout's chip plus `CheckoutSummaryButton`. It reads `<n> branches` (from `checkoutSummary`), adds `<m> with work` when `checkoutsNeedingAttention` finds uncommitted, unpushed or stale checkouts, and opens a `Modal` listing every checkout's chip with its path.

## Risks / Trade-offs

- [Repository colours change once after the upgrade, because `REPO_HUES` changes] → This is a one-time shift that is the same for every user. Stability within a version, which is what the spec promises, is unaffected. Mention it in the PR description.
- [Near-black ground reverses an earlier deliberate "lift to soft grey"] → The user chose it explicitly. Surfaces step up clearly (`#090a0f` → `#141822` for cards), and the contrast test runs against the real values.
- [CSS conflicts with in-flight changes that edit `styles.css`] → Keep this change's edits grouped by section, with no reordering of untouched blocks. Whichever lands second rebases. Structural rules those changes add (console pane, settings scroll) are only re-tokenised here.
- [Bundle size] → The Inter Latin subset replaces Space Grotesk at about 2× its size (tens of KB). Icons are a few hundred bytes. There is no JS dependency.
- [`backdrop-filter` cost on large boards] → It is only used on the top bar, which is small. It is skipped where unsupported.
- [xterm terminal colours] → `sessionPanel.tsx` reads tokens with literal fallbacks. Update the fallbacks to the new dark values so a missing token never shows the old teal.

## Migration Plan

This is a pure client change, shipped with the next binary. Rollback means reverting the PR. There is no stored state to migrate. The theme preference key and group-state key are unchanged. The README screenshots regenerate from the demo on deploy.
