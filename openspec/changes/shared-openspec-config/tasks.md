## 1. Request guard (prerequisite for any repository write)

- [x] 1.1 Check whether another change has already landed a cross-site guard in `src/server/api.ts`; if so, skip 1.2–1.3, delete the "Mutating requests are protected against cross-site requests" requirement from this change's `dashboard-api` delta, and note it in design.md D6
- [x] 1.2 Add a guard in `createFetchHandler` in front of every non-GET `/api/` route: require `Content-Type: application/json`, reject a present `Origin` that is not `http://127.0.0.1:<port>` or `http://localhost:<port>`, reject `Sec-Fetch-Site: cross-site`, respond `403` with a JSON error before any handler runs; send no CORS approval headers
- [x] 1.3 Tests in `test/api.test.ts`: foreign origin → 403 with no side effect, form content type → 403, own origin → processed, no `Origin` with JSON (curl) → processed, GET routes unaffected; update existing tests/helpers to send JSON content type

## 2. Shared config core (`src/server/sharedConfig.ts`)

- [x] 2.1 Add `yaml` to `dependencies` in `package.json` (version matching the installed 2.9.x) and run `bun install`; confirm `bun run build` still produces a working binary
- [x] 2.2 Add types to `src/shared/types.ts`: `SharedProfile { id; name; context; rules }`, `SharedConfig { profiles }`, `AppliedProfile { id; state: "in-sync" | "outdated" | "orphaned" }`, `RepoSharedConfig { unreadable; applied }` on `RepoSnapshot.sharedConfig`, `SharedConfigAssignment { repoId; profileIds }`, and the preview/apply result shapes
- [x] 2.3 Implement storage: `loadSharedConfig()` / `saveSharedConfig()` for `~/.openspec-dashboard/shared-config.json` (atomic temp+rename like `saveConfig`, honouring `OPENSPEC_DASHBOARD_HOME`), and `validateSharedConfig(body)` (unique slug profile ids, non-empty names, string context without the marker string, artifact ids matching `^[A-Za-z0-9._-]+$`, non-empty single-line rules)
- [x] 2.4 Implement `readManaged(text)`: parse with `parseDocument`, return managed content per profile id (context block, marked rules per artifact) and the local context; throw for YAML errors, wrong key types, and malformed markers (unmatched or mismatched pair, nested block, marker without an id, two blocks for one profile)
- [x] 2.5 Implement `repoSharedConfig(text | undefined, shared)` per design D3 as a pure function on top of `readManaged` (per-profile `in-sync` / `outdated` / `orphaned`, dashboard order, orphans last)
- [x] 2.6 Implement `applyShared(text, desiredProfiles)`: the file ends up carrying exactly the desired profiles in order (others, orphans included, detached); one context block per profile first, then a blank line and the local text (no stray blank lines when either part is empty), literal block scalar, shared rule scalars with the trailing marker comment before local entries, removal of emptied lists/keys, `toString({ lineWidth: 0 })`, and the 50KB UTF-8 guard on the resulting context
- [x] 2.7 Implement `resolveProfiles`, `previewFor(repo, shared, profileIds)` and `applyTo(repo, shared, profileIds)`: unknown profile ids refuse, path built from the repo config only, re-read at write time, skip the write when bytes are identical (`unchanged`), atomic temp file in the same directory + rename preserving the file mode, per-repository refusal reasons

## 3. Core tests (`test/sharedConfig.test.ts`)

- [x] 3.1 Fixtures as strings: the real OpenSpec scaffold (copy of this repo's `openspec/config.yaml`), a config with local block-scalar context and a commented local rule, a config with a quoted single-line context, a config with extra unknown keys
- [x] 3.2 Byte-level guarantees: apply keeps `schema`, unknown keys and every comment line; apply twice is byte-identical; apply then apply-empty restores the original bytes for every fixture
- [x] 3.3 Merge behaviour: stacked profiles in dashboard order before local context and local rules, local order/comments survive; updating one profile changes only that profile's lines (assert via a line diff); detaching one profile removes only its sections; a rules-only profile writes no context block
- [x] 3.4 State table: scaffold → carries nothing; after apply → each `in-sync`; one profile edited → only it `outdated`; hand edit inside a block → `outdated`; local edits → still `in-sync`; profile deleted → `orphaned` (reported last) and removable by applying without it; file order irrelevant for reporting; missing file, YAML error, non-string context, every malformed-marker variant → `unreadable`
- [x] 3.5 Refusals: unreadable file, missing file, context over 50KB (exactly at the limit passes, one byte over is refused, measured in UTF-8 bytes with a multi-byte character)
- [x] 3.6 Write path in a temp repo: `unchanged` leaves mtime untouched; an apply leaves no temp file behind; file mode is preserved; the result parses with OpenSpec's own project-config reader and exposes the combined context and rules

## 4. Scanner and API

- [x] 4.1 In `src/server/scanner.ts`, reuse the `config.yaml` text already read per repository to set `sharedConfig.state` when a shared config exists (omit otherwise), never failing the scan, and carry the previous value through the failure path in `scanAll`
- [x] 4.2 Add `GET`/`PUT /api/shared-config`, `POST /api/shared-config/preview` and `POST /api/shared-config/apply` to `src/server/api.ts`; bodies are `{ assignments: [{ repoId, profileIds }] }`; only enabled repository ids from the config are accepted; `PUT` and `apply` trigger a scan
- [x] 4.3 API tests: fresh install returns `{ profiles: [] }`; different profile sets per repository; unknown profile id refused; malformed assignments → 400; invalid save → 400 and unchanged; preview writes nothing; partial success (one written, one refused); unknown/disabled repo id refused; file edited between preview and apply is applied from its current content
- [x] 4.4 Extend the no-side-effects coverage: snapshot a temp repo's full file listing, sizes and mtimes; assert a scan, a shared-config save and a preview change nothing, and that an apply changes exactly `openspec/config.yaml`; with a git temp repo assert `git status` shows only that file and `.git/index` is byte-identical
- [x] 4.5 Scanner tests: state appears once a shared config exists, is omitted before, `unreadable` keeps `ok: true`

## 5. UI

- [x] 5.1 `src/ui/api.ts`: client functions for the four endpoints
- [x] 5.2 Settings: "Shared OpenSpec config" panel with a profile list (add with a slug id derived from the name, rename, delete, reorder) and, for the selected profile, a context textarea with a live UTF-8 byte counter against 50KB and rules grouped by artifact id (ids suggested from schemas in the snapshot, free text allowed; add/remove/reorder entries), and its own Save button independent of the scan-config save bar
- [x] 5.3 Settings: assignment grid — enabled repositories × profiles, checkboxes pre-filled from each repository's carried profiles, per-cell state, orphaned profiles and `unreadable` shown per row, column header toggles a profile for all rows, pending rows (selection differs from the file, or carries an outdated/orphaned profile) marked, "Preview & apply" for the pending rows (apply always goes through the preview dialog)
- [x] 5.4 Preview dialog: pure line-diff helper (`src/ui/lineDiff.ts`, unit-tested) rendering collapsed unchanged runs and `+`/`−` lines with text markers as well as colour; refusals listed with reasons; one confirm button that applies only the non-refused selection; results shown per repository afterwards
- [x] 5.5 Projects overview: carried profile names per row with a warning badge for `outdated`/`orphaned` and danger for `unreadable` (text + colour, shown only when a profile exists, nothing for a repository carrying none); repository board header: one badge per carried profile
- [x] 5.6 Styles in `src/ui/styles.css` using existing tokens only; check both themes and a narrow window (dialog scrolls inside itself, page body does not)

## 6. Invariant wording, docs and verification

- [x] 6.1 Reword `CLAUDE.md` invariant 1 to the new boundary (writes only on explicit user action, only enumerated paths, never deletes, no writing git commands) and list `openspec/config.yaml` managed sections as the enumerated path; align wording with `create-change-from-dashboard` if it has landed
- [x] 6.2 Update `README.md`: the shared config feature, the managed-section markers, what apply does and does not touch, that results are uncommitted changes to review, the 50KB guard, and the JSON content-type requirement for scripted non-GET API calls
- [x] 6.3 Run `bun run check`
- [x] 6.4 Build the binary and, against a throwaway dashboard home with copies of two real `openspec/config.yaml` files in temp git repos, run save → preview → apply → edit shared → apply → apply empty through the compiled binary; confirm states, diffs, byte-identical restoration and `git status` output
- [x] 6.5 Browser check with `bun run dev` against throwaway repos only (do not apply to the user's real repositories during verification): editor, byte counter, preview dialog, partial refusal, badges on overview and repository header, both themes
- [ ] 6.6 Before archiving, rebase the `dashboard-api` never-writes delta on the then-current main spec text (other in-flight changes modify the same requirement)
