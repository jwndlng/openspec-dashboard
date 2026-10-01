# Proposal

## Why

With a dozen or more tracked repositories the projects overview is one flat list, and the only way to narrow it is a
substring of the repository name. Users think of their projects in groups — "the Terraform ones", "the Go services",
"client work" — and have no way to say so or to see it. Some of those groups are a matter of taste and only the user can
name them; others, such as the technology a project is built with, are plain facts the repository already states in its
files and should not have to be typed in by hand.

## What Changes

- **Custom labels per repository.** A tracked repository can carry a short list of user-chosen labels (e.g. `client`,
  `infra`, `side-project`), stored with that repository's entry in `~/.openspec-dashboard/config.json` and edited in
  Settings → Tracked repositories. Nothing is written to the repository itself.
- **Detected labels.** During each scan the dashboard derives technology labels from a fixed, built-in rule table of
  marker files in the project's folder (e.g. `*.tf` → `terraform`, `go.mod` → `go`, `Cargo.toml` → `rust`,
  `package.json` → `javascript`, `tsconfig.json` → `typescript`, `pyproject.toml` → `python`, `Dockerfile` →
  `docker`, `Chart.yaml` → `helm`). Detection lists directory entries only — the project root and its immediate,
  non-hidden subdirectories, skipping dependency and build folders, with a bound on entries read — and opens no file,
  runs no git command and writes nothing. The result is part of the repository's snapshot, so it changes when the
  repository does.
- **A detected label can be hidden per repository** when the rule guessed wrong (a stray `Dockerfile` in a Go
  repository, say). The hidden names are kept in the same config entry; the label stays hidden while it is detected
  and the setting is harmless once it no longer is.
- **Labels are shown** on overview rows, on overview tiles and in the repository board header. Detected labels are
  told apart from custom ones by an icon and their tooltip, not by colour alone. A custom label with the same name as a
  detected one is shown once, as the custom label.
- **The overview can be filtered by label.** Activating a label (on a row, a tile or in a label filter control) adds
  it to the filter; several labels combine with AND; the filter combines with the search and the work-in-progress
  filter, applies instantly and persists in the URL as repeated `label=` parameters.
- The demo site's sample data carries labels of both kinds so the feature can be seen there.

## Capabilities

### New Capabilities
- `project-labels`: custom labels per tracked repository (shape, validation, storage in the dashboard config, editing
  in Settings), detected technology labels (the built-in rule table, what is read and what is not, when it is
  computed), hiding a detected label, how labels are displayed on the overview and the board header, and the
  overview's label filter with its URL form.

### Modified Capabilities
None. Labels are added beside the existing overview, board-header and Settings requirements without changing what
those already require: the overview's search stays a search over names, and the label filter is its own control.

## Impact

- `src/shared/types.ts` — `RepoConfig.labels?`, `RepoConfig.hiddenLabels?`, `RepoSnapshot.detectedLabels?`, and a
  small shared helper that merges custom and detected labels into what is displayed.
- `src/shared/labels.ts` (new) — the rule table and the pure matcher from directory entries to labels, shared by the
  server (detection) and the UI (tooltips that say which file a label was detected from).
- `src/server/config.ts` — schema for `labels` and `hiddenLabels` (trimmed, length-limited, single line, case-
  insensitively unique, bounded count); absent stays absent, so existing configs load unchanged.
- `src/server/source.ts` — a read-only `listEntries(absDir)` on `RepoSource` (names and kinds of directory entries).
- `src/server/scanner.ts` — `detectedLabels` computed in `scanRepo` from the main checkout's project folder.
- `src/ui/overview.tsx`, `src/ui/overviewState.ts` — labels on rows and tiles, the label filter and its URL form.
- `src/ui/kanban.tsx` — labels in the repository board header.
- `src/ui/settings.tsx` — a labels editor per tracked repository and the hidden-detected-labels toggles.
- `src/ui/styles.css`, `src/ui/icons.tsx` — label chips and the "detected" marker.
- `src/ui/demo/sampleData.ts` — sample labels.
- `test/` — `config.test.ts`, a new `labels.test.ts` (rule table and matcher), `scanner.test.ts` with marker files
  written into a temporary repository (the shared fixtures stay untouched), `overview.test.ts` (filter, URL
  round-trip), `settingsSections.test.ts` if the section's counts change, `demoData.test.ts`.
- `README.md` — a short note on labels.
- Invariant 1 is untouched: detection only lists directory entries of a tracked repository, opens no file there and
  runs no git command; labels are written only to `~/.openspec-dashboard/config.json` through the existing
  `PUT /api/config`. No new route, no new dependency, no network.
- **Overlap**: `add-validate-phase` also edits `src/shared/types.ts`, in unrelated declarations. `simplify-project-mgmt`
  (merged, not archived) last reshaped `overview.tsx` and Settings' sections; this change builds on that state.

## Non-goals

- Labels on changes or on cards, or filtering the Kanban boards by repository label.
- Writing labels into the repository (e.g. into `openspec/config.yaml`) or sharing them between machines.
- User-defined detection rules. The rule table is built in; a wrong guess is hidden, not reconfigured.
- Reading file contents for detection (e.g. which framework a `package.json` depends on), or language statistics.
- Label colours chosen by the user.
