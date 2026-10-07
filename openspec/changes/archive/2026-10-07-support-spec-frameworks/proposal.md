# Proposal

## Why

Spec Control is built around OpenSpec: the `openspec/` layout, the `.openspec.yaml` marker, the
`@fission-ai/openspec` artifact graph, delta-spec sync and the discovery marker are hard-coded across the scanner,
discovery, the artifact reader and the writers. Users want to track repositories that use other spec-driven frameworks
on the same Kanban, and today adding one would mean touching a dozen modules and re-proving every write path. This
change draws a module boundary first, so a later framework is an addition, not a rewrite. No second framework is added
here.

## What Changes

- Introduce a **spec framework module** contract (`src/server/frameworks/`): an abstract base class and the functions a
  framework supplies — how it is detected in a folder, where its changes and archives live, how one change is read into
  the board's framework-neutral shape (artifact statuses with `required`, task progress, schema, created date,
  optional spec-sync state), the files its artifacts resolve to for the detail view, and the content of a new change's
  scaffold. Everything a framework does is read-only; it returns paths and file contents, it never writes.
- Add a **framework registry** that lists the registered modules in a fixed order and decides which module handles a
  folder (first whose marker is present). OpenSpec is the only registered module.
- Move every OpenSpec-specific piece into an **OpenSpec module** (`src/server/frameworks/openspec/`): the adapter
  around `@fission-ai/openspec` (moved from `src/server/openspecAdapter.ts`), the `.openspec.yaml`/`config.yaml`
  marker parsing, the change and archive listing rules, delta-spec sync, and the create-change scaffold.
- Make the framework-neutral code consume the contract: the scanner, discovery, integration confirmation, the artifact
  endpoints, and the path checks of the writers (create-change, dismissal, pull leftovers, session worktree copy, the
  docs-only check for auto-merge) resolve a repository's layout through its module instead of literal `openspec/…`
  strings. Which paths are written and which git commands run stay exactly as today.
- Report the handling framework: each repository snapshot and each discovered candidate carries a `framework` id
  (`"openspec"`), so the UI and later frameworks can tell repositories apart. Older cached snapshots without the field
  read as OpenSpec.
- Keep the Kanban unchanged: columns, stages and cards are still derived by `deriveStage` from artifacts and tasks,
  which is now the explicit contract every module maps onto.
- No behaviour change for OpenSpec repositories: same columns, counts, warnings, writes and API responses apart from the
  added `framework` field.

## Capabilities

### New Capabilities
- `spec-frameworks`: the framework module contract, the registry and how a repository is assigned a module, the
  read-only boundary of a module, the `framework` field in snapshots and discovery results, and OpenSpec as the one
  registered module with unchanged behaviour.

### Modified Capabilities
- `repo-hygiene`: the documented invariant names the new location of the only module allowed to touch
  `@fission-ai/openspec` internals (`src/server/frameworks/openspec/adapter.ts`) and the rule that framework-specific
  code lives under `src/server/frameworks/<id>/`.

## Impact

- New: `src/server/frameworks/framework.ts` (contract and abstract base class), `src/server/frameworks/registry.ts`,
  `src/server/frameworks/openspec/` (`index.ts`, `adapter.ts` moved from `src/server/openspecAdapter.ts`, `marker.ts`,
  `specSync.ts` moved from `src/server/specSync.ts`, `layout.ts`).
- Changed: `src/server/scanner.ts`, `src/server/source.ts` (listing takes a layout), `src/server/discover.ts`,
  `src/server/integration.ts`, `src/server/artifacts.ts`, `src/server/createChange.ts`, `src/server/dismissChange.ts`,
  `src/server/pull.ts` (leftover prefix only), `src/server/sessions/worktree.ts` (change copy path only),
  `src/server/sessions/workStatus.ts` (docs prefix only), `src/server/sharedConfig.ts` (offered only for OpenSpec
  repositories), `src/shared/types.ts` (`FrameworkId`, `FRAMEWORK_INFO`, `framework` on `RepoSnapshot` and
  `DiscoveredRepo`), `src/ui/kanban.tsx` (subtitle path from the framework), `src/ui/demo/sampleData.ts`.
- Tests: imports of the moved modules (`test/parsers.test.ts`, `test/specSync.test.ts`, `test/artifacts.test.ts`,
  `test/discover.test.ts`), new `test/frameworks.test.ts`; existing fixture-based tests must pass unchanged as the proof
  of "no behaviour change". Fixtures are not modified.
- Docs: `CLAUDE.md` invariant 3 and Layout; `openspec/specs/repo-hygiene/spec.md` through the delta.
- Out of scope: a second framework, per-framework agent prompts (`src/shared/agentDefaults.ts` stays OpenSpec-worded),
  shared config profiles (stay OpenSpec-only, offered for repositories whose module supports them), the environment
  check for the `openspec` CLI.
- Overlap: `rename-local-identifiers` (merged, not yet archived) modifies the same `repo-hygiene` requirement; this
  delta is written against its text and should be archived after it.
