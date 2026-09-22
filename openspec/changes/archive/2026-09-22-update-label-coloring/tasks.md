# Tasks

## 1. Tokens

- [x] 1.1 Add the `info` and `branch` role tokens (`--info`, `--info-border`, `--branch`, `--branch-border`) to both theme blocks in `src/ui/styles.css` with the values from design.md D2, and drop the dead `--warning-strong`; every role keeps the badge's own `--bg-section` ground (design.md D1), so no `-bg` tokens are added; verify `bun run check` passes and no literal colour appears outside the two `:root` blocks
- [x] 1.2 Change the light `--warning` from `#a84d08` to `#7a6200` (design.md D2) and verify the light-theme contrast test in `test/repoContrast.test.ts` still passes
- [x] 1.3 Replace `.badge.brand` with `.badge.info` and `.badge.branch` in `src/ui/styles.css`, rename `.badge.ok` to `.badge.success` and `.badge.warn` to `.badge.warning`, each setting colour, border-colour and background from its role tokens; verify `rg '\.badge\.brand|badge ok|badge warn\b' src/ui` returns nothing

## 2. Contrast and hue tests (write before the mapping changes, so they fail first)

- [x] 2.1 In `test/repoContrast.test.ts`, add a test that every role token (`info`, `branch`, `success`, `warning`, `danger`) has ≥ 4.5:1 contrast against `--bg-section` and `--bg-raised` in both themes, reading the values from `styles.css`; verify it passes with the tokens from task 1
- [x] 2.2 Add a test asserting `REPO_HUES` (task 3.1) holds 19 distinct hues, each ≥ 12° from its neighbours and ≥ 12° from every role hue and from `--brand-fg`/`--brand` in both themes, with the role hues computed from the CSS tokens; verify it fails until task 3.1 lands and passes afterwards

## 3. Repository hues

- [x] 3.1 In `src/ui/repoGroups.ts`, replace the 24-slot arithmetic wheel with the constant `REPO_HUES` list from design.md D4, keeping the hash, the sorted-id iteration and the coprime probe stride (7 stays coprime with 19); verify `bun test test/repoGroups.test.ts` and the new hue test pass
- [x] 3.2 Update `test/repoGroups.test.ts`: the "distinct hues" test covers 17 and 19 instead of 17 and 24, the "multiples of 15" test becomes "every hue is a member of `REPO_HUES`", and the beyond-the-limit test uses 30 repositories still; verify `bun test test/repoGroups.test.ts` passes
- [x] 3.3 Verify determinism and filter-independence are untouched: `assignRepoHues` over a reversed id list yields the same map (existing test) and the board's hues do not change when a repository filter is applied

## 4. Label mapping

- [x] 4.1 In `src/ui/sessionState.ts`, widen `SessionBadge.tone` to `"info" | "branch" | "success" | "warning" | "danger" | ""` and change `sessionBadge` so `running` and `quiet` both return `info`; verify `bun test test/sessionPrompt.test.ts` and typecheck pass
- [x] 4.2 Change `workBadge` per design.md D3: `uncommitted`, `unpushed` and `pushed` return `branch`, `merged` returns `success`, and a stale entry still overrides to `danger`; verify `bun test test/workStatusUi.test.ts` passes after updating its expected tones
- [x] 4.3 In `src/ui/kanban.tsx`, give `BranchBadge` the `branch` class, the `prompt` badge the neutral class, the complete badge `success`, and the `no tasks` and pending-archive badges `warning`; verify the board renders each badge with its new class (`bun run dev`, or the card tests)
- [x] 4.4 Check every remaining badge usage across the UI for a stale class — `src/ui/changeDetail.tsx`, `src/ui/overview.tsx`, `src/ui/pull.tsx`, `src/ui/pullState.ts` (its `tone: "ok"`), `src/ui/sessionPanel.tsx`, `src/ui/settings.tsx`, `src/ui/sharedConfig.tsx`, `src/ui/activity.tsx` — and update it to a role from design.md D3; verify `rg -n '"ok"|"warn"\b' src/ui` turns up no badge tones

## 5. Motion and the demo

- [x] 5.1 Confirm the running badge's pulse and sweep in `src/ui/styles.css` reference the `info` role tokens rather than brand, that only `.badge.info.live` is animated, and that `prefers-reduced-motion: reduce` still makes it static; verify by reading the rule and looking at a running session in `bun run dev`
- [x] 5.2 Confirm the demo carries no badge tones of its own — it derives them from `sessionBadge`/`workBadge`, so it gets the new palette for free; verify the demo build (`bun test test/demoBundle.test.ts`) still passes

## 6. Close out

- [x] 6.1 Run `bun run check` and confirm lint, typecheck and the whole test suite pass
- [x] 6.2 Build the binary (`bun run build`) and open it once, confirming the palette and repository colours are identical to `bun run dev` (invariant 3: the UI is embedded, so this only guards the build)
- [x] 6.3 Re-read `openspec/changes/update-label-coloring/specs/kanban-board/spec.md` against the implementation and confirm every scenario has a test or an observable behaviour behind it; run `openspec validate update-label-coloring`
