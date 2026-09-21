# Design

## Context

See proposal.md — Why. What matters for the approach:

- Badges are one component (`.badge` in `src/ui/styles.css`) with four modifier classes today: `brand`, `ok`, `warn`,
  `danger`, plus the unmodified neutral. Their colours come from theme tokens defined twice, in `:root` and
  `:root[data-theme="light"]`.
- The tone a session or work badge gets is decided in `src/ui/sessionState.ts` (`SessionBadge.tone`, a string union
  that is rendered straight into the class list). Card badges pick their class inline in `src/ui/kanban.tsx`.
- Repository colours are a *hue only*: `assignRepoHues` (`src/ui/repoGroups.ts`) maps a repository id to a hue on a
  24-slot wheel, and CSS builds `oklch(var(--repo-l) var(--repo-c) <hue>)` from it. So the collision with status
  colours is a collision in hue, and it can be fixed by controlling which hues the wheel may hand out.
- `test/repoContrast.test.ts` already parses `styles.css`, reads tokens and does OKLab/OKLCH maths. The new invariants
  can be asserted against the real token values in the same file rather than against copies.
- Invariant 4 of CLAUDE.md: everything is one self-contained HTML file. No colour library; the maths stays in the test.

## Goals / Non-Goals

**Goals**

- One hue per meaning, fixed in tokens, so a glance at a card's colours is informative.
- Status hues, the brand accent and the repository hues occupy disjoint parts of the hue circle, provably.
- The contrast floor (4.5:1) is checked by a test against the tokens, not asserted in prose.

**Non-Goals**

- No change to which labels exist, what they say, when they appear, or their layout — this is a repaint.
- No user-configurable palette, and no per-repository colour override.
- Not touching the terminal's own ANSI palette in the session panel; that is the agent's output, relayed byte for byte.
- No new `tone` for things that are currently neutral beyond moving `prompt` there.

## Decisions

### D1 — Six semantic roles, two tokens each

Roles: `info`, `branch`, `success`, `warning`, `danger`, `neutral`. Each gets `--<role>` (text) and
`--<role>-border` in both theme blocks, and a `.badge.<role>` rule that sets those two. `--success`, `--warning`,
`--danger` and their `-border` counterparts already exist and keep their names, so the addition is `info` and
`branch`.

Every role keeps the badge's own ground, `--bg-section`, rather than a per-role tint. That is how `ok`, `warn` and
`danger` already behave — only `brand` tinted its background — and it means one contrast check covers every role
instead of one per role-and-ground pair. The dead `--warning-strong` token (unused, and an orange that would sit on
top of the new `branch` hue) is removed.

`brand` stops being a badge class. `.badge.brand` is removed rather than aliased, so a stale usage fails visibly in
review instead of silently painting a status in the accent colour.

*Alternative considered:* keep `brand` as the blue role by re-tinting the brand token. Rejected — brand is also the
focus ring, the primary button and the progress fill, and those should not turn blue.

### D2 — The chosen values

Picked for a ≥ 4.5:1 ratio against `--bg-section` (the badge ground) and `--bg-raised` (the card) in their theme, and
for hues far enough apart to read as different colours. Measured ratios against `--bg-section`:

| role      | dark      | hue  | ratio | light     | hue  | ratio |
|-----------|-----------|------|-------|-----------|------|-------|
| `danger`  | `#ff2d6b` | 11°  | 5.04  | `#c81e4a` | 14°  | 4.95  |
| `branch`  | `#ff9d4d` | 57°  | 8.80  | `#9a4b00` | 53°  | 5.48  |
| `warning` | `#fbbf24` | 84°  | 10.87 | `#7a6200` | 92°  | 5.18  |
| `success` | `#10b981` | 163° | 7.15  | `#047857` | 166° | 4.83  |
| brand     | `#9ddcdb` | 195° | 11.83 | `#0f5f5d` | 192° | 6.58  |
| `info`    | `#6ba6ff` | 258° | 7.36  | `#1d4ed8` | 264° | 5.91  |

Only two values change: `info` and `branch` are new, and the light `--warning` moves from `#a84d08` (49°, a burnt
orange) to `#7a6200` (92°, amber). That move is forced: at 49° the light warning was four degrees from the new branch
orange, which would have made "no tasks" and "3 uncommitted" the same colour in the light theme. The dark warning
(84°) already was amber and does not move.

### D3 — Label → role mapping

| label                                         | before  | after     |
|-----------------------------------------------|---------|-----------|
| running, quiet                                 | brand, warn | `info` |
| branch badge (card, detail, repo header)       | brand   | `branch`  |
| uncommitted, unpushed, pushed                  | warn / brand | `branch` |
| complete, merged                               | ok / neutral | `success` |
| no tasks, pending archive                      | warn    | `warning` |
| failed, ended with an error, scan warning, stale open work | danger | `danger` |
| activity age, prompt                           | neutral / brand | `neutral` |

Two notes. `quiet` moves from `warn` to `info`: it is still a running session, and the text already says `quiet 3m` —
its distinction from `running` is the motion (which it does not get) and the words, not the hue. And `merged` moves
from neutral to `success`: it is the one work state that is finished.

`stale` stays an override on top of the work state, exactly as today: a stale `uncommitted` or `unpushed` badge
is `danger` rather than `branch`, and a stale `pushed` badge is `warning` — a pushed branch may simply be waiting for
review.

### D4 — A fixed hue list instead of an arithmetic wheel

`assignRepoHues` keeps its shape — hash the id, take a slot, probe with a stride coprime to the slot count, sorted ids
for determinism — but the slot index now indexes a constant `REPO_HUES` array rather than being multiplied by 15.

The array holds 19 hues, each at least 12° from every hue in D2 (including brand) and at least 12° from its
neighbours:

```
 27  39  70 105 117 129 141 178 207 219 231 243 277 289 301 313 325 337 349
```

They fall in the arcs the status roles leave free: 27–41°, 70–72°, 105–150°, 178–180°, 207–246° and 277–359°.
Nineteen is the maximum, not a round number chosen for comfort: those arcs total 190° of the circle and a
twentieth hue has nowhere to sit that keeps 12° from its neighbours.

*Why a list and not arithmetic:* the reserved bands are six irregular arcs, so any closed-form skip would be harder to
read and harder to check than the list it produces. The list is a constant a reviewer can scan, and the test recomputes
the ≥ 12° property from the CSS tokens rather than trusting it.

*Cost:* 24 distinct repository colours become 19. The existing "17 repositories" scenario still passes; beyond 19 the
wheel repeats, exactly as it did beyond 24, and the repository name is always shown next to its colour.

*Alternative considered:* keep all 24 hues and separate status from repository by form instead (filled chip vs. text +
swatch). Rejected with the user: a hue that means two things is the problem being fixed.

### D5 — The invariants live in tests, not in comments

Extend `test/repoContrast.test.ts` (it already has the OKLab maths and reads `styles.css`):

1. For each role and each theme: contrast of `--<role>` against `--bg-section` and `--bg-raised` is ≥ 4.5:1.
2. For each hue in `REPO_HUES` and each role hue (plus brand) in each theme: the hue distance is ≥ 12°.
3. Neighbouring entries of `REPO_HUES` are ≥ 12° apart (around the circle) and the array has no duplicates.

The existing repository-on-panel contrast test keeps running unchanged over the new hue list.

## Risks / Trade-offs

- **Fewer repository colours (24 → 19).** → Only matters above 19 tracked repositories, where hues were already
  indistinguishable; the name is always shown with the colour.
- **Every repository changes colour.** The hue list is not the old wheel, so a user's repositories will look different
  after the update. → Nothing is stored or shared, colours are derived; the change is cosmetic and one-time.
- **`quiet` is no longer amber.** A user who reads "amber = look at me" loses that cue. → The word `quiet <duration>`
  carries it, the spec already forbids colour-only status, and amber now means only "warning".
- **Light `--warning` changes hue.** → It is used by badges and `.card .warn-text`; both are covered by the contrast
  test, and the value was chosen above the 4.5:1 floor (5.18 vs. 4.34 for the alternative yellow).
- **Blue on a dark ground next to a blue-ish repository hue.** The nearest assignable hues to `info` (258°/264°) are 243°
  and 277°. → 13° and 15° of separation at different lightness and in a different form (badge vs. text and 3px card
  edge); the badge also always carries its word.

## Migration Plan

None. No stored data, no API and no configuration carries a colour; the palette is compiled into the single HTML file.
Rolling back is reverting the commit.
