# Design

## Context

The live badge is drawn by `SessionBadgeView` (`src/ui/sessions.tsx`) from `sessionBadge()` (`src/ui/sessionState.ts`),
which sets `live: true` only while a running session's terminal printed within `NEEDS_YOU_AFTER_MS`. The motion lives
in `src/ui/styles.css` under `@media (prefers-reduced-motion: no-preference)`: `session-pulse` on the dot and
`session-sweep` on the label, a gradient clipped to the text. `ChangeCard` (`src/ui/kanban.tsx`) renders the card and
delegates its footer to `SessionControls`, which picks the card's sessions with `cardSessionControls()` — empty when
sessions are disabled for the repository. The board re-renders on the session poll, so the badge's `live` flag already
flips without extra plumbing.

## Goals / Non-Goals

**Goals:**
- The card and the badge can never disagree about "working": both derive from the same `sessionBadge(...).live`.
- Reuse the existing keyframes and theme tokens; no new colours.

**Non-Goals:**
- No tint or motion for `may need you` (that state is `warning`, and already worded on the badge).
- No change to the Open work list or the Console tab beyond what they already show.
- No change to how liveness is decided — still only the time of the terminal's last output.

## Decisions

- **A pure predicate, `cardIsLive(config, sessions, card, now)`, in `sessionState.ts`.** It returns
  `cardSessionControls(config, sessions, card).shown.some((s) => sessionBadge(s, now).live)`. Keeping it next to
  `sessionBadge` makes it unit-testable without rendering and guarantees the card follows the badge, including the
  "sessions disabled" case. Alternative: let CSS detect a live badge with `.card:has(.badge.live)`. Rejected — it couples
  styling to the footer's markup and makes the behaviour untestable in `bun test`.
- **`ChangeCard` takes a `live` prop and adds a `live` class** (`<article class="card live">`). `RepoGroups`, which
  already uses hooks, reads `useSessionUi()` and passes `cardIsLive(...)` down. `ChangeCard` stays hook-free, as the
  card tests expand it without a renderer. Calling the hook inside the card broke those tests, and wrapping the card
  in a hook component would hide its content from them. The card stays an `<article>` with no new ARIA — the badge's
  words carry the status.
- **Tint:** a per-theme token `--card-live-bg` (dark `#243949`, light `#e5f8ff`), and `.card.live` takes it as background
  with `color-mix(in oklch, var(--info) 50%, var(--bg-raised))` as edge (`--info-border` was too faint to see on a
  board). The first idea, `color-mix(in oklch, var(--info) 7%, var(--bg-raised))`, also raises
  the card's lightness: in the dark theme the `success` and `danger` chips fell to 4.14:1. The chosen colours keep the
  card's oklch lightness and add chroma at the `info` hue (0.04 dark, 0.03 light; a first try at 0.02 was barely visible on the demo
  board); worst case is 4.56:1 (light, `success` chip),
  computed for every role chip and text token in both themes. Hover keeps the tint and adds only the usual brand edge
  and lift. A stronger hover tint would fail contrast, and so already does the plain card's hover background, which
  this change does not touch. The tint sits outside the reduced-motion query.
- **Name sweep:** inside the existing `prefers-reduced-motion: no-preference` and `@supports background-clip: text`
  blocks, `.card.live .name` gets the same gradient-clip technique as `.badge.info.live .text`, inverted: it rests in
  `--fg-heading` and a narrow `--info` band passes. In the dark theme the name is already near-white, so no band can be
  brighter. `--info` against the tinted background stays above 4.5:1 in both themes, which is the floor the spec sets.
  It reuses `session-sweep` and `--session-sweep`, so the badge and name share one rhythm. The name wraps
  (`word-break: break-word`), so the gradient is sized to the element box, which covers every line.

## Risks / Trade-offs

- [Hard-coded tint colours drift from a future theme change] → they sit next to the role tokens in each theme block,
  with a comment stating the contrast they were chosen for.
- [Many live cards at once make the board busy] → motion is limited to the name and badge, the tint is static, and
  reduced motion removes all motion.
- [The demo site's screenshots change] → expected; the demo shows live sessions, so the screenshots will show tinted
  cards. No demo code changes are needed.
