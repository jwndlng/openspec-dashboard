# Tasks

## 1. Data model and configuration

- [x] 1.1 Add `labels?: string[]` and `hiddenLabels?: string[]` to `RepoConfig`, and `detectedLabels?: { label: string; marker: string }[]` to `RepoSnapshot` in `src/shared/types.ts`; verify `bun run check` typechecks
- [x] 1.2 Extend `repoSchema` in `src/server/config.ts` with both optional lists (trimmed, 1–32 chars, no control characters, no comma, at most 20, case-insensitively unique with an error naming repository and label); verify new cases in `test/config.test.ts` for duplicate, over-long, comma, control-character and over-count refusals, and that a config without labels round-trips through `validateConfig` without gaining either key

## 2. Detection

- [x] 2.1 Create `src/shared/labels.ts` with `LABEL_RULES` (every row of the spec's table), the pure `detectLabels(entries)` and `displayedLabels(repo, detected)`; verify a new `test/labels.test.ts` covers each rule, symlink entries (`kind: "other"`) never matching, sorted and de-duplicated output, first-rule marker wins, custom-shadows-detected ignoring case, and hidden labels
- [x] 2.2 Add `listEntries(absDir)` to `RepoSource` and `LocalRepoSource` in `src/server/source.ts` (`readdir` with file types, symbolic links as `"other"`, `[]` on failure), plus any test doubles implementing `RepoSource`; verify `bun run check` passes
- [x] 2.3 Add the bounded two-level `scanLabels` to `src/server/scanner.ts` (skip dot-directories and `node_modules`, `vendor`, `dist`, `build`, `target`, `openspec`; ≤64 subdirectories in name order; ≤500 entries per directory) and set `detectedLabels` in `scanRepo` for the main checkout's project folder only; verify in `test/scanner.test.ts` with a temporary repository: top-level `main.tf`, `service/go.mod` one level down, a too-deep `.tf` ignored, `node_modules/x/Cargo.toml` ignored, a non-git folder detected the same way, a failed scan without labels, and the repository byte-for-byte unchanged after the scan

## 3. Overview and board header

- [x] 3.1 In `src/ui/overviewState.ts` add `labels: string[]` to `OverviewState` (repeated `label=` parameters, omitted when empty, existing URLs unchanged), carry displayed labels on `OverviewRow`, and AND-match them in `filterRows` combined with `q` and `wip`; verify in `test/overview.test.ts` the spec's filter scenarios (one label, AND, combined with search, unknown label lists nothing) and the URL round-trip
- [x] 3.2 Render label chips on overview rows (under the name, at most three, then `+<n>` with a tooltip) and tiles (wrapping) in `src/ui/overview.tsx`, with the detected icon and marker tooltip from `src/ui/icons.tsx`; chips are buttons that toggle the filter without navigating; verify with `bun run dev` that activating a chip on a row filters and stays on the overview, in both layouts
- [x] 3.3 Add the label filter control to the overview band beside the work-in-progress toggle, listing every displayed label plus any unmatched active one; verify with `bun run dev` that `/?label=cobol` shows `cobol` active with no repositories and removing it lists all again
- [x] 3.4 Show the displayed labels in the repository board header in `src/ui/kanban.tsx`, wrapping, passing the config where the header does not have it yet; verify with `bun run dev` on a repository with a custom and a detected label
- [x] 3.5 Add chip, `+<n>` and detected-marker styles to `src/ui/styles.css` using the existing theme tokens; verify in both light and dark themes with `bun run dev`

## 4. Settings

- [x] 4.1 In Settings → Tracked repositories (`src/ui/settings.tsx`) add per repository: removable custom-label chips, an input with a `<datalist>` of labels used on other repositories that refuses empty, too long, comma-containing and duplicate labels in place, and the last-scanned detected labels as show/hide toggles writing `hiddenLabels`; removing the last label removes the key; verify with `bun run dev` that label edits mark the draft unsaved and that saving persists them to `config.json`
- [x] 4.2 Verify in `test/api.test.ts` that a `PUT /api/config` changing only labels or hidden labels starts no scan, and that one with an invalid label is refused and leaves the stored config unchanged

## 5. Demo, docs and final check

- [x] 5.1 Give some repositories in `src/ui/demo/sampleData.ts` custom labels, detected labels and one hidden detected label (made-up names only); verify `test/demoData.test.ts` passes and the demo build shows them
- [x] 5.2 Add a short "Labels" note to `README.md` (custom labels in Settings, the detected technologies, hiding a wrong guess, the `label=` filter); verify the rule list there matches `LABEL_RULES`
- [x] 5.3 Run `bun run check` and `bun run build`, then start `dist/openspec-dashboard` and confirm detected labels appear for a repository with marker files in the compiled binary
