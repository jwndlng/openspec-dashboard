# Tasks

## 1. The tint helper

- [x] 1.1 Add `repoTint(hues, repoId)` to `src/ui/repoGroups.ts` (design D3): `{ class: "repo-tint", style: { "--repo-hue": "<hue>" } }` for a repository with a hue, `{ class: "" }` with no style otherwise. Verify with the typecheck in `bun run check`.
- [x] 1.2 Extend `test/repoGroups.test.ts`: a repository in the snapshot gets the class and the hue `assignRepoHues` gave it; a repository absent from the hue map gets neither class nor style. Verify `bun test test/repoGroups.test.ts` passes.

## 2. Tinted tabs

- [x] 2.1 In `SessionTabs` (`src/ui/sessionPanel.tsx`) memoise `assignRepoHues((ui.snapshot?.repos ?? []).map((r) => r.id))` and apply `repoTint` to each tab button's class and style; give the repository name span a `repo-name` class beside its existing `hint`. Verify no other tab behaviour (title, keyboard, marks, ordering) changed.
- [x] 2.2 Add `.session-tab.repo-tint` to `src/ui/styles.css` (design D1, D2): the inset 3px leading accent in `var(--repo-color)` with the left padding it needs, and `.session-tab.repo-tint .repo-name { color: var(--repo-color) }`. Leave `.session-tab.shown` and `.session-tab.active` untouched; use tokens only, no literal colours. Verify `bun run check` passes (lint forbids literal colour values in component styles).
- [x] 2.3 Check two sessions from different repositories in the rendered UI (done on the demo build, which uses the same components and has sessions in two repositories): each tab's accent and repository name match that repository's cards and filter chip (`--repo-hue` 105 and 255 on both tab and chip), the `▣` mark and the focused tab's brand top border are still readable, and filtering the board to one repository changes no tab colour.

## 3. Contrast and themes

- [x] 3.1 Extend `test/repoContrast.test.ts` (design D4) to check all 24 hues against `--bg-base` (the tab strip) and `--bg-section` (a shown tab) in both themes. Verify `bun test test/repoContrast.test.ts` passes; if a hue fails, apply the fallback in design.md — Risks before changing the threshold.
- [x] 3.2 Check the strip in both themes (light and dark) by switching the theme control while the dock is open: tinted names stay legible and the dock's own borders are unchanged.

## 4. Untracked repositories and the demo

- [x] 4.1 Verify a session whose repository is not in the snapshot renders an untinted tab exactly as today — covered by the `repoTint` unit test (an unknown repository gets neither class nor style) and by the tab markup, which renders exactly that helper's output; the live variant (switching a repository off in Settings) needs a running agent session and was not exercised.
- [x] 4.2 Check the demo site (`src/ui/demo`): its sample sessions' `repoId`s resolve to snapshot repositories, so demo tabs are tinted with the same colours as the demo board. Verify in the demo build.

## 5. Ship

- [x] 5.1 Run `bun run check` (lint, typecheck, tests) and `bun run build`, then serve `dist/openspec-dashboard` once and confirm the embedded UI carries the new rules (`.session-tab.repo-tint`, `.repo-name`) — the tint is plain CSS in the embedded page, nothing that reads files relative to a module.
- [x] 5.2 Confirm the change is complete against its spec delta: every scenario in `specs/kanban-board/spec.md` is covered by a test or by one of the manual checks above. Run `openspec validate agent-session-coloring --strict`.
