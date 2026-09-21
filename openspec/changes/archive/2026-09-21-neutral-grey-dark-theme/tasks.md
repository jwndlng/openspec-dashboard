## 1. Dark tokens

- [x] 1.1 Replace the five dark background tokens in `src/ui/styles.css` with the neutral ramp from design.md
- [x] 1.2 Replace the four dark text tokens with the neutral values from design.md
- [x] 1.3 Replace the four dark border tokens with the neutral values from design.md

## 2. Surroundings

- [x] 2.1 Confirm no hardcoded old base colour remains in `scripts/build-ui.ts`, the HTML shell or `README.md`, and update any that does
- [x] 2.2 Re-check the per-repository colour tokens against the grey ground via `test/repoContrast.test.ts`; adjust only if it fails

## 3. Verification

- [x] 3.1 Run a contrast script over the new values: heading, body and subtle text at 4.5:1 or more on base, section and raised; background channels within 6 of each other
- [x] 3.2 Confirm the light theme block is byte-identical to before
- [x] 3.3 Run `bun run check` and `bun run build`
- [x] 3.4 Visual check of overview, combined board, a repository board and Settings in dark mode
