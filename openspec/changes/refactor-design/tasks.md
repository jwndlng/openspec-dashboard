# Tasks

## 1. Tokens and palette

- [x] 1.1 Replace the dark `:root` token block in `src/ui/styles.css` with the cool near-black slate/indigo set (design D2), add `--radius-sm`/`--radius`/`--radius-lg`, `--shadow-sm`/`--shadow-lg`, `--on-brand`, `--brand-ring` and `--bg-overlay`, and move `info` to sky (D3). Verify `grep -nE '#[0-9a-fA-F]{3,8}' src/ui/styles.css` finds colours only inside the two token blocks
- [x] 1.2 Replace the `:root[data-theme="light"]` block with the slate/indigo light set, using the same token names. Verify every token defined in the dark block is also defined in the light block (a small check in `test/repoContrast.test.ts` or a one-off script)
- [x] 1.3 Recompute `REPO_HUES` in `src/ui/repoGroups.ts` for the new status and accent hues (12° berth in both themes, 12° apart, 19 entries) and update its comment. Verify with `bun test test/repoContrast.test.ts test/repoGroups.test.ts`
- [x] 1.4 Extend `test/repoContrast.test.ts`: `--on-brand` on `--brand-strong` ≥ 4.5:1 in both themes, `info` hue ≥ 24° from `--brand`, every dark background token with OKLCH chroma ≤ 0.04 and hue 240–290°, `--bg-base` darker than `#101214`, and the five backgrounds ascending. Verify the new tests pass and fail when a token is deliberately detuned

## 2. Fonts and icons

- [x] 2.1 Add `src/ui/fonts/Inter.woff2` (Latin variable subset, OFL) and remove `SpaceGrotesk.woff2`. Update the font list in `scripts/build-ui.ts` and `--font-sans`, and add `src/ui/fonts/README.md` with source and licence for Inter and JetBrains Mono. Verify `bun run build:ui` succeeds and `dist/ui/index.html` contains an `Inter` `@font-face` and no `Space Grotesk`
- [x] 2.2 Create `src/ui/icons.tsx` with the inline SVG icons from design D5 (Lucide path data, ISC notice, `aria-hidden`, `focusable="false"`, `currentColor`). Verify `bun run typecheck` passes and no icon import pulls in a package

## 3. Pure helpers

- [x] 3.1 Add `artifactChips(card)` (initial, name, done, in `displayOrder`, and `[]` for an unreadable change) and `columnKind(label, …)` (`neutral | accent | success | muted | warning`). Verify with new unit tests covering spec-driven order, another schema (`brief`/`plan`/`checklist`), the `Unknown` column and every lifecycle column name

## 4. Shell and board

- [x] 4.1 Restyle the top bar in `src/ui/app.tsx`: logo mark with `IconLayers`, nav as a segmented pill control keeping the Activity count, theme button with icon plus `Theme: …` text, Refresh with `IconRefresh`. Verify `bun run dev` shows it in both themes and the theme button still cycles System → Light → Dark
- [x] 4.2 Add the combined board's header band in `src/ui/kanban.tsx` (title `All changes`, `Open n` and `To archive n` chips, primary **New change** with `IconPlus` under the existing eligibility rule), and remove the count badge and button from the filter row. Verify in the demo that the counts follow the repository filter and that the button is absent when no repository is eligible
- [x] 4.3 Give `RepoHeader` the band styling, the same two counts for its repository, and **New change** as the primary button. Everything else the project-overview header requirement lists is kept. Verify on a repository board in the demo (checkout chips, Pull, Cleanup, Copy cd and notices still present)
- [x] 4.4 Turn the filter row into the toolbar: search field with a leading `IconSearch`, `Clear filters` instead of `reset`, and `Showing n changes` on the right. Filters and URL persistence are unchanged. Verify `bun test test/url.test.ts` and a manual reload keeping a search
- [x] 4.5 Column head: an `aria-hidden` stage dot from `columnKind`, the name and a count pill, keeping the `hot` highlight and `25 of N`. Verify visually in the demo that the markers follow the lifecycle and that the accessible name is just the column name and count
- [x] 4.6 Card: add the artifact strip (chips with initial and ✓/–, tooltip and `aria-label` `<artifact>: done|not done`, brand-soft tint for done, none on `Unknown`), the full-width meter, rounded corners, and a hover lift only under `prefers-reduced-motion: no-preference`. Show details stays the only link. Verify in the demo, and add a render test asserting the strip's labels and that it contains no anchor

## 5. Restyle the other views through tokens

- [x] 5.1 Board columns, repo groups, chips, badges, buttons (primary = `--brand-strong` fill with `--on-brand`), inputs and focus rings on the radius and shadow scale. Verify both themes in the demo at 1440px and 720px widths
- [x] 5.2 Overview table and tiles, repository board header, notices and empty states. Verify on `/` in both themes and both overview layouts
- [x] 5.3 Detail overlay (tabs, file list, markdown, raw view, Console tab still in the `info` role), end-session and cleanup dialogs, and the Open work menu. Verify by opening a change, its Console tab and each dialog in the demo
- [x] 5.4 Settings page and navigation, shared-config editor, agent settings, and the activity feed. Verify `/settings` and `/activity` in both themes, including the narrow-screen settings nav
- [x] 5.5 Update the terminal-theme fallback colours in `src/ui/sessionPanel.tsx` and any literal colours in `src/ui/demo/demo.css` to the new palette. Verify `grep -nE '#[0-9a-fA-F]{6}' src/ui/**/*.ts*` shows only the token fallbacks

## 6. Verification and docs

- [x] 6.1 Update tests that assert changed labels or markup (for example `reset` or the `open · to archive` badge), with none deleted. Verify `bun run check` passes
- [x] 6.2 `bun run build` and open `dist/openspec-dashboard` offline. Verify the fonts render and the browser devtools network tab shows no external request
- [x] 6.3 `bun run build:demo && bun run screenshots`. Verify `board-dark.png` and `board-light.png` show the new design, and `git status --porcelain` shows no generated files
- [x] 6.4 Update any `README.md` wording about the look (font, teal, "Dithered"). Verify with `grep -niE 'teal|space grotesk|dithered' README.md src/ui` that nothing stale remains

## 7. Fidelity pass against the mockup (design D8)

- [x] 7.1 Add `--<role>-bg` soft-tint tokens for info, branch, success and warning (danger has one), draw role badges on them, and extend `test/repoContrast.test.ts` to check each role's text against its tint composited over both badge grounds. Verify with `bun test test/repoContrast.test.ts`
- [x] 7.2 Add `promptSummary(prompt)` to `src/ui/boardMarks.ts` (first line that is neither empty nor a heading). Verify with unit tests for the `# Prompt` preamble, a missing prompt and whitespace-only lines
- [x] 7.3 Rework `ChangeCard`: top row with name and repository tag, intent line, strip above a hairline, meter, and a footer with the age, badges, controls and **Show details**. Drop the coloured left edge. Verify that the existing card tests and a new test for the tag and intent line pass
- [x] 7.4 Restyle the lanes (full height, dot, square count chip, gaps), calmer group-panel mix, the band (subtitle, divider, filled counts, primary glow), a centred top-bar navigation, the detail overlay and the scrollbars. Verify both themes in demo screenshots of the board, repository board, detail view and settings

## 8. Second review (design D9)

- [x] 8.1 Lighter dark palette, visible borders and a lighter `--danger`, with tests for border visibility and the new ground bounds. Verify with `bun test test/repoContrast.test.ts`
- [x] 8.2 Filter bar in `src/ui/boardFilters.tsx` (search with clear, Repositories menu, Stale select, Hide archived switch, active tags, Clear filters, count), with unit tests for `staleOptions` and `activeTags`. Verify `bun test`, and that a reload keeps every filter
- [x] 8.3 Action areas in the combined band and the repository header (Pull, Clean up, New change together; status row below the title). Verify in demo screenshots at 1600px and 720px
- [x] 8.4 Overview band with counts and Pull all, a bar with a segmented Table/Tiles control, and equal-size tiles (monogram, big totals, stage strip, scrolling badge and checkout areas). Verify tiles screenshots in both themes and that `test/overview.test.ts` passes

## 9. Third review (design D10)

- [x] 9.1 Neutral grey dark palette (`#26272b` … `#4b4c51`), with `info`, `success` and `danger` retuned, and the ground test rewritten for near-neutral greys. Verify with `bun test test/repoContrast.test.ts test/repoGroups.test.ts`
- [x] 9.2 Detail view padding: a `.detail-head` rule and a shared `--detail-pad` for the tabs, file list, content, toolbar and console. Verify in demo screenshots of the Proposal, Tasks and Console tabs

## 10. Fourth review (design D11)

- [x] 10.1 Product mark as data (`logoMark.ts`), drawn in tokens (`logo.tsx`) and embedded as the favicon by `scripts/build-ui.ts`. Verify the built page has the `rel="icon"` data URI and no icon request
- [x] 10.2 Hero header: big title with a gradient accent word, tagline, status corner, large icon tabs, and a glow and dot-grid ground under the band and filter bar. Verify demo screenshots at 1920px (both themes) and 720px
- [x] 10.3 `bun run check` and the official screenshots pass after the hero

## 11. Fifth review (design D12)

- [x] 11.1 Overview card: name and age, session status, task bar, next step and Show details. Branch, work status, pending archive, prompt, completion and column move to the detail header. Verify `test/changeDetail.test.ts`
- [x] 11.2 Card separation: `--shadow-card`, stronger card edges, a footer hairline and calmer group panels. Verify demo screenshots in both themes
- [x] 11.3 Lanes/Stack layout (auto below 1280px, URL `layout=`, empty-lane rails, narrower lanes, a scrolling page in Stack, a compact hero). Verify `test/boardFilters.test.ts` and 960px screenshots
- [x] 11.4 Tile checkout summary (`checkoutSummary`) instead of chips. Verify `test/overview.test.ts`
- [x] 11.5 Activity page uses the Repositories menu, filter tags and a kinds toggle group. Verify a screenshot of `/activity?repos=…`
- [x] 11.6 `bun run check` and the official screenshots

## 12. Sixth review (design D13)

- [x] 12.1 Shared `Modal`, and the New change form in it (`NewChangeDialog`, closing is guarded while creating). Verify with a CDP screenshot of the open dialog
- [x] 12.2 Console quick link on cards with a console (`consoleTarget`). Verify the `test/changeDetail.test.ts` target test and a board screenshot
- [x] 12.3 Repository header: main checkout chip plus `<n> branches` / `<m> with work`, opening the Branches dialog. Verify `test/overview.test.ts` (`checkoutsNeedingAttention`) and a dialog screenshot
- [x] 12.4 `bun run check` and the official screenshots

