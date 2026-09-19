## Why

Setting up tracking takes too many steps and pollutes the config: after editing the workspace roots the user must click Discover (which silently saves the draft first), and every repository found is then written into `config.json` as a disabled entry. With ~18 repositories under the roots, the config and the Settings list fill up with repos the user never chose. Discovery should be a read-only preview that reacts to root edits immediately, and only repositories the user explicitly enables should become part of the configuration.

## What Changes

- Adding or removing a workspace root in Settings triggers discovery immediately against the edited (not yet saved) roots. Opening Settings with roots configured also runs discovery, and a manual "Rediscover" action remains.
- Discovery no longer merges results into the repo list. It returns **candidates**: repositories found under the roots that are not already in the config. Candidates are never persisted by discovery.
- Settings shows two lists: **Tracked repositories** (from the config: enable toggle, rename, forget) and **Discovered** (candidates: path plus a per-repo **Enable** action). Enabling a candidate moves that single repository into the tracked list as `enabled: true`; it is persisted with the next Save like every other Settings edit.
- Forgetting a tracked repository removes it from the config; if it is still under a root it reappears as a candidate.
- **BREAKING** `POST /api/discover` accepts an optional `{ "scanRoots": [...] }` body (defaults to the saved roots) and returns `{ candidates, errors }` instead of `{ repos, errors }`. The Discover button no longer saves the draft config as a side effect.
- No migration: disabled entries already present in existing configs stay listed as tracked-but-disabled and can be forgotten manually.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `repo-discovery`: discovery trigger changes from "only on explicit click" to "on any workspace-root edit, on opening Settings, and on demand"; discovered repositories are no longer added to the config as `enabled: false` but offered as transient candidates that are added only when individually enabled; the Settings requirement changes to the tracked/discovered split.
- `dashboard-api`: the discover endpoint takes optional roots in the request body, validates them, and returns candidates (found minus configured) instead of a merged repo list.

## Impact

- Server: `src/server/discover.ts` (`mergeDiscovered` replaced by a candidate filter), `src/server/api.ts` (request body parsing and validation for `/api/discover`), `src/server/config.ts` (export the absolute-path validator for reuse).
- Shared types: `DiscoverResult` becomes `{ candidates: RepoConfig[]; errors }`.
- UI: `src/ui/settings.tsx` (auto-discovery on root edits and mount, stale-response guard, tracked/discovered lists, per-candidate Enable), `src/ui/api.ts` (`discover(scanRoots)`), `src/ui/styles.css` (candidate rows).
- Tests: `test/discover.test.ts`, `test/api.test.ts`.
- Prerequisite: `kanban-dashboard-mvp` is complete but not archived, so `openspec/specs/` is empty. It must be archived before this change so the `MODIFIED` deltas have base requirements to apply to.
- No new dependencies; config file format (`version: 1`) is unchanged.
