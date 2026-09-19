## Context

The combined board (`src/ui/kanban.tsx`) flattens every repository's changes into one `Card[]`, filters it, and hands each column the cards whose `column` matches. Inside a column the cards keep snapshot order (repository by repository as scanned, but nothing marks the boundaries), and every card looks identical apart from a small grey uppercase repository label. With 17+ tracked repositories and 40+ open cards, the relationship "these cards are the same project" is not visible.

Constraints that shape the design:

- The UI is a dependency-free Preact SPA; styles live in one `styles.css` whose rule is "components must use tokens, never literal colours". There are two themes (dark default, light via `:root[data-theme="light"]`).
- Badges follow "always text + colour, never colour alone".
- Snapshot and config are server-owned; this feature is purely presentational and should not need either to change.
- `add-project-overview` is in flight: it modifies the "Cards show repository…" requirement and adds a single-repository board that reuses `Kanban`. This change must not produce a conflicting delta and must behave sensibly in that mode.

## Goals / Non-Goals

**Goals:**

- Cards of the same repository sit together in every column, under a visible group header.
- Each tracked repository has its own colour that is stable across reloads, scans and filter changes, and legible in both themes.
- The colour appears consistently wherever the repository is named on the board (group header, card, filter chip), so the chips act as a legend.
- Logic is pure and unit-testable without a DOM.

**Non-Goals:**

- User-chosen colours or any persisted colour setting (would need a config schema change and Settings UI; can be layered on later by letting a configured hue override the computed one).
- A toggle to turn grouping off, collapsing groups, or drag-and-drop.
- Swimlanes (one horizontal lane per repository across all columns). Considered below and rejected for now.
- Colouring the Settings page or the in-flight Projects overview. The helper is exported so they can adopt it later.
- Changing sort order *within* a repository's cards.

## Decisions

### D1. Group inside each column, not swimlanes

Each column renders a list of repository groups; each group is a header (`repo name · count`) followed by that repository's cards.

*Alternative — swimlanes* (a row per repository spanning all columns): gives the strongest "belongs together" signal, but with 17+ repositories most lane × column cells are empty, the board becomes several screens tall, and the column counts/scrolling model (`.cards { overflow-y: auto }` per column) has to be rebuilt. In-column grouping keeps the board's shape and density and is a small change to `Column`.

*Alternative — sort only, no header*: cheaper, but boundaries between repositories stay invisible without reading every label.

### D2. Group order is by repository name, identical in every column

Groups are ordered by repository name (case-insensitive, `localeCompare`, id as tiebreak). Because the order is global rather than per-column, a repository is always above/below the same neighbours, so the eye can track it across columns. Within a group, cards keep the order they arrive in (snapshot order; archive date descending in `Archived`).

*Alternative — order groups by most recent activity*: surfaces hot repositories but makes the order differ per column and shift between scans, which defeats the "find it in the same place" goal.

### D3. Archived: bound first, then group

`ArchivedColumn` keeps its contract (25 most recently archived across all repositories, header shows the total). The 25 are selected first, by date, and *then* grouped. Grouping first and bounding after would let one busy repository push others out or require per-group limits, changing the existing requirement.

### D4. A repository contributes a hue; the theme supplies lightness and chroma

`assignRepoHues(ids)` returns `Map<repoId, hue>` (0–359). Components set it as an inline custom property, `style={{ "--repo-hue": hue }}`, on the group, card and chip. CSS derives the actual colours:

```css
:root                      { --repo-l: 0.78; --repo-c: 0.11; --repo-soft-l: 0.30; }
:root[data-theme="light"]  { --repo-l: 0.48; --repo-c: 0.12; --repo-soft-l: 0.90; }
.repo-tint { --repo-color: oklch(var(--repo-l) var(--repo-c) var(--repo-hue));
             --repo-soft:  oklch(var(--repo-soft-l) 0.05 var(--repo-hue)); }
```

This keeps the "no literal colours in components" rule (the hue is data, like a progress width), makes colours switch with the theme for free, and OKLCH gives every hue the same perceived lightness, so contrast against `--bg-raised` is uniform — with HSL, yellow and blue at the same `L` differ wildly in contrast. OKLCH is supported by every current browser engine, and this is a local tool run in the user's own browser.

*Alternative — a hand-picked palette of hex colours per theme*: best-looking for ≤10 repositories, but needs two parallel lists kept in sync and runs out quickly at 17+.

### D5. Hue assignment: hash to a slot, probe on collision

- 24 slots, 15° apart (`hue = slot * 15`). Closer than ~15° is not distinguishable in small accents; 24 covers the current repository count with headroom.
- Process repository ids in sorted order. Preferred slot = FNV-1a hash of the id, mod 24. If taken, probe with stride 7 (coprime with 24, so every slot is reachable and a displaced repository lands ~105° away from the one it collided with rather than next to it). When all 24 slots are taken, further repositories reuse their preferred slot.
- Input is **all repositories in the snapshot**, not the filtered set, so toggling filters never changes a colour.

Properties: deterministic (same set → same colours, on any machine, since ids are path hashes); distinct for up to 24 repositories; mostly stable when the set changes — a repository's colour moves only if a newly tracked/untracked repository that sorts before it collides with its slot.

*Alternative — index in sorted order × golden angle*: always distinct, but adding one repository shifts the colour of every repository after it. *Alternative — pure hash, no probing*: perfectly stable, but with 17 repositories in 24 slots collisions are near-certain (birthday problem), violating "its own colour".

### D6. Where the colour is applied

| Element | Treatment |
| --- | --- |
| Group header | small square swatch (`--repo-color`) + repository name in `--repo-color` + count in `--fg-subtle` |
| Card | 3px left border in `--repo-color`; the existing repository label text in `--repo-color` |
| Filter chip | swatch before the name; when `on`, border/background use `--repo-color` / `--repo-soft` instead of brand teal |

The card keeps its repository label (the existing requirement demands it and the label row hosts the copy button); the mild redundancy with the group header is accepted. The name always accompanies the colour, so colour is never the sole cue. Error state on chips (`.chip.error`) keeps precedence over the repository colour.

### D7. Code layout

- `src/ui/repoGroups.ts` (new, pure): `assignRepoHues(ids: string[]): Map<string, number>` and `groupByRepo<T extends { repoId: string; repoName: string }>(cards: T[]): { repoId; repoName; cards: T[] }[]`.
- `kanban.tsx`: compute `hues` once with `useMemo` from `snapshot.repos`; add `hue` to `Card`; a `RepoGroups` component shared by `Column` and `ArchivedColumn` replaces the flat `cards.map`. Column counts stay the total number of cards.
- Single-repository board (from `add-project-overview`, whichever lands second wires this): when the board is fixed to one repository, `RepoGroups` renders the cards without a group header; the accent stripe remains.

## Risks / Trade-offs

- [Neighbouring hues (15° apart) can look similar, especially for colour-blind users] → colour is an aid, not an identifier: the repository name is always present on header, card and chip; stride-7 probing keeps collision-displaced repositories far apart; groups provide spatial separation independent of colour.
- [A repository's colour can change when another repository is added or removed] → only on slot collision with an earlier-sorting id; accepted in exchange for guaranteed distinctness. A persisted per-repository hue is the future escape hatch (non-goal now).
- [Group headers add vertical space: up to one 20px row per repository per column] → header is a single compact line, no extra padding around groups beyond the existing 6px card gap; columns already scroll independently.
- [Repository hue near danger/warning/success hues could be misread as a status] → the accent is a thin stripe and label text, not a filled badge; status badges keep their shape, icon and text. Repository colours use lower chroma (0.11–0.12) than the status tokens.
- [OKLCH contrast assumptions] → verify during implementation that `--repo-color` text meets 4.5:1 on `--bg-raised` and `--bg-section` in both themes at the extremes (yellow ≈ 105°, blue ≈ 265°); adjust `--repo-l` if not.
- [Overlap with `add-project-overview` edits to `kanban.tsx`] → no spec conflict (ADDED-only delta); code merge is small because grouping is isolated in `RepoGroups` and `repoGroups.ts`.
