# Design

## Context

OpenSpec knowledge is spread over the server today (see proposal.md — Why):

- `scanner.ts` parses `.openspec.yaml`/`openspec/config.yaml` (`parseMarker`), calls `readChangeArtifacts` from
  `openspecAdapter.ts`, reads `prompt.md`/`depends-on.yaml`, counts tasks (`tasksParser.ts`) and asks `specSync.ts`
  whether delta specs are synced; it also looks for worktrees by `openspec/changes` mtime.
- `source.ts` (`LocalRepoSource`) hard-codes `openspec/`, `openspec/changes`, `openspec/changes/archive` and the
  `YYYY-MM-DD-<name>` archive prefix in `exists()`, `listChanges()` and `dirtyFiles()`.
- `discover.ts` owns the marker (`isOpenSpecRepo`) and skips `openspec` directories while walking; `integration.ts`
  confirms an integration with the same marker.
- `artifacts.ts` re-parses the marker and calls the adapter to list a change's files.
- The writers (`createChange.ts`, `dismissChange.ts`, `pull.ts`, `sessions/worktree.ts`) and the docs-only check
  (`sessions/workStatus.ts`) build `openspec/changes/<name>` paths from string literals.
- `shared/columns.ts` (`deriveStage`) is already framework-neutral: it needs only `archived`, `ArtifactStatus[]` and
  `TaskProgress`. That shape is the natural contract.

Constraints: invariant 1 enumerates the modules allowed to write; invariant 3 confines `@fission-ai/openspec`
internals to one adapter and requires the compiled binary to work; fixtures must not change.

## Goals / Non-Goals

**Goals:**
- One place per framework: everything OpenSpec-specific lives in `src/server/frameworks/openspec/`.
- A contract small enough that a second module (e.g. a plain `specs/`+`tasks.md` layout, or another tool's directory
  structure) is a new directory plus one registry line.
- A pure refactor for OpenSpec repositories, proven by the existing tests passing with unchanged expectations.

**Non-Goals:**
- Shipping a second framework or a framework picker in the UI.
- Per-framework agent prompts, integrate prompt, environment check or shared-config profiles. They stay OpenSpec-worded;
  the contract leaves room (`capabilities` flags, below) but nothing consumes them generically yet.
- Moving the writers into modules. Writers stay where invariant 1 names them.
- A per-repository framework override in `config.json`.

## Decisions

### D1. An abstract base class plus plain data types

`src/server/frameworks/framework.ts` declares:

```ts
export type FrameworkId = string;               // re-exported from shared/types.ts as the snapshot field type

/** Where a framework keeps its files, relative to the project folder. Pure data; writers derive paths from it. */
export interface FrameworkLayout {
  root: string;            // "openspec" — what `dirtyFiles` and `lastUpdatedAt` look at
  changesDir: string;      // "openspec/changes"
  archiveDir?: string;     // "openspec/changes/archive"; absent = no archive
  /** Names the walk must not descend into while discovering (the framework's own tree). */
  skipDirs: string[];      // ["openspec"]
}

export interface FrameworkChange {   // what `scanChange` used to assemble from OpenSpec calls
  schema: string;
  artifacts: ArtifactStatus[];
  tasksPath?: string;
  created?: string;
  warnings: string[];
}

export abstract class SpecFramework {
  abstract readonly id: FrameworkId;
  get label(): string;                          // from FRAMEWORK_INFO (D6)
  abstract readonly layout: FrameworkLayout;
  readonly sharedConfigFile?: string;           // OpenSpec: "openspec/config.yaml"; absent = no shared profiles

  /** Discovery: the folder is a project of this framework (stricter). */
  abstract isProject(dir: string): Promise<boolean>;
  /** Scan: a tracked folder still holds this framework's tree (looser). Default: `layout.root` is a directory. */
  claims(source: RepoSource): Promise<boolean>;
  /** Text of the scan error when nothing claims the folder. */
  missingMessage(): string;

  /** Active and archived change directories: `source.listChanges(this.layout, options)` (D3). */
  listChanges(source: RepoSource, options?): Promise<ChangeListing>;
  /** Settings read once per checkout (OpenSpec: the schema from config.yaml); a worktree inherits the main checkout's. */
  readProject(source: RepoSource, inherited?: FrameworkProject): Promise<FrameworkProject>;
  /** Artifacts, tasks path, schema, created date of one change. Never throws: problems become warnings. */
  abstract readChange(source: RepoSource, project: FrameworkProject, entry: ChangeDirEntry): Promise<FrameworkChange>;
  /** `readChange` plus the absolute files each artifact resolves to, for the detail view. */
  abstract readChangeOutputs(source, project, entry): Promise<FrameworkChangeOutputs>;
  /** Task progress of the tasks file's text. Default: the shared checkbox counter (`[x]`, `[~]`, `[ ]`). */
  parseTasks(text: string): TaskProgress;
  /** Whether a finished change's spec deltas are reflected in the main specs. Default: undefined (cannot tell). */
  specsSynced(source: RepoSource, entry: ChangeDirEntry): Promise<SpecSyncResult | undefined>;
  /** Files a new change starts with, as relative path → content. The writer decides how and whether to write them. */
  abstract scaffold(input: { project: FrameworkProject; today: string }): Record<string, string>;
}
```

Why a base class rather than only an interface: the user asked for abstract classes, and the defaults (`claims`,
`listChanges`, `parseTasks`) are what most layout-based frameworks share — a new module overrides only what differs.
The data the board consumes stays plain interfaces in `shared/types.ts`, so nothing on the UI side knows about classes.
Alternative considered: a record of functions per framework. Equivalent, but defaults would need a merge helper and the
"must implement" set would not be checked by the compiler.

`prompt.md` and `depends-on.yaml` are the **dashboard's** conventions, not OpenSpec's: the scanner keeps reading them
from the change directory for every framework, as does the task counter's `[~]`. `CHANGE_NAME` stays global (invariant
6); `listChanges` must apply it.

### D2. The registry decides, once per scan and per discovery

`src/server/frameworks/registry.ts` exports `FRAMEWORKS: readonly SpecFramework[]` (today `[openspec]`),
`frameworkById(id)`, `detectFramework(dir)` (first `isProject`, for discovery and integration confirmation) and
`claimFramework(source)` (first `claims`, for the scanner). The scanner resolves the module once per repository and
passes it into the per-checkout context; linked worktrees use the same module as the main checkout (a branch does not
switch frameworks mid-repository). The create, dismiss, artifact and shared-config routes resolve it with
`frameworkById(snapshot.framework)` from the repository's last snapshot (an absent id is `openspec`); all of them
already require a successful scan. `scanRepo` takes the registry as an optional argument, the seam the tests use to
register a stub module.

Alternative: store the framework in `RepoConfig`. Rejected for now: it needs a config migration and validation for a
choice there is only one answer to; detection is cheap and keeps the repository the source of truth (invariant 5).

### D3. `RepoSource` stays git and file access; layout moves out

`LocalRepoSource.listChanges`, `exists` and `dirtyFiles` stop hard-coding paths: `listChanges(layout, options)` takes a
`ChangesLayout` (changes and archive directory), `exists(relDir)` a directory and `dirtyFiles(relRoot)` the layout root.
The listing stays on the source rather than moving into the module, because the tests use `listChanges` and `exists` as
their failure seams; the module's default `listChanges`/`claims` just pass its layout. `RepoSource` remains the seam
for tests and for a future remote source, and gains no framework knowledge.

### D4. The OpenSpec module

`src/server/frameworks/openspec/`:
- `adapter.ts` — today's `openspecAdapter.ts`, moved unchanged (embedded `spec-driven` schema, local schemas first,
  `@openspec-core/*` alias). Still the only importer of `@fission-ai/openspec`; CLAUDE.md invariant 3 is updated.
- `marker.ts` — `parseMarker` and the line regexes, from `scanner.ts`.
- `specSync.ts` — moved from `src/server/specSync.ts`, now reading `layout`-derived paths.
- `index.ts` — `class OpenSpecFramework extends SpecFramework`: layout `openspec`, `openspec/changes`,
  `openspec/changes/archive`; `isProject` = `openspec/config.yaml|yml`; `claims` = `openspec/` is a directory;
  `missingMessage` = today's text; `readProject` reads the schema from `openspec/config.yaml`; `readChange` does what
  `scanChange` did between reading the marker and computing `tasksPath` (including the "could not read artifacts"
  warning); `scaffold` returns `.openspec.yaml` with `schema:` and `created:` (the schema resolution moves here from
  `createChange.ts`).

### D5. Writers keep their place, take paths from the layout

`createChange.ts` and `dismissChange.ts` take their paths from `writablePaths(framework)` in `registry.ts`, which
returns the layout only for modules whose paths the `dashboard-api` spec enumerates (today: `openspec`) and refuses
every other module (`not-writable` / `409`) — the spec's "not enumerated, not offered" rule, true by construction when
a read-only second module is registered before its write paths are specified. Create then writes the module's
`scaffold()` with the same exclusive-create and runs the same `git add -- <changesDir>/<name>/` as today.

`pull.ts` (`CHANGES_PREFIX`), `sessions/worktree.ts` (change copy) and `sessions/workStatus.ts` (docs prefix) are not
called per framework and their spec text names `openspec/` literally, so they are pinned to `OPENSPEC_PATHS` (the
OpenSpec layout exported by the registry) instead of resolving a module: another framework's files never match the
prefix, so they are never a leftover, never copied and never count as "docs only".

Shared config stays OpenSpec-only through the contract's `sharedConfigFile`: the scanner reads profiles only from that
file, and the shared-config routes refuse a repository whose module has none.

### D6. `framework` on the wire

`RepoSnapshot.framework?: FrameworkId` and `DiscoveredRepo.framework?: FrameworkId` in `shared/types.ts`, optional so
old caches parse; readers use `repo.framework ?? "openspec"`. The scanner's failure path keeps the previous value. The
UI uses it in one place: the board subtitle (`· openspec/changes`) shows the framework's changes directory. So that the
UI needs no server module and the snapshot no second field, `shared/types.ts` holds `FRAMEWORK_INFO: Record<FrameworkId,
{ label, changesDir }>`, and each server module takes its `label` and `layout.changesDir` from that entry — one source
for both sides. The demo data sets `framework`.

### D7. Proof of "no behaviour change"

The existing suite is the oracle: no expectation changes except adding `framework: "openspec"` where a whole
`RepoSnapshot` is compared with `toEqual`. New `test/frameworks.test.ts` covers the registry (order, first match,
unclaimed folder → `ok: false` with the old message), a stub read-only module registered in a test-only registry
(changes land in the right columns through `deriveStage`; no `specsSynced`), and `writablePaths`, create and dismiss
refusing the stub. Besides that field, one static check changes: `test/createChange.test.ts` matched the literal
`openspec/changes/${name}/` in the source and now matches the layout expression plus `writablePaths(openSpec)`. The
compiled-binary check (`bun run build` then scanning `test/fixtures/demo-ops`) stays a manual task, as for the adapter
today.

## Risks / Trade-offs

- [Silent behaviour drift while moving code from `scanChange` into `readChange`] → move code verbatim first, refactor
  second; fixture tests unchanged as the gate; warnings compared as exact strings.
- [Invariant 1 accidentally widened by deriving write paths from a pluggable layout] → `writablePaths` allow-list keyed
  by framework id, with a test that a non-enumerated module is refused by create, dismiss, pull-leftover and worktree
  copy.
- [Compiled binary breaks because the adapter moved and the schema import path changed] → keep the relative import of
  the embedded YAML correct for the new depth; build and scan a fixture as a task.
- [Over-abstracting for a second framework nobody has specified yet] → the contract is exactly what OpenSpec already
  needs; no hooks for prompts, sessions or shared config until a real second module asks for them.
- [Merge conflicts with in-flight work touching `scanner.ts`/`createChange.ts`] → land as one PR quickly; changes are
  mostly moves.

## Migration Plan

No user migration: no config or file format changes; cached snapshots without `framework` read as OpenSpec. Rollback is
a revert of the PR.

## Open Questions

- Should a later framework be selectable per repository in Settings (overriding detection)? Deferrable: D2 keeps the
  field out of the config until a second module exists.
