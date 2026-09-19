## 1. Pure helpers

- [x] 1.1 Create `src/ui/repoGroups.ts` with `assignRepoHues(ids: string[]): Map<string, number>`: sort ids, FNV-1a hash mod 24 as preferred slot, probe with stride 7 on collision, reuse the preferred slot once all 24 are taken, hue = slot × 15 (design D5)
- [x] 1.2 Add `groupByRepo(cards)` to `src/ui/repoGroups.ts`: returns `{ repoId, repoName, cards }[]` ordered by repository name (case-insensitive `localeCompare`, id as tiebreak), preserving input order within each group, no empty groups (design D2)
- [x] 1.3 Add `test/repoGroups.test.ts` for hue assignment: deterministic regardless of input order, 17 and 24 ids all distinct, 25+ ids still return a hue for every id, every hue is a multiple of 15 in 0–345, a repository's hue is unchanged when computed over the same set (filter independence is by construction — assert the helper is called with all snapshot repos in 3.1)
- [x] 1.4 Add grouping tests to `test/repoGroups.test.ts`: interleaved input `a1, b1, a2` → `alpha[a1, a2]`, `beta[b1]`; `Alpha` sorts before `zeta`; same-name repositories with different ids stay separate groups; empty input → `[]`

## 2. Styles

- [x] 2.1 In `src/ui/styles.css` add theme tokens `--repo-l`, `--repo-c`, `--repo-soft-l` to `:root` and `:root[data-theme="light"]`, and a `.repo-tint` rule deriving `--repo-color` and `--repo-soft` from `--repo-hue` with `oklch()` (design D4)
- [x] 2.2 Add `.repo-group` and `.repo-group-head` styles: single compact line with a square swatch, repository name in `--repo-color`, count in `--fg-subtle` mono; groups stack with the existing 6px gap; keep `.cards:empty::after` placeholder working for empty columns
- [x] 2.3 Add the card accent: 3px left border in `--repo-color` on `.card.repo-tint` and `--repo-color` for `.card .repo` label text, keeping the hover border behaviour
- [x] 2.4 Style repository filter chips: swatch before the name; `.chip.repo-tint.on` uses `--repo-color` / `--repo-soft`; ensure `.chip.error` still wins over the repository colour

## 3. Board wiring

- [x] 3.1 In `src/ui/kanban.tsx` compute `hues` once via `useMemo(() => assignRepoHues(repos.map(r => r.id)), [repos])` from all snapshot repositories (not the filtered set) and add `hue` to the `Card` type when flattening
- [x] 3.2 Add a `RepoGroups` component that takes a column's cards, calls `groupByRepo`, and renders each group (header + `ChangeCard`s) with `class="repo-tint"` and `style={{ "--repo-hue": hue }}`; keep keys `${repoId}/${name}` on cards and `repoId` on groups
- [x] 3.3 Use `RepoGroups` in `Column`; the column count stays `cards.length`
- [x] 3.4 Use `RepoGroups` in `ArchivedColumn` after the existing sort-by-date and `ARCHIVED_LIMIT` slice, so the bound and the `N of M` count are unchanged (design D3)
- [x] 3.5 Apply `repo-tint` and the hue to `ChangeCard` (accent + label) and to the repository filter chips (swatch), leaving the chip's `error` class and title behaviour intact
- [x] 3.6 If the single-repository board from `add-project-overview` has already landed, render `RepoGroups` without group headers in that mode; otherwise leave a short comment at `RepoGroups` noting the expected behaviour (design D7)

## 4. Verification

- [x] 4.1 Run `bun run check` (lint, typecheck, tests) and fix any failures
- [x] 4.2 Run the app against the real tracked repositories and check in both themes: groups are in the same order in every column, no empty group headers, colours are distinct and identical on header/card/chip, colours do not change when toggling repo filters, search and stale filters, expanded `Archived` shows 25 grouped cards with the total count
- [x] 4.3 Check contrast of `--repo-color` text against `--bg-raised` and `--bg-section` at hues 105 (yellow) and 270 (blue) in dark and light themes; adjust `--repo-l` until both reach ≥ 4.5:1
- [x] 4.4 Verify a repository in error still shows the danger-styled chip
- [x] 4.5 Add a line to `README.md` describing repository grouping and automatic per-repository colours
- [x] 4.6 Run `openspec validate group-changes-by-repo --strict` and fix any findings
