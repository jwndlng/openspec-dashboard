# Tasks

## 1. Building blocks

- [x] 1.1 Add `changeRef(project, change)` to `src/ui/format.ts` returning `project/change`, with cases in `test/format.test.ts` (plain names, names with dots and underscores, no surrounding whitespace); verify with `bun test test/format.test.ts`
- [x] 1.2 Add `IconCopy` (Lucide `copy` path data) to `src/ui/icons.tsx` using the shared `Icon` wrapper; verify `bun run check` typechecks
- [x] 1.3 Add `CopyRefButton({ project, change, class? })` to `src/ui/kanban.tsx`: icon-only ghost button, `title`/`aria-label` `Copy <ref>`, swaps to `IconCheck` and `Copied` for 1.5 s only after the clipboard write resolves, ignores a rejection, clears its timer on unmount, stops click propagation, and announces `Copied` through a `.visually-hidden` `aria-live="polite"` span; verify with `bun run check`

## 2. Placement

- [~] 2.1 Render `CopyRefButton` with `repo.name` and `change.name` directly after the `.change-name` pill in `DetailHeader` (`src/ui/changeDetail.tsx`), so it also appears for a change gone from the snapshot; verify in `bun run dev` that the header of a change shows the icon and copies `project/change`
- [~] 2.2 In `ChangeCard` (`src/ui/kanban.tsx`) wrap the name in a row with `CopyRefButton` using `card.repoName` and `card.name`; verify on the board that the name, age and console link keep their places
- [~] 2.3 Add CSS in `src/ui/styles.css`: compact icon button size, header alignment, card reveal with `opacity: 0` at rest and visible on `.card:hover` / `:focus-visible`, always visible under `@media (hover: none)`; verify in `bun run dev` that hovering a card makes no name re-wrap, and that tabbing reaches and shows the icon

## 3. Verification

- [~] 3.1 Check accessibility by hand: the icon's accessible name reads `Copy <project>/<change>` in the header and on a card, the confirmation is announced as `Copied`, and nothing claims success when the clipboard write is refused (e.g. by denying clipboard permission)
- [~] 3.2 Run `bun run check` and `bun run build`, then open the UI served by `dist/spec-control` and confirm the copy icon works there too
