# Tasks

## 1. Setting model and migration

- [x] 1.1 In `src/shared/types.ts` replace `AUTO_FETCH_MINUTES`/`AutoFetchMinutes`/`autoFetchMinutes` with `AUTO_FETCH_SECONDS = [15, 30, 60, 300, 600, 900, 1800, 3600]`, `AutoFetchSeconds`, `DEFAULT_AUTO_FETCH_SECONDS = 60`, `RepoConfig.autoFetchSeconds?: AutoFetchSeconds | 0` and `autoFetchInterval(repo)` (seconds, `undefined` for Off); verify with `bun run typecheck` listing only the call sites fixed in later tasks
- [x] 1.2 In `src/server/config.ts` change `repoSchema` to the literal union of `AUTO_FETCH_SECONDS` and `0`, and update the test in `test/autoFetch.test.ts` that keeps it equal to the constant; verify that test passes and that `autoFetchSeconds: 45` and `autoFetchMinutes`-only entries are refused/migrated as expected
- [x] 1.3 In `migrateConfig` convert `autoFetchMinutes` to `autoFetchSeconds` (the same interval in seconds, keeping an existing `autoFetchSeconds`, leaving unknown values for validation) and report `changed`; verify with a new test covering 5→300, 60→3600, both keys present, and an invalid old value

## 2. Endpoint and scheduler

- [x] 2.1 Change `POST /api/repos/<id>/auto-fetch` in `src/server/api.ts` to `{ seconds }`: allowed intervals set the key, `0` stores Off, `60` removes the key, `null`/strings/`{ minutes }`/`{}` are `400`, then `autoFetcher.plan()`; verify with the updated `test/trackingApi.test.ts` scenarios "Setting and clearing auto fetch" and "Unsupported interval"
- [x] 2.2 In `src/server/autoFetch.ts` schedule by `autoFetchInterval` in seconds, so a repository without a setting is fetched every 60 s and one with `0` is never armed; update the header comment and the requirement name it cites; verify in `test/autoFetch.test.ts` that the default arms at 60 000 ms, `0` arms nothing, 15 s arms at 15 000 ms, and changing 3600→15 re-arms
- [x] 2.3 Track repositories whose automatic fetch is running and do not enqueue them again when their timer fires; verify with a test where a fetch is held open across two fires and only one fetch call happens, the timer still re-arms, and the next fire after it resolves fetches again
- [x] 2.4 Update the comment in `src/server/index.ts` on what is scheduled; verify by reading the diff

## 3. UI and demo

- [x] 3.1 `AutoFetchPicker` in `src/ui/projectSettings.tsx`: options Off (`0`) and every `AUTO_FETCH_SECONDS` with `autoFetchLabel(seconds)` ("Every 15 seconds" … "Every minute" … "Every hour"), value `autoFetchInterval(repo) ?? 0`, tooltip mentions it is on every minute unless switched off; `Tracking.setAutoFetch` and `api.setRepoAutoFetch` take seconds; verify with `test/projectSettingsUi.test.ts` (default shows Every minute, Off saves `0`, Every minute clears the key)
- [x] 3.2 `fetchNote` in `src/ui/pullState.ts` takes the effective interval in seconds and words it with the shared helper; the failure detail says auto fetch can be switched off in the project's settings; pass `autoFetchInterval(repo)` from `src/ui/overview.tsx` (row and tile) and `src/ui/kanban.tsx`; verify with `test/pullUi.test.ts` ("every minute", "every 15 seconds", "every hour", no auto text when Off)
- [x] 3.3 Demo: `src/ui/demo/demoApi.ts` validates `{ seconds }` like the server and `src/ui/demo/sampleData.ts` uses the new key where it sets one; verify with `test/demoApi.test.ts` and that the demo still never fetches
- [x] 3.4 Help (`src/ui/helpContent.tsx`: the Pull and fetch text and the "what the dashboard writes" list) and a new What's new entry in `src/ui/changelog.ts` (auto fetch on by default every minute, new intervals, switch off per project); leave the earlier auto-fetch entry as written; verify the changelog test passes

## 4. Invariants and specs

- [x] 4.1 Update `CLAUDE.md` invariants 1 and 4 from "whose auto-fetch setting the user switched on (… off by default)" to "every enabled git project with a remote unless the user switched auto fetch off for it (every minute by default)"; verify the wording matches the dashboard-api delta
- [x] 4.2 In `test/pull.test.ts` keep the "scans, discovery and the state endpoint never reach the remote" proof with the new key, and make the "nothing is fetched" proof set `autoFetchSeconds: 0`; update `test/settingsSections.test.ts` and any other fixture configs using `autoFetchMinutes`; verify `grep -rn autoFetchMinutes src test` only finds the migration and its test

## 5. Verification

- [x] 5.1 Run `bun run check` and verify lint, typecheck and all tests pass
- [x] 5.2 Run `bun run build`, start `dist/spec-control` against a temp home with a config holding `autoFetchMinutes: 15`, and verify the saved config now has `autoFetchSeconds: 900`, a project without a setting shows "Every minute" and its fetch note updates after a minute
- [x] 5.3 Run `openspec validate adjust-auto-fetch` and verify the change is valid
