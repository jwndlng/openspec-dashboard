# Tasks

## 1. Badge model and rendering
- [x] 1.1 `sessionBadge`: separate `icon` from `label`, add `live` (running and not quiet)
- [x] 1.2 `SessionBadgeView` component; use it on cards and in the session panel header

## 2. Styles
- [x] 2.1 Pulse and sweep keyframes from theme tokens, inside `prefers-reduced-motion: no-preference`, with an `@supports` fallback
- [x] 2.2 Check that no other badge picks up the animation

## 3. Tests and verification
- [x] 3.1 Helper tests: `live` only for running-and-not-quiet; label still says `running`
- [x] 3.2 Built UI contains the keyframes and the reduced-motion guard; `bun run check`, `bun run build`, `build:demo`
