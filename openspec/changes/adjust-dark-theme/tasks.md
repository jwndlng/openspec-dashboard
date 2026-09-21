# Tasks

## 1. Lift the dark token block

- [ ] 1.1 Replace the five background tokens in the dark `:root` block of `src/ui/styles.css` with the values in the design's table (`--bg-base` `#141619`, `--bg-section` `#1d1f21`, `--bg-raised` `#232529`, `--bg-surface` `#2f3134`, `--bg-elevated` `#3b3e41`) and verify with `git diff src/ui/styles.css` that only value lines inside that block changed — no selector line and nothing under `:root[data-theme="light"]`
- [ ] 1.2 Update the three text tokens (`--fg-body` `#a7aaaf`, `--fg-subtle` `#888c91`, `--fg-disabled` `#525559`), leaving `--fg-heading` at `#f3f5f7`, and verify the diff shows `--fg-heading` untouched
- [ ] 1.3 Update `--danger` to `#ff3d75` and verify the other status tokens (`--success`, `--warning`, `--warning-strong`) are unchanged in the diff
- [ ] 1.4 Update the accent and status tints `--brand-soft` `#224b4b`, `--brand-softer` `#162e2e`, `--success-border` `#135a46`, `--warning-border` `#89391f`, `--danger-border` `#781332`, `--danger-bg` `#490b1e22`, and `--border-subtle` `#2f3134`, then verify `--border-subtle` equals the new `--bg-surface` as it did before
- [ ] 1.5 Verify no literal colour crept outside the token block: `grep -n '#[0-9a-fA-F]\{6\}' src/ui/styles.css` lists only lines inside the two `:root` blocks

## 2. Keep the terminal fallbacks in sync

- [ ] 2.1 Update the two stale fallback literals in `terminalTheme` in `src/ui/sessionPanel.tsx` (`--bg-base` → `#141619`, `--bg-elevated` → `#3b3e41`) and verify `grep -n '0b0d10\|313437' src/ui/sessionPanel.tsx` returns nothing

## 3. Verify the contrast floors hold

- [ ] 3.1 Write a throwaway script (scratchpad, not committed) that parses the dark `:root` block from `src/ui/styles.css` and asserts ≥4.5:1 for `--fg-heading`, `--fg-body` and `--fg-subtle` on `--bg-base`, `--bg-section` and `--bg-raised`, and for `--success`, `--warning`, `--warning-strong`, `--danger`, `--brand` and `--brand-fg` on `--bg-raised` and `--bg-section`; verify it reports every pair passing
- [ ] 3.2 Extend that script to assert `--brand-fg` reaches 4.5:1 on both `--brand-soft` and `--brand-softer`, and that each of `--brand-soft`, `--brand-softer`, `--success-border`, `--warning-border` and `--danger-border` is lighter than `--bg-section`; verify all pass
- [ ] 3.3 Verify each new background's red, green and blue channels differ by no more than 6 of 255, satisfying the `kanban-board` "Dark ground is neutral grey" scenario
- [ ] 3.4 Run `bun test test/repoContrast.test.ts` and verify the dark-theme case still passes against the new `--bg-section`

## 4. Check the result in the running dashboard

- [ ] 4.1 Run `bun run dev` and verify in the dark theme that the board's page, column, card and hover surfaces are each still distinguishable from one another, and that brand chips, status badges and the settings panels read as tints on their surface rather than holes
- [ ] 4.2 Open a change detail view and the session dock and verify the xterm.js terminal background matches the new page ground and the dock and modal surfaces still separate from the board behind them
- [ ] 4.3 Switch the theme control to Light and back and verify the light theme is pixel-identical to before the change and that switching still needs no reload

## 5. Land it

- [ ] 5.1 Run `bun run check` and verify lint, typecheck and the full test suite pass
- [ ] 5.2 Run `bun run build` and verify `dist/openspec-dashboard` serves the new dark ground, confirming the inlined stylesheet and the pre-paint script carry the change into the binary
