## 1. Prerequisite

- [x] 1.1 Archive `kanban-dashboard-mvp` so `openspec/specs/repo-discovery` and `openspec/specs/dashboard-api` exist, then run `openspec validate discover-on-root-change` and confirm the MODIFIED requirement headers match the base specs

## 2. Shared types and discovery core

- [x] 2.1 Change `DiscoverResult` in `src/shared/types.ts` to `{ candidates: RepoConfig[]; errors }`
- [x] 2.2 In `src/server/discover.ts` replace `mergeDiscovered` with a pure `toCandidates(known, paths)` (found paths not in `known`, built via `newRepoConfig(path, false)`, sorted by path) and make `discoverRepos` return `{ candidates, errors }`
- [x] 2.3 Update `test/discover.test.ts`: configured repos (enabled or disabled) are excluded from candidates, unknown ones are included with default name and `enabled: false`, result is sorted; existing walk tests still pass

## 3. Discover endpoint

- [x] 3.1 Export a reusable scan-roots validator from `src/server/config.ts` (array of absolute paths with `~` expansion, same rule as `configSchema.scanRoots`)
- [x] 3.2 In `src/server/api.ts` parse the optional JSON body of `POST /api/discover`: no/empty body → saved roots; `{ scanRoots }` → validated roots; invalid JSON or non-absolute root → `400` with `error`/`issues` and no walk
- [x] 3.3 Ensure the handler neither mutates `state.config` nor calls `saveConfig`
- [x] 3.4 Extend `test/api.test.ts`: roots from body with empty saved roots, config unchanged afterwards, configured repo excluded from candidates, relative root → 400, missing root → 200 with `errors` plus candidates from the valid root

## 4. Settings UI

- [x] 4.1 `src/ui/api.ts`: `discover(scanRoots?: string[])` sends `{ scanRoots }` as the body
- [x] 4.2 `src/ui/settings.tsx`: add `candidates` state and a `runDiscovery(roots)` helper with a sequence counter so only the latest response is applied; skip the request and clear candidates/errors when `roots` is empty; never call `saveConfig` from discovery
- [x] 4.3 Call `runDiscovery` on mount when the config has roots, and from `addRoot` / root removal with the new draft roots
- [x] 4.4 Replace the Discover button with **Rediscover** (disabled with no roots) and show a "Discovering…" indicator while the latest run is in flight; keep per-root error notices
- [x] 4.5 Split the repositories panel into **Tracked** (`draft.repos`: toggle, rename, forget) and **Discovered** (candidates filtered against `draft.repos` by id: name, path, per-row **Enable**); Enable appends `{ ...candidate, enabled: true }` to the draft and marks it dirty
- [x] 4.6 Update hint texts and empty states (no roots / discovering / nothing new found) and add candidate row styles in `src/ui/styles.css`

## 5. Verification and docs

- [x] 5.1 `bun test` and typecheck pass
- [x] 5.2 Run the app against the real workspace: adding a root lists candidates without clicking or saving; `~/.openspec-dashboard/config.json` is unchanged until Save; enabling one candidate + Save adds exactly that repo and it appears on the board; forget + Save + Rediscover brings it back as a candidate; removing the last root clears the list
- [x] 5.3 Update README Settings section, including the note that pre-existing disabled entries stay under Tracked and can be forgotten manually
