# Tasks

## 1. Deciding which card is live

- [x] 1.1 Add `cardIsLive(config, sessions, card, now)` to `src/ui/sessionState.ts`, true exactly when one of the card's shown sessions (`cardSessionControls`) has a `sessionBadge(...).live` badge; verify with new cases in `test/agents.test.ts`: a session printing within `NEEDS_YOU_AFTER_MS` → true; silent past it (`may need you`), exited, failed, no session, another change's session and sessions disabled for the repository → false
- [x] 1.2 Give `ChangeCard` (`src/ui/kanban.tsx`) a `live` prop that adds the `live` class to `<article class="card">`, decided by `RepoGroups` with `cardIsLive` from `useSessionUi()` so the card stays hook-free; verify with a test in `test/boardMarks.test.ts` that the class follows the prop, and on the demo board that the card with a `working` session is the one tinted

## 2. Styling

- [x] 2.1 In `src/ui/styles.css` add the static `.card.live` tint (per-theme `--card-live-bg` at the card's lightness and the info hue, an info-mixed edge) and a `.card.live:hover` variant that keeps the tint, outside the reduced-motion query; verify in both themes that every role chip and text token keeps at least 4.5:1 against the tinted background (computed: worst 4.56:1, light `success` chip) and that the tint is visible on the demo board in both themes
- [~] 2.2 Inside the existing `prefers-reduced-motion: no-preference` / `background-clip: text` blocks add the name sweep on `.card.live .name` (resting `--fg-heading`, passing `--info` band, `session-sweep` with `--session-sweep`), so badge and name share one rhythm; verify in the browser that a wrapped name is swept on every line, and that with reduced motion emulated the name and badge are static while the tint remains
- [x] 2.3 Update the comment above the live badge styles to cover the card; verify the comment names the card, the name sweep and the reduced-motion behaviour

## 3. Verification

- [x] 3.1 Run `bun run check` and verify lint, typecheck and tests pass
- [~] 3.2 Run `bun run build` and open `dist/openspec-dashboard`; verify a card with a working session is tinted with a sweeping name, and an idle, ended and `may need you` card is plain
