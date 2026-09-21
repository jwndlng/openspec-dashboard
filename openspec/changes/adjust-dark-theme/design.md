# Design

## Context

See `proposal.md` — Why. The dark theme is the default `:root` token block in `src/ui/styles.css`; the light theme
overrides the same token names under `:root[data-theme="light"]`. Components reference tokens only, so the whole dark
look is about a dozen values in one block. `test/repoContrast.test.ts` parses those values out of the stylesheet and
guards the 4.5:1 rule for repository-coloured text on the tinted group panel, so it re-checks the new numbers with no
edit. The precedent for a palette move is the archived `neutral-grey-dark-theme` change, which kept OKLCH lightness and
dropped chroma; this change is its mirror image — keep chroma and hue, move lightness.

Two contrast floors constrain the lift. `--fg-subtle` sits at 4.61:1 on `--bg-raised` today and `--danger` at 4.75:1;
both are the smallest margins in the set, so any lift of the backgrounds pushes them under the spec's 4.5:1 rule.

## Goals / Non-Goals

**Goals:**
- A softer dark ground, with the same five-step elevation hierarchy and the same near-neutral cool tint.
- Every text and status colour that the spec's 4.5:1 rule covers still clears it, verified by arithmetic rather than by eye.
- Accent and status tints stay lighter than the surfaces they sit on.

**Non-Goals:**
- Any selector, layout, typography, radius or spacing change.
- Any change to the light theme, the repository colour tokens, or theme selection, persistence and pre-paint application.
- A new contrast test harness; the existing suite plus a one-off verification script is enough.

## Decisions

**Lift OKLCH lightness by 0.04, keep chroma and hue.** Each background token keeps its chroma and hue and gains 0.04
lightness. The elevation steps therefore keep their spacing by construction, and the ramp keeps the near-neutral cool
tint the `kanban-board` spec requires. Picking five new values by eye was rejected for the same reason the archived
change rejected it: it silently shifts the hierarchy. 0.04 was chosen over 0.03 (barely visible) and 0.05 (the top of
the ramp starts to read as mid-grey, and `--danger` would need a lift large enough to shift its hue perceptibly).

| Token | Old | New |
| --- | --- | --- |
| `--bg-base` | `#0b0d10` | `#141619` |
| `--bg-section` | `#141618` | `#1d1f21` |
| `--bg-raised` | `#1a1c1f` | `#232529` |
| `--bg-surface` | `#25272a` | `#2f3134` |
| `--bg-elevated` | `#313437` | `#3b3e41` |
| `--fg-body` | `#a0a3a8` | `#a7aaaf` |
| `--fg-subtle` | `#82858a` | `#888c91` |
| `--fg-disabled` | `#474a4e` | `#525559` |
| `--danger` | `#ff2d6b` | `#ff3d75` |
| `--brand-soft` | `#164040` | `#224b4b` |
| `--brand-softer` | `#0c2424` | `#162e2e` |
| `--success-border` | `#004f3b` | `#135a46` |
| `--warning-border` | `#7c2d12` | `#89391f` |
| `--danger-border` | `#6b0028` | `#781332` |
| `--danger-bg` | `#3d001522` | `#490b1e22` |
| `--border-subtle` | `#25272a` | `#2f3134` |

**Text tokens are solved against the floor, not lifted blindly.** `--fg-subtle` is set to the darkest value at its own
chroma and hue that reaches 4.5:1 on the *new* `--bg-raised` — the lightest background subtle text is rendered on —
which lands at 4.54:1. `--fg-body` then moves up by the same lightness step so the body/subtle distinction stays as
visible as it is today (6.59:1 on cards). `--fg-heading` is untouched: at 14.04:1 on cards it has margin to spare, and
holding it fixed keeps the heading/body contrast from flattening. `--fg-disabled` takes the plain +0.04 lift; it marks
inactive controls and placeholders, which WCAG exempts from the minimum, and raising it to 4.5:1 would make it
indistinguishable from subtle text — the same reasoning the archived change recorded.

**`--danger` is the only status colour that needs to move.** On the new `--bg-raised` the other four clear the floor
comfortably (`--success` 6.05, `--warning` 9.19, `--warning-strong` 6.64, `--brand` 7.80); `--danger` lands at 4.27. It
is raised to the minimum lightness at its own chroma and hue that reaches 4.5:1 (4.51:1), which is a small enough move
to stay the same pink. Lowering the background of danger surfaces instead was rejected: it would reintroduce the
near-black the change exists to remove.

**Chip and border tints take the same +0.04.** `--brand-softer` sits at lightness 0.241 today, which is *below* the new
`--bg-section` at 0.239 plus rounding — a brand chip on a column would read as a hole rather than a tint. Lifting these
five tokens with the ramp preserves the relationship they have today. Their text pairings stay well clear of the floor
(`--brand-fg` on `--brand-softer` 9.35:1, on `--brand-soft` 6.29:1). The three `*-border` tokens are used only as border
colours, never behind text, so the 4.5:1 rule does not apply to them; they move to keep their visual weight, not for contrast.

**Translucent borders and the scrim stay as they are.** `--border`, `--border-light` and `--border-strong` are grey at
alpha, so they composite over whatever ground is behind them and track the lift automatically. Their contrast against
`--bg-section` shifts by about 6% relative (2.42:1 → 2.28:1 for `--border`), which is imperceptible on a hairline.
Re-tuning three alpha values to chase that would be churn.

**Repository colour tokens stay.** `--repo-l`, `--repo-c`, `--repo-soft-l` and the two group mixes are unchanged. The
worst of the 24 hues that `test/repoContrast.test.ts` walks lands at 6.64:1 on the tinted panel, far above the 4.5:1
floor, and the panel still differs from the plain column background.

**The `sessionPanel.tsx` literals are fallbacks, not a second source of truth.** `terminalTheme` reads the computed
tokens and only falls back to a literal when the property is empty. The two stale literals are updated so the fallback
matches the tokens, but nothing depends on them at runtime.

## Risks / Trade-offs

- [`--fg-subtle` lands at 4.54:1, a thin margin above the floor] → It is solved against the lightest background subtle
  text actually sits on, and `test/repoContrast.test.ts` already reads tokens from the stylesheet; a verification script
  run during implementation checks every text/background pair rather than only the repo panel.
- [Elevation may read as flatter, since a 0.04-lightness step is a smaller *relative* difference on a lighter ground] →
  The absolute OKLCH steps are unchanged, so each surface is as distinguishable as before; check the dock, modals and the
  session panel visually against the board.
- [Other in-flight changes edit `src/ui/styles.css`] → This change touches only values inside the dark `:root` block; no
  selector lines move, so a conflict is line-local.
- [The `kanban-board` scenario capping channel spread at 6 of 255 could be violated by rounding] → Checked: the widest
  spread in the new ramp is exactly 6 (`#232529`, `#3b3e41`), so the scenario still holds; re-check if the values are
  retuned.
- [A user on the old theme sees the change without warning] → It is a visual preference change with no stored state; the
  theme preference and its persistence are untouched, so there is nothing to migrate or roll back beyond reverting the values.
