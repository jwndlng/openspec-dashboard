# Design

## Context

See `proposal.md` for why. The relevant current state:

- A tracked repository is a `RepoConfig` entry (`id`, `path`, `name`, `enabled`, `agent?`) in
  `~/.openspec-dashboard/config.json`, validated by the zod `repoSchema` in `src/server/config.ts` and edited as a draft
  in Settings → Tracked repositories (`src/ui/settings.tsx`), persisted through `PUT /api/config`, which already
  serialises writes (`updateConfig`) and triggers a scan only when the set of enabled repositories changed.
- `scanRepo` (`src/server/scanner.ts`) builds a `RepoSnapshot` per repository through a `RepoSource`; the local source
  already lists directories with `readdir`. The snapshot is cached (`src/server/cache.ts`) and served at `/api/state`.
- The overview (`src/ui/overview.tsx`, state and URL handling in `src/ui/overviewState.ts`) receives both the
  snapshot and the config. Its filters (`q`, `wip`) are pure functions over rows with a URL round-trip, tested without
  a renderer.
- Invariant 1 allows scanning to read a tracked repository but never to write to it; invariant 7 forbids real
  repository content in fixtures.

## Goals / Non-Goals

**Goals:**
- Detection that is cheap enough to run on every scan of every repository, and provably read-only.
- One function that decides which labels a repository displays, used by rows, tiles, the board header and the filter,
  so they can never disagree.

**Non-Goals:**
- Caching detection across scans or watching the file system; the scan's cadence is the detection's cadence.
- A separate labels endpoint; labels travel with the config and the snapshot that the UI already loads.

## Decisions

### Custom labels live in `config.json`, not in the repository

`RepoConfig.labels?: string[]` and `RepoConfig.hiddenLabels?: string[]`, both optional. Labels are a personal way of
grouping projects, and writing them into `openspec/config.yaml` would add an eighth write path to invariant 1 for no
benefit. Alternative considered: a separate `labels.json` keyed by repository id — rejected, because forgetting a
repository in Settings already removes its entry and therefore its labels, and a second file would need its own
cleanup and its own write serialisation.

Validation in `repoSchema`: each label `z.string().trim().min(1).max(32)`, no control characters, no comma (commas
would make the filter's display and any future comma-separated form ambiguous), at most 20 per list, a `superRefine`
for case-insensitive uniqueness whose message names the repository and the label. Optional with no default, so
`validateConfig` of an older file produces no new keys and the next save writes none (spec: "Older configuration").
Settings removes the key rather than writing `[]` when the last label is removed.

### The rule table is data in `src/shared/labels.ts`

```ts
interface LabelRule { label: string; marker: string; match: (name: string, kind: "file" | "dir") => boolean }
export const LABEL_RULES: readonly LabelRule[];
export function detectLabels(entries: { name: string; kind: "file" | "dir" }[]): { label: string; marker: string }[];
export function displayedLabels(repo: { labels?: string[]; hiddenLabels?: string[] }, detected: DetectedLabel[] | undefined): DisplayedLabel[];
```

`detectLabels` is pure and sorted, so the table is tested exhaustively without touching a disk. It lives in `shared/`
because the UI needs `marker` for the tooltip ("detected from `.tf` files") and `displayedLabels` for every view. The
snapshot carries `detectedLabels?: { label: string; marker: string }[]` — the marker string from the matching rule,
not a path, so nothing about the repository's layout beyond the rule hit leaves the scanner. When several rules give
the same label, the first rule in table order wins the marker.

Alternative considered: detection by language statistics (counting extensions across the tree, like linguist). Rejected:
it means walking the whole tree on every scan, and the result ("37% TypeScript") is not a label anyone would filter by.

### Bounded, two-level listing through `RepoSource.listEntries`

A new `listEntries(absDir): Promise<{ name; kind: "file" | "dir" | "other" }[]>` on `RepoSource`, implemented with
`readdir(dir, { withFileTypes: true })`. A `Dirent` reports a symbolic link as `isSymbolicLink()`, neither file nor
directory, so links are `"other"`: never descended into and never matched — that is how "does not follow symbolic
links" is met without an extra `lstat`. A failing `readdir` yields `[]`.

`scanRepo` calls a small `scanLabels(source, repo.path)` after the existence check: list the project folder, then up to
64 of its subdirectories in name order, skipping the excluded names and dot-directories, each truncated to 500
entries; feed the union into `detectLabels`. Depth one below the root catches the common layouts (`infra/`,
`terraform/`, `service/`, `web/`) while keeping the cost at most 65 `readdir`s per repository per scan. It runs only for
the main checkout's project folder (for a project in a subdirectory of its git repository, that subdirectory), not for
linked worktrees: labels describe the project, and worktrees are branches of the same project.

Alternative considered: `git ls-files` — rejected because it would add a git invocation per scan, miss untracked
files in non-git folders (which must be detected the same way), and widen what the scan asks git for.

### Displayed labels and the filter

`displayedLabels` returns custom labels in the user's order (`kind: "custom"`), then detected labels not hidden and not
case-insensitively equal to a custom one (`kind: "detected"`, with `marker`), sorted. Filtering compares lower-cased
names; the URL keeps the case the user activated. `overviewState.ts` gains `labels: string[]` in `OverviewState`,
parsed with `URLSearchParams.getAll("label")` and serialised as repeated `label=` parameters after the existing ones,
so existing URLs round-trip unchanged. `filterRows(rows, q, wip, labels)` gains the AND match; `OverviewRow` carries the
displayed labels, built where the row is built from snapshot and config.

The filter control sits in the overview band beside the work-in-progress toggle: a compact list of label toggle chips
(every label displayed on a listed repository, plus any active label from the URL that matches nothing). A chip on a
row or tile is a `<button>` that stops propagation, so it toggles the filter and never triggers the row's navigation;
the repository name stays the row's link. Rows show labels under the name, truncated with `+<n>`; tiles and the board
header wrap.

### Settings editing

Per tracked repository, a labels line: custom chips with a remove button, an input with a `<datalist>` of labels used
on other repositories (a native suggestion list, no new component), and the detected labels from the current snapshot
as toggle chips (shown / hidden) writing `hiddenLabels`. All edits go to the draft. `putConfig` already decides about
re-scanning from the enabled set only, so label-only saves start no scan without a change there.

## Risks / Trade-offs

- [A rule misfires: a `package.json` that only holds tooling marks a Go service as `javascript`] → per-repository
  hiding, and the tooltip names the marker so the user can see why.
- [Monorepos with markers two or more levels down are not detected] → accepted and specified ("Too deep"); custom
  labels cover the rest. Going deeper multiplies the cost on every scan of every repository.
- [Very large top-level folders slow the scan] → 500 entries per directory and 64 subdirectories cap the work; a
  truncated listing may miss a marker, which is a missing label, never a wrong one.
- [Snapshots cached by an older version have no `detectedLabels`] → the field is optional; such repositories show
  custom labels only until the next scan.
- [`types.ts` is also edited by `add-validate-phase`] → the additions here are new optional fields on `RepoConfig` and
  `RepoSnapshot`, away from the declarations that change touches.

## Migration Plan

None needed: both config fields are optional, and the snapshot field is optional and refilled by the first scan.
Rolling back to an older binary drops the unknown config keys on its next save (the schema strips unknown keys), which
loses the labels and nothing else.
