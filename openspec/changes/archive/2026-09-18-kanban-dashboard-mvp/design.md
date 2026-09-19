## Context

Greenfield project. The user has ~18 OpenSpec-enabled repositories under `~/Workspace/{prvt,acme,ops}` written by OpenSpec CLI versions from 1.3.x upward. Work is infrastructure-heavy: many repos, a handful of changes each, and hygiene changes that repeat across repos. The dashboard must stay lightweight and local-first, keep every repository as the source of truth, and leave room for a later dispatcher (agents executing changes) and remote git sources without a redesign.

Reference facts established during exploration:
- `@fission-ai/openspec` (1.13.x) exports `loadChangeContext(projectRoot, changeName)`, `formatChangeStatus(ctx)`, `resolveSchema`, `detectCompleted` from `core/artifact-graph` — the same code path the CLI uses for `openspec status --json`.
- Shelling out to the CLI costs ~0.6s fixed startup per call (~25s for a full scan); the library route is sub-millisecond.
- On-disk signals: `changes/<name>/.openspec.yaml` (`schema`, `created`), `tasks.md` checkboxes, `changes/archive/YYYY-MM-DD-<name>/`, git history on `openspec/` paths, and `feat/<change>`-style branches/worktrees.

## Goals / Non-Goals

**Goals:**
- One Kanban across all tracked repos, columns derived from the schema, with implementation states appended.
- Zero writes to repositories; all state in `~/.openspec-dashboard/`.
- Single Bun binary (`bun build --compile`) with the SPA embedded; `openspec-dashboard` starts a local server and opens a browser.
- Scanner and data model shaped so later changes can add: an activity feed (git-derived events), a dispatcher that turns the "copy command" into execution, and non-local repo sources.

**Non-Goals:**
- Activity feed, campaign/cross-repo grouping, remote sources, agent execution, auth, multi-user, light theme, SQLite.

## Decisions

### D1 — Import `@fission-ai/openspec` in-process instead of shelling out
Use the library's artifact-graph primitives (`parseSchema`, `ArtifactGraph`, `detectCompleted`, `resolveArtifactOutputs`) directly. Pin `^1.13.0`. The higher-level `resolveSchema`/`loadChangeContext`/`formatChangeStatus` are **not** used: they locate the package's bundled `schemas/` via `import.meta.url`, which does not exist inside a `bun build --compile` binary. The adapter instead embeds `schemas/spec-driven/schema.yaml` as a text asset at build time and re-implements the ~20 lines of status assembly (same build-order sort, same `skip_specs` handling); project-local `openspec/schemas/<name>/schema.yaml` still takes precedence, and an unknown schema is reported on the change rather than failing the repo. Rationale: identical status semantics to the CLI, no per-call startup cost, custom schemas keep working. *Alternative considered*: re-implement artifact detection (simple for `spec-driven`, but diverges as schemas evolve); shell out to CLI (too slow at 40+ changes).
Compatibility note: repos created by 1.3.x use the same `.openspec.yaml` marker and layout; the lib is tested against them during implementation (beta-soc, demo-ops).
Implementation note: the package's `exports` map only exposes its root, and the root does not re-export the artifact graph. We reach `dist/core/artifact-graph` through a tsconfig path alias (`@openspec-core/*` → `node_modules/@fission-ai/openspec/dist/core/*`), which Bun honours at runtime and in `--compile`. Only `openspecAdapter.ts` uses the alias.

### D2 — Storage: JSON files under `~/.openspec-dashboard/`
```
~/.openspec-dashboard/
├── config.json     { version, scanRoots[], repos[{ id, path, name, enabled }], pollIntervalSeconds, port }
└── cache/
    └── snapshot.json   last successful Snapshot (served immediately on startup while first scan runs)
```
Config writes are atomic (write temp + rename). Rationale: nothing to install, trivially inspectable, enough for tens of repos. `bun:sqlite` remains an option for the activity feed later. Repo `id` is a stable hash of the absolute path so renames of display name do not break references.

### D3 — Data model (the seam for future changes)
```ts
type Snapshot = { generatedAt: string; repos: RepoSnapshot[] };
type RepoSnapshot = {
  id: string; name: string; path: string; ok: boolean; error?: string;
  scannedAt: string; isGit: boolean; currentBranch?: string;
  worktrees: { path: string; branch: string }[];
  changes: ChangeSnapshot[];
};
type ChangeSnapshot = {
  repoId: string; name: string; schema: string;
  artifacts: { id: string; status: "done" | "ready" | "blocked" }[];   // from formatChangeStatus, in schema order
  tasks: { done: number; total: number } | null;                         // null when tasks artifact missing
  created?: string;              // .openspec.yaml
  archived?: string;             // date parsed from archive dir name, present ⇒ archived
  lastActivityAt?: string;       // git log -1 on the change dir; mtime fallback
  branchMatch?: string;          // branch/worktree whose name contains the change name
  stage: "artifact" | "implementing" | "done" | "archived";
  column: string;                // derived, see D5
};
```
The `source` of a repo is implicit (local path) in v0; the scanner is written against a `RepoSource` interface (`listChanges`, `readFile`, `git(args)`) with one `LocalRepoSource` implementation so a remote source can be added later without touching column/stage logic.

### D4 — Scanner: polling, per-repo isolation
A single scheduler runs every `pollIntervalSeconds` (default 60). Each enabled repo is scanned in its own async task with a per-repo timeout; a failing repo yields `ok:false, error` and keeps its previous `changes` so the board never goes blank. Scans of different repos run concurrently (bounded, e.g. 4 at a time). A manual `POST /api/scan` triggers an immediate run and is debounced if one is in flight. Rationale: latency requirements are minutes, not seconds; polling is simpler and more robust than fs watchers across ~18 repos and worktrees. *Alternative*: `fs.watch` per repo — rejected for v0 (macOS recursive watch limits, noise from worktrees).

Git reads are limited to: `git rev-parse --is-inside-work-tree`, `git rev-parse --abbrev-ref HEAD`, `git worktree list --porcelain`, `git log -1 --format=%cI -- openspec/changes/<name>` (and the archive dir for archived changes). All invoked with `cwd` set to the repo and never with user-controlled arguments beyond the change directory name (validated against `^[A-Za-z0-9._-]+$`).

### D5 — Column derivation
Columns are computed per change from its schema, then unioned across the board in first-seen order:
1. If the change directory is under `changes/archive/` → `Archived`.
2. Else if `tasks.total > 0 && tasks.done === tasks.total` → `Done` (complete, not archived — the nag column).
3. Else if `tasks.done > 0` → `Implementing`.
4. Else → the display name of the **first artifact not `done`** in schema order (e.g. `Proposal`, `Design`, `Specs`, `Tasks`). If all artifacts are done and tasks has 0 ticks → `Tasks` column is *not* used; such a change shows in `Implementing` with `0/N` (it is ready to apply). If `tasks.total === 0` and all artifacts done → `Implementing` with a "no tasks" warning badge.
Board column order: artifact columns (in schema order of the most common schema, others appended) → `Implementing` → `Done` → `Archived`. `Archived` is collapsed by default and shows the 25 most recently archived, sorted by archive date.

### D6 — UI: Preact + TypeScript SPA, embedded in the binary
Preact (small, React-compatible) with a hand-written CSS token file mirroring the Dithered reference; no Tailwind, no component kit. Two routes handled client-side: `/` (Kanban) and `/settings`. State fetched from `GET /api/state`, refreshed on the poll interval and on the Refresh button. Built with `bun build` to `dist/`, embedded via Bun's file embedding so `bun build --compile` produces one artifact. *Alternative*: server-rendered + htmx — rejected because the board's filtering/collapsing is client state.

### D7 — Design tokens (from the reference)
```
--bg-base #080d16  --bg-section #0e1524  --bg-raised #111c30  --bg-surface #1a2640  --bg-elevated #243350
--fg-heading #f0f5fa  --fg-body #8a9bb5  --fg-subtle #6a7a94  --fg-disabled #3a4a64
--brand #71c7c5  --brand-strong #4a9b99  --brand-fg #9ddcdb  --brand-soft #164040  --brand-softer #0c2424
--success #0c8 / #10b981   --warning #ff8c42 / #fbbf24   --danger #ff2d6b
--border #71c7c52e  --border-light #71c7c514  --border-subtle #1a2640
--radius 4px   --gap 8/16/24/32px
fonts: "Space Grotesk" (display/body), "JetBrains Mono" (change names, paths, counts)
```
Fonts are bundled as woff2 inside the binary (no network dependency; local-first). Dark theme only.

### D8 — HTTP API (localhost only)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/state` | current `Snapshot` (cached one until the first scan completes) |
| GET | `/api/config` | current config |
| PUT | `/api/config` | replace config (validated); triggers a scan if repos changed |
| POST | `/api/discover` | scan `scanRoots` for `openspec/config.yaml`; returns candidates merged with known repos |
| POST | `/api/scan` | trigger an immediate scan; returns `{ started: boolean }` |
Server binds `127.0.0.1` on `port` (default 4711). No auth in v0 because the bind is loopback-only.

### D9 — Agent seam
Each card exposes "Copy apply command" → `cd <repoPath> && claude "/opsx:apply <changeName>"`. Purely clipboard; a future dispatcher change replaces the string with an action while reusing `ChangeSnapshot` as its input.

## Risks / Trade-offs

- [Library API of `@fission-ai/openspec` is not semver-guaranteed as a public contract] → pin minor version; wrap all lib calls behind one `openspecAdapter` module so breakage is localized; add a smoke test that runs the adapter against fixture repos.
- [Older repos (1.3.x) might have layout quirks the 1.13 lib rejects] → fixture repos copied from real ones (beta-soc, demo-ops) in tests; per-change errors are captured on the card rather than failing the repo.
- [Git commands on large repos or worktrees add scan time] → per-repo timeout, concurrency bound, and `lastActivityAt` computed only for non-archived changes plus the 25 most recent archives.
- [Discovery walking `~/Workspace` could be slow or wander into huge trees] → depth limit (default 4), skip `node_modules`, `.git`, `.venv`, `target`, `dist`; discovery is manual (button), not periodic.
- [Discovery reports the same changes twice via nested copies and worktrees] → the walk stops at a found repo (fixtures and in-repo worktrees are not projects of their own) and skips linked worktrees (`.git` is a file). Separate clones of the same project are still listed; opt-in tracking handles those.
- [Single binary size with embedded fonts/SPA] → acceptable (a few MB); fonts subset to Latin.
- [Column derivation from mixed schemas across repos could produce odd column orders] → v0 orders by the majority schema; documented; revisit if a second schema appears in practice.

## Migration Plan

New project: `git init`, scaffold, first release as a local binary in `dist/`. No data migration. Rollback = delete `~/.openspec-dashboard/`.

## Open Questions

- Should `Done` (complete, unarchived) surface an age badge by default (e.g. "complete for 12d") to make the nag stronger? Leaning yes; cheap.
- Default `scanRoots`: prompt on first run vs. pre-fill with `~/Workspace`? v0: empty, Settings shows an inline hint.
