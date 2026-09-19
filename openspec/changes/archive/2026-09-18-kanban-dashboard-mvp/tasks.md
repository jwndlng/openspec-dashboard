## 1. Project scaffolding

- [x] 1.1 `git init`, add `.gitignore` (node_modules, dist), `README.md` with purpose and run instructions
- [x] 1.2 `bun init` with TypeScript; layout `src/server/`, `src/ui/`, `src/shared/` (types), `test/fixtures/`
- [x] 1.3 Add dependencies: `@fission-ai/openspec@^1.13.0`, `preact`, `zod`; dev: `bun-types`, `@preact/preset-vite` or plain `bun build` config for the SPA
- [x] 1.4 Define shared types (`Snapshot`, `RepoSnapshot`, `ChangeSnapshot`, `Config`) in `src/shared/types.ts` per design D3
- [x] 1.5 Add `bun test` setup and copy two real repos' `openspec/` trees (beta-soc, demo-ops, stripped of secrets) into `test/fixtures/` as scanner fixtures

## 2. Config and storage

- [x] 2.1 Implement `src/server/config.ts`: resolve `~/.openspec-dashboard/`, create on first run with defaults (`pollIntervalSeconds: 60`, `port: 4711`), load with zod validation, atomic save (temp + rename)
- [x] 2.2 Implement repo `id` as a stable hash of the absolute path; default `name` from basename
- [x] 2.3 Implement `src/server/cache.ts`: read/write `cache/snapshot.json`, tolerate missing or corrupt cache
- [x] 2.4 Tests: first-run defaults, round-trip save/load, invalid config rejected, rename keeps id

## 3. Discovery

- [x] 3.1 Implement `src/server/discover.ts`: bounded-depth walk (default 4) of scan roots for `openspec/config.yaml`, skipping `node_modules`, `.git`, `.venv`, `target`, `dist`; per-root error collection
- [x] 3.2 Implement merge of discovered repos with known config (preserve `enabled` and `name`; new repos `enabled: false`)
- [x] 3.3 Tests against a temp directory tree: multi-root, ignored dirs, missing root, merge preserves user choices

## 4. Scanner

- [x] 4.1 Implement `src/server/openspecAdapter.ts` wrapping `resolveSchema`, `loadChangeContext`, `formatChangeStatus`; returns artifacts in schema order with `done|ready|blocked`
- [x] 4.2 Implement `RepoSource` interface and `LocalRepoSource` (list change dirs incl. `archive/`, read files, run git with `cwd`)
- [x] 4.3 Implement change-name validation (`^[A-Za-z0-9._-]+$` after stripping `YYYY-MM-DD-` prefix); skip and record warnings for others
- [x] 4.4 Implement `tasks.md` progress parser (`-`, `*`, `+`, ordered markers; case-insensitive `[x]`), `null` when file absent
- [x] 4.5 Implement `.openspec.yaml` `created` read and archive date parsing from dir name with mtime fallback
- [x] 4.6 Implement git helpers: `is-inside-work-tree`, current branch, `worktree list --porcelain`, `log -1 --format=%cI -- <dir>`; mtime fallback for `lastActivityAt`; limit archived activity lookup to 25 most recent
- [x] 4.7 Implement `branchMatch` (first branch/worktree containing the change name)
- [x] 4.8 Implement stage + column derivation per design D5 (`artifact | implementing | done | archived`, column label)
- [x] 4.9 Implement `src/server/scanner.ts`: scheduler on `pollIntervalSeconds`, bounded concurrency (4), per-repo timeout, per-repo failure isolation retaining last good changes, in-flight guard, snapshot write to cache
- [x] 4.10 Tests on fixtures: artifact statuses match `openspec status --json` output for the same changes; tasks parser cases; archive parsing; column derivation table; failing repo isolation

## 5. HTTP API

- [x] 5.1 Implement `Bun.serve` on `127.0.0.1:<port>` with routes `GET /api/state`, `GET/PUT /api/config`, `POST /api/discover`, `POST /api/scan`; static SPA fallback
- [x] 5.2 `PUT /api/config` validation (absolute paths, `pollIntervalSeconds >= 10`, unique ids), 400 on invalid, trigger scan when enabled set changed, reschedule poller when interval changed
- [x] 5.3 CLI entry: parse `--port`, `--no-open`; print URL; open browser via `open`/`xdg-open`
- [x] 5.4 API tests: state before/after first scan, config validation, discover does not persist, scan in-flight returns `started: false`

## 6. UI foundation

- [x] 6.1 Create `src/ui/tokens.css` with the design D7 token set; bundle Space Grotesk and JetBrains Mono woff2 (Latin subset) locally with `@font-face`
- [x] 6.2 Preact app shell with client-side routes `/` and `/settings`, header with snapshot `generatedAt`, Refresh button, per-repo error indicators
- [x] 6.3 `api.ts` client for the four endpoints; polling re-fetch on the configured interval

## 7. Kanban view

- [x] 7.1 Column layout computed from snapshot: artifact columns (majority schema order) → Implementing → Done → Archived
- [x] 7.2 Card component: repo name, mono change name, progress bar `done/total`, relative activity age, branch badge, "no tasks" warning badge, "complete for Nd" on Done cards
- [x] 7.3 Filters: repo multi-select, text search, stale-for-N-days, hide archived; persisted in URL query string
- [x] 7.4 Archived column collapsed by default with total count, expands to 25 most recent by archive date
- [x] 7.5 "Copy apply command" action (`cd <repoPath> && claude "/opsx:apply <name>"`) with copied feedback
- [x] 7.6 Empty state when no repos are enabled, linking to Settings

## 8. Settings view

- [x] 8.1 Scan roots editor (add/remove) and "Discover" button calling `POST /api/discover`, showing per-root errors
- [x] 8.2 Repo list with enable toggle and inline name edit; poll interval input
- [x] 8.3 Save via `PUT /api/config` with validation errors surfaced; unsaved-changes indicator

## 9. Build, packaging and verification

- [x] 9.1 `bun build` for the SPA into `dist/ui`; embed assets in the server; `bun build --compile` script producing `dist/openspec-dashboard`
- [x] 9.2 Verify offline rendering (no external requests) and loopback-only binding
- [x] 9.3 Run the binary against the real workspace (`~/Workspace/alpha`, `acme`, `ops`), confirm all 18 repos discover and scan, spot-check column placement against `openspec status` for 5 changes
- [x] 9.4 Confirm no writes occurred in tracked repos (`git status` clean across repos after a scan)
- [x] 9.5 Update README with build/run instructions and initial commit
