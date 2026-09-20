## 1. Group state module

- [x] 1.1 Add `src/ui/groupState.ts` with the pure functions from design D1/D2: `defaultMinimized`, `groupKey`, `isMinimized`, `toggleGroup` (removes the key when the new value equals the default), `parseGroupState` (tolerant), `serializeGroupState`, `pruneGroupState`
- [x] 1.2 Add `loadGroupState()` / `saveGroupState(overrides, knownRepoIds)` wrapping `localStorage` (key `openspec-dashboard.groups.v1`) in try/catch, pruning on save
- [x] 1.3 Add `test/groupState.test.ts`: defaults per column; toggle away from and back to the default leaves no key; per-column independence; parse drops invalid JSON, non-objects and non-boolean values; prune removes unknown repository ids; serialize/parse round trip

## 2. Board wiring

- [x] 2.1 In `Board` (`src/ui/kanban.tsx`) hold the overrides in state initialised from `loadGroupState`, expose `toggle(repoId, column)` that updates state and saves with the snapshot's repository ids
- [x] 2.2 Pass `label`, overrides, `onToggle` and `forceExpanded` (`filters.q.trim() !== ""`) through `Column` to `RepoGroups`, for regular columns and `Archived` alike
- [x] 2.3 In `RepoGroups` render the header as `<button type="button" aria-expanded aria-controls>` with a chevron, swatch, name and count; render the cards container only when expanded; when `forceExpanded`, show expanded and mark the button `aria-disabled` with the "expanded while searching" tooltip and ignore clicks
- [x] 2.4 Leave the flat single-repository path untouched

## 3. Styles

- [x] 3.1 In `src/ui/styles.css`: button reset for `.repo-group-head` (inherit font, full width, no border/background, pointer cursor), chevron, `:hover` and `:focus-visible` states from existing tokens, disabled look while searching
- [x] 3.2 Minimized panel is exactly one header line high (no inner gap); panel tint, border and group spacing unchanged; check `test/repoContrast.test.ts` still passes

## 4. Verification and docs

- [x] 4.1 `bun run check` passes
- [x] 4.2 `bun run build:ui` and verify on a multi-repository board in both themes: `Archived` groups start minimized with counts adding up to the shown total; toggling works by mouse and keyboard; state survives reload and a scan; per-column independence; searching for an archived change expands its group and clearing restores it; single-repository board unchanged; column counts unchanged by minimizing
- [x] 4.3 Add one sentence about minimizable groups (and the `Archived` default) to the README board description
