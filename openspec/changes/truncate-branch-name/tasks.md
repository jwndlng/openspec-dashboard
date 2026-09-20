## 1. Split helper

- [x] 1.1 Add `splitBranchLabel(name, tailLength = 16)` to `src/ui/format.ts` per design D2 (short names unsplit; tail nudged to a `-`, `/`, `_` or `.` boundary within 4 characters)
- [x] 1.2 Add `test/format.test.ts`: short name → `{ head: name, tail: "" }`; long conventional name → tail `quota-enforcement`; `head + tail === name` always; name without separators; boundary nudge limit; empty string

## 2. Badge component and styles

- [x] 2.1 Add a `BranchBadge` component in `src/ui/kanban.tsx` (glyph span, inner text wrapper with head and tail spans, `title` with full name plus existing hint, `aria-label`, text spans `aria-hidden`) per design D1/D3
- [x] 2.2 Use `BranchBadge` for `card.branchMatch` in `ChangeCard` and for `repo.currentBranch` in the repository board header
- [x] 2.3 In `src/ui/styles.css` add `.badge.truncate` rules (max-width 100%, min-width 0, shrinking head with ellipsis, non-shrinking tail, zero gap between text parts) and `.card .meta > * { min-width: 0; }`; tokens only, no literal colours

## 3. Verification and docs

- [x] 3.1 `bun run check` passes
- [x] 3.2 `bun run build:ui` and check on a board with a long branch name, in both themes: badge stays inside the card and group panel, reads `head…tail`, tooltip shows the full name, short names unchanged, age badge not squeezed, repository header badge behaves the same in a narrow window
- [x] 3.3 Mention the shortened branch badge in the README board description if cards are described there
