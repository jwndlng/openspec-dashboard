# Tasks

## 1. Shared hue palette and label hue

- [x] 1.1 Move `REPO_HUES`, `MIN_HUE_GAP` and `fnv1a` from `src/ui/repoGroups.ts` into new `src/shared/hues.ts`, re-export `REPO_HUES` and `MIN_HUE_GAP` from `repoGroups.ts`; verify `bun test test/repoGroups.test.ts test/repoContrast.test.ts` passes unchanged
- [x] 1.2 Add `nearestAssignableHue(hue)` (circular distance, ties to the lower hue) and `labelHue(label, labelColors)` to `src/shared/labels.ts`; add a `hue` to `DisplayedLabel` and a `labelColors` parameter to `displayedLabels`; verify with new cases in `test/labels.test.ts`: same hue for `client`/`Client`, stable derived hue, override used, out-of-palette value snapped, every result in `REPO_HUES`

## 2. Configuration and endpoint

- [x] 2.1 Add optional `labelColors?: Record<string, number>` to `Config` in `src/shared/types.ts` and to `configSchema` in `src/server/config.ts` (lower-case keys under the label rules, whole numbers 0–359, at most 200 entries, errors naming the label); verify in `test/config.test.ts` that an old config round-trips without the key and that hue `400`, an upper-case key and 201 entries are refused
- [x] 2.2 Add `POST /api/labels/color` in `src/server/api.ts` (trim + lower-case the label, set or delete the entry, drop an empty map, `updateConfig` under `tracking(...)`, no scan); verify in `test/trackingApi.test.ts` (home of the other settings routes) the spec scenarios: setting, clearing the last entry, invalid hue (`12.5`, `360`), invalid label (`a,b`), missing field, no scan triggered, and `403` cross-site

## 3. Client API and demo

- [x] 3.1 Add `setLabelColor(label, hue)` to the API interface and HTTP client in `src/ui/api.ts` (and its delegating wrapper), and `setLabelColor` to `Tracking` in `src/ui/untracked.tsx` with the dialog's busy/error handling; verify `bun run check` typechecks
- [x] 3.2 Implement `setLabelColor` in `src/ui/demo/demoApi.ts` with the same validation; verify in `test/demoApi.test.ts` that setting, clearing and an invalid hue (`400`) behave as on the server

## 4. Rendering

- [x] 4.1 Add per-theme `--label-l`, `--label-c`, `--label-soft-l` tokens and `.label-chip.label-tint` styles (tinted text, border and soft ground; dashed border kept for detected; `.on` = brand border plus label tint) in `src/ui/styles.css`; verify by extending `test/repoContrast.test.ts` to check label text ≥ 4.5:1 on its chip over the row, tile, board header, filter bar and dialog backgrounds in both themes, and that every label hue keeps the 12° berth
- [x] 4.2 Render the hue in `LabelChips` (`--label-hue` style, `label-tint` class) and an `IconCheck` before the text of an active filter chip; pass `config.labelColors` to `displayedLabels` in `src/ui/overview.tsx` and `src/ui/kanban.tsx`, and give the label filter options the same hue; verify in `test/overview.test.ts` and `test/labelChipsUi.test.ts` that a row, tile and filter chip of `client` carry the same `--label-hue`, and that only active chips render the check icon

## 5. Colour picker in the labels dialog

- [x] 5.1 Add a swatch button before each custom and detected chip in `RepoLabelsEditor` that opens an inline group (`LabelColorPicker`) of **Auto** plus the assignable hues, current choice pressed with a check, one picker open at a time, closed by choosing or by its swatch; wire it through `RepoLabelsDialog` to `tracking.setLabelColor`; verify in `test/projectSettingsUi.test.ts` that choosing a hue calls `setLabelColor("client", <hue>)`, **Auto** calls it with `null`, a detected label can be recoloured, and a failed save shows the error notice

## 6. Verification

- [x] 6.1 Run `bun run check` and confirm lint, typecheck and all tests pass
- [~] 6.2 Run `bun run dev`, open the overview in both themes, give two repositories the same label, recolour it in one dialog and confirm it changes everywhere (rows, tiles, filter, board header) without a scan, then choose **Auto** and confirm `labelColors` is gone from `~/.openspec-dashboard/config.json`
- [x] 6.3 Run `bun run build` and confirm `dist/openspec-dashboard` serves coloured labels and the picker
