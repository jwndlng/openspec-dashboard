# Design

## Context

Labels are rendered by one component, `LabelChips` in `src/ui/labels.tsx`, on the overview row and tile, in the
repository board header and (as toggle chips) in the overview's label filter; the labels dialog
(`RepoLabelsDialog` → `RepoLabelsEditor`) renders its own chips. All of them are neutral today (`.label-chip` in
`src/ui/styles.css`). Per-repository label lists live on `RepoConfig` and are saved through
`POST /api/repos/<id>/labels`, which goes through `updateConfig`, the serialised, validated, atomic config write.

The board already colours repositories: `src/ui/repoGroups.ts` holds `REPO_HUES` (19 hues, each ≥ 12° from every status
role hue and the brand accent, guarded by `test/repoContrast.test.ts`) and an FNV-1a hash; CSS turns a `--repo-hue`
into `oklch(var(--repo-l) var(--repo-c) hue)` with per-theme lightness/chroma tokens. Label colouring reuses exactly
that machinery.

## Goals / Non-Goals

**Goals:**
- One colour per label name (ignoring case), identical in every view and on every machine.
- An override the user can set and clear, global per label name.
- Same contrast and hue-berth guarantees as repository colours, checked by the existing contrast test.

**Non-Goals:**
- Free-form colours (hex input). The palette is the 19 assignable hues; anything else would escape the contrast and
  status-berth guarantees.
- Guaranteeing distinct colours for distinct labels. With 19 hues and unbounded labels, collisions are accepted; the
  text is the primary cue and the user can recolour.
- Per-repository colours for the same label.
- Colouring anything other than repository labels (change cards, status badges).

## Decisions

### Hue palette moves to `src/shared/hues.ts`

`REPO_HUES`, `MIN_HUE_GAP` and `fnv1a` move from `src/ui/repoGroups.ts` into a new `src/shared/hues.ts`;
`repoGroups.ts` re-exports `REPO_HUES` and `MIN_HUE_GAP` so its callers and `test/repoContrast.test.ts` keep their
imports. `src/shared/labels.ts` imports from there. Alternative: duplicate the table in `labels.ts` — rejected, two
palettes would drift and the contrast test guards only one.

### Derived hue is a pure hash of the label key

`labelHue(label, labelColors)` in `src/shared/labels.ts`: if `labelColors[labelKey(label)]` exists, return the
assignable hue nearest to it (circular distance, ties to the lower hue); otherwise
`REPO_HUES[fnv1a(labelKey(label)) % REPO_HUES.length]`. Alternative: collision-avoiding assignment over the displayed
set, like `assignRepoHues` — rejected, a label's colour would then depend on which other labels exist, breaking "same
colour across machines and filters". `DisplayedLabel` gains a `hue: number`; `displayedLabels` takes the
`labelColors` map as a third argument so every caller gets coloured labels from the one function.

### Storage: top-level `labelColors` keyed by lower-case label

`Config.labelColors?: Record<string, number>`, optional with no default (like `labels`), so older configs round-trip
without the key. Zod: `z.record(labelSchema.refine(isLowerCase), z.number().int().min(0).max(359))` with a
`superRefine` capping it at 200 entries. Values are any whole degree rather than "one of `REPO_HUES`" so a future
palette retune never makes a saved config fail to load; the UI snaps to the nearest hue. Alternative: store a palette
index — rejected for the same reason (indices shift when the palette changes). Alternative: colours on each
`RepoConfig` — rejected, the point of a colour is that `client` looks the same everywhere.

### Endpoint `POST /api/labels/color`

A new handler beside `postRepoLabels` in `src/server/api.ts`, wrapped in `tracking(...)` like the per-repository
settings, using `updateConfig` so it is serialised with every other config write and validated by `configSchema`. It
trims and lower-cases the label, sets or deletes the entry, and drops the key when the map becomes empty. It does not
call the scan trigger (the enabled set cannot change). The route is under `/api/`, so `crossSiteRefusal` covers it.
Alternative: reuse `PUT /api/config` from the UI — rejected, a whole-config PUT from a dialog races with other writes,
which is what the per-setting endpoints exist to avoid.

### Rendering

`LabelChips` and the dialog chips set `style="--label-hue: <hue>"` and a `label-tint` class. New per-theme tokens
`--label-l`, `--label-c`, `--label-soft-l` (dark and light blocks of `styles.css`) give
`--label-color: oklch(var(--label-l) var(--label-c) var(--label-hue))` for text and border and a soft tinted background.
They start equal to the repo tokens and are tuned only if the contrast test asks for it, since label chips sit on
different grounds (rows, tiles, filter bar, dialog) than repo groups. Detected chips keep the dashed border and
`IconScan`. Active filter chips (`.label-chip.on`) keep the label tint but get the brand border and an `IconCheck`
before the text — the non-colour cue for "active".

### Colour picker in the labels dialog

Each chip in `RepoLabelsEditor` (custom and detected) gets a small swatch button before it ("Colour of `client`",
`aria-expanded`) — a sibling, since a detected chip is itself a button. Activating it expands one inline row under the
chips (`LabelColorPicker`, hook-free so tests can walk it): a group of toggle buttons, **Auto** plus the 19 swatches,
each with an accessible name (`Auto`, `Colour 1 of 19` …), the current choice `aria-pressed` with a check mark. Toggle
buttons rather than native radios, because arrowing through radios would save a colour on every key press. Choosing
calls `tracking.setLabelColor(repoId, label, hue)` → `api.setLabelColor` → `POST /api/labels/color` and closes the
picker; busy and error states reuse the dialog's existing "Saving…" line and error notice, keyed by the dialog's
repository. One picker open at a time; activating the swatch again closes it, and Escape closes the whole dialog as
before (the modal owns Escape in the capture phase; giving the picker its own Escape would mean changing `modal.tsx`
for little gain). Alternative: a floating popover — rejected, the dialog is already a modal and an inline row needs no
positioning code or focus trap of its own.

The overview and board pass `config.labelColors` to `displayedLabels`; the filter's label options take the hue of the
same name.

### Demo API

`src/ui/demo/demoApi.ts` implements `setLabelColor` against its in-memory config with the same validation, so the demo
site behaves like the real server.

## Risks / Trade-offs

- [Two labels share a colour] → Accepted (19 hues); text stays primary, and the user can recolour one.
- [Label tint on a tinted repo-group header could clash] → The board header sits outside the group tint; the contrast
  test checks label text on the header and filter backgrounds explicitly.
- [Coloured chips next to coloured status badges add visual noise] → Label chips stay pill-shaped and smaller than
  badges, use the soft tint, and never use a status hue.
- [Moving the hue table could change repository colours] → Pure move; `test/repoGroups.test.ts` keeps asserting the
  existing assignment.

## Migration Plan

None. `labelColors` is optional; existing configs load and save unchanged, and every label simply gains its derived
colour. Rolling back to an older binary that does not know the key: the config schema strips unknown keys on parse,
so an older version drops `labelColors` on its next save — the user loses only their colour choices.
