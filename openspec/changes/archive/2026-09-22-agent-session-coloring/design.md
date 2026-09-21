# Design

## Context

See proposal.md — Why. What shapes the approach:

- Repository colour is already a solved problem in the UI: `assignRepoHues` (`src/ui/repoGroups.ts`) turns the ids of
  **all** repositories of a snapshot into hues, and the `.repo-tint` class in `styles.css` turns a `--repo-hue` into
  `--repo-color`, `--repo-soft` and the group-panel tints. The board and the activity feed both do exactly this.
- The tab strip lives in `SessionTabs` (`src/ui/sessionPanel.tsx`). Its session context (`useSessionUi`) already carries
  the snapshot the board renders — `enabledOnly(snapshot, config)` in `app.tsx` — so the hue input set is identical
  without touching the provider or the API.
- The tab's border box is already spoken for: `.session-tab` has a 1px transparent border with `border-bottom: 0`,
  `.session-tab.shown` sets `border-color` (shorthand) and a `--bg-section` background, `.session-tab.active` sets
  `border-top-color: var(--brand)`. Those three are the "has a pane" and "is focused" cues that the spec requires to
  stay readable, so the repository colour has to arrive without fighting them.

## Goals / Non-Goals

**Goals:**

- The tint is derived, never stored: no session field, no API change, no new state in the provider.
- A tab's colour is the same colour object the board uses, by construction (same function, same input set), not by a
  second implementation that could drift.
- Tab geometry is unchanged whether a tab is tinted or not, so a strip mixing tinted and untinted tabs stays aligned.

**Non-Goals:**

- Colouring the session **panes** (their headers, borders or terminals). The panes have their own focus accent; taking
  that on as well is a separate judgement about the dock's look.
- Refactoring the existing `repoHue` helpers duplicated in `kanban.tsx` and `activity.tsx`.
- Any change to how hues are assigned, to their number (24) or to the `--repo-*` tokens.

## Decisions

### D1 — The accent is an inset bar, not a border

`.session-tab.repo-tint` gets `box-shadow: inset 3px 0 0 var(--repo-color)` (plus a little left padding), giving the
same 3px leading accent a card has (`.card.repo-tint { border-left: 3px solid var(--repo-color) }`).

*Alternatives:* `border-left: 3px solid var(--repo-color)` is the literal analogue, but `.session-tab.shown` sets the
`border-color` **shorthand** at equal specificity, so the tint would depend on rule order, and going from a 1px to a 3px
left border shifts a tinted tab's content by 2px against its untinted neighbours. Fixing that by declaring
`border-left: 3px solid transparent` on every tab forces `.shown`/`.active` to stop using the shorthand — three rules
changed to paint one bar. A tinted **background** was rejected because the background is exactly what says "this
session has a pane"; a `.swatch` square (as on the filter chips) was rejected because the strip is horizontally cramped
and a swatch reads as a filter control.

### D2 — The repository name carries the colour, the change name does not

`.session-tab.repo-tint .repo-name { color: var(--repo-color) }`, mirroring `.card.repo-tint .repo`. The change name
stays in the monospace body colour: it is the tab's identity, the repository is its grouping. The name also keeps the
colour honest — the spec's "never colour alone" rule is satisfied by the very element that is tinted.

The repository name currently uses the shared `.hint` class; it gains a `repo-name` class so the tint can address it
without touching every other `.hint`.

### D3 — Hue source: the snapshot in the session context, via a small pure helper

`SessionTabs` memoises `assignRepoHues((ui.snapshot?.repos ?? []).map((r) => r.id))` — the same expression the board and
the activity feed use — and asks a new helper in `repoGroups.ts`:

```ts
/** Tint props for an element that stands for a repository; nothing tinted when the repository has no hue. */
export function repoTint(hues: Map<string, number>, repoId: string): { class: string; style?: Record<string, string> };
```

It returns `{ class: "repo-tint", style: { "--repo-hue": "…" } }` for a known repository and `{ class: "" }` otherwise,
which is what gives the spec's "session of an untracked repository" scenario its behaviour for free: a repository that
is switched off, excluded or failed out of the snapshot simply has no hue. The helper is pure, so the untracked case
and the "same hue as the board" property are unit-testable without a DOM — `SessionTabs` itself uses hooks and cannot
be expanded by `test/vnode.ts`.

*Alternative:* read the hue from `ui.config.repos` instead of the snapshot. Rejected: the board tints from the snapshot,
and the two lists differ exactly while a repository is disabled or failing — the case where the colours must not drift.

### D4 — Contrast is proven by extending the existing check

`test/repoContrast.test.ts` already reads the tokens out of `styles.css` and checks all 24 hues against the tinted group
panel in both themes. It gains the two backgrounds a tab's repository-coloured text sits on: `--bg-base` (the strip) and
`--bg-section` (a shown tab). This keeps the spec's 4.5:1 rule a test, not a claim, and it will still hold if `--repo-l`
or `--repo-c` is tuned later.

## Risks / Trade-offs

- **A hue fails 4.5:1 on `--bg-base` or `--bg-section` in one theme** → the new contrast test says so before anything
  ships. The fallback, in order: raise `--repo-l` for that theme (it is already tuned against a very similar
  background, so a failure is unlikely to be large), or keep the accent bar and leave the repository name grey — D1
  alone already satisfies the request, and the name stays as a text cue either way.
- **Several tabs of the same repository look alike** → they always did; the change name distinguishes them, and the
  colour is about telling *projects* apart, which is what the strip could not do at all before.
- **The accent competes with the shown/focused marks** → the marks stay brand-coloured and shape-based (`▣`/`▢`, the
  top border, the `--bg-section` background). The repository colour is on the leading edge and on the repository name
  only, and the spec now states the marks must remain distinguishable; a scenario covers it.
- **One more `styles.css` edit while `settings-nav-follows-content` is in flight** → disjoint selectors
  (`.session-tab*` vs `.settings*`); a merge conflict would be textual at worst.
