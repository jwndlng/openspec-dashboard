# Tasks

## 1. The drawing as shared data

- [x] 1.1 Rewrite `src/ui/logoMark.ts`: viewBox `0 0 128 128` and the ordered parts list from `prompt.md` (construction lines and ticks tagged `detail`, square, hub, four nodes with their glyphs), each with stroke width, opacity and fill role `none`/`ink`/`ground`; update the header comment to describe the new mark. Verify `bun run typecheck` (via `bun run check`) passes.
- [x] 1.2 Rewrite `faviconSvg()` from the same list: filled rounded square in `#26272b`, strokes `#a5b4fc`, `ground` fills `#26272b`, `detail` parts skipped, viewBox `6 6 116 116`, stroke widths scaled by one exported factor; keep the comment naming the mirrored tokens. Verify by rendering the returned SVG in a browser at 16px and 32px and settling the factor so the nodes and glyphs stay distinct.

## 2. The hero mark

- [x] 2.1 Rewrite `LogoMark` in `src/ui/logo.tsx` to map the parts list to JSX with `stroke="currentColor"`, `ink` → `currentColor` and `ground` → `var(--bg-base)`, dropping the gradient tile and its `<defs>`; keep `aria-hidden` and `focusable="false"`. Verify no literal colour appears in the file (`grep -nE '#[0-9a-fA-F]{3,8}|white' src/ui/logo.tsx` finds nothing).
- [x] 2.2 Change only the `.logo-mark` rule in `src/ui/styles.css` to `color: var(--brand-fg)` with a softer accent drop-shadow. Verify with `bun run dev` that the hero shows the new mark at 60px, and at 48px and 44px in narrower windows, legible in both the dark and the light theme.

## 3. Tests and checks

- [x] 3.1 Add `test/logoMark.test.ts`: `faviconSvg()` is a standalone SVG with no external reference and no `detail` part; it contains the square, hub and the four node glyphs of the shared list; the list has exactly four nodes. Verify `bun test test/logoMark.test.ts` passes.
- [x] 3.2 Run `bun run check` and `bun run build`; open `dist/openspec-dashboard` and confirm the browser tab shows the new favicon with no icon request in the network panel, and that `test/demoBundle.test.ts` still passes.
