# Tasks

## 1. Shared types

- [x] 1.1 Add `EnvironmentStatus` (`"ok" | "warning" | "problem" | "not-needed"`), `EnvironmentCheck` (`id`, `label`, `status`, `found`, optional `remedy`) and `EnvironmentReport` (`checkedAt`, `status`, `checks`) to `src/shared/types.ts`, and verify `bun run typecheck` passes with them unused
- [x] 1.2 Add `environment(): Promise<EnvironmentReport>` to the `Api` interface in `src/ui/api.ts` and verify `bun run typecheck` now fails for the demo implementation, which proves the demo-site "missing demo operation" rule covers this endpoint

## 2. The report module

- [x] 2.1 Create `src/server/environment.ts` exporting `environmentReport(config, snapshot)`, assembling the checks in the fixed order `dashboard-home`, `git`, `git-identity`, `openspec-cli`, `agent:<id>`…, `github-cli`, and folding the overall status as `problem` > `warning` > `ok` > `not-needed`; verify with a test that a fully equipped machine yields `ok` and stable order
- [x] 2.2 Implement the `dashboard-home` check (`mkdir -p`, write `.env-check-<random>`, delete it; `problem` with the directory and OS message on any failure) and verify with tests that it is `ok` on a temp `OPENSPEC_DASHBOARD_HOME`, that no probe file is left behind, and that a read-only directory yields `problem`
- [x] 2.3 Implement the `git` and `openspec-cli` checks as PATH lookups reporting the path found, without executing anything, and verify with tests that a temp `PATH` without each one yields a non-`ok` check naming it and a remedy
- [x] 2.4 Implement the `git-identity` check: `git config --get user.name` / `user.email` with `cwd` = `dashboardHome()`, falling back to `os.tmpdir()` when that path lies inside a configured repository path, with `GIT_OPTIONAL_LOCKS=0` and `GIT_TERMINAL_PROMPT=0`; verify with tests that a missing `user.name` alone is named, that both missing is reported, and that no file under a fixture repository changes
- [x] 2.5 Implement the `github-cli` check: `gh` on the PATH, then `GH_TOKEN`/`GITHUB_TOKEN` presence tested without reading the value, else a non-empty `hosts.yml` under `$GH_CONFIG_DIR`, `$XDG_CONFIG_HOME/gh`, `~/.config/gh` or `%AppData%/GitHub CLI` established by `stat` alone; verify with tests that "not installed" and "no credentials found" are distinct, that an existing host file reads as configured without its contents being opened, and that a token value appears nowhere in the report
- [x] 2.6 Implement the per-agent checks through `availability()` from `src/server/sessions/agents.ts`, one per configured agent with id `agent:<agent id>`, stating the agent's name and whether it is the default; verify with a test over three configured profiles that the ids and the default marker are right
- [x] 2.7 Implement the `relevance` helper that derives each status from `(config, snapshot)` — agent sessions off ⇒ agent, `git-identity` and `github-cli` are `not-needed` and say which setting makes them so; default or repository-selected agent missing ⇒ `problem`; unused configured agent missing ⇒ `warning`; `git` missing ⇒ `problem` when some enabled repository's `isGit` is true, else `warning`; `openspec-cli` missing ⇒ `warning` — and verify each branch with a test
- [x] 2.8 Add the sentence about GitHub credential validity only being known when the agent uses it to the report, and verify with a test that it is present whenever the `github-cli` check is not `not-needed`
- [x] 2.9 Memoise the last report for 10 seconds inside the module, keyed on what it was computed from, with a `force` option for **Re-check**; verify with tests that two identical calls spawn `git config` once, that `force` recomputes, and that a changed configuration is reflected by the next report

## 3. API

- [x] 3.1 Add `GET /api/environment` to `src/server/api.ts`, returning `environmentReport(state.config, state.scanner.snapshot)`, and verify with a test in `test/api.test.ts` that the response carries `checkedAt`, `status` and one entry per check
- [x] 3.2 Verify with a test that `POST /api/environment` is handled as an unknown route and computes no report, and that a request while repositories are tracked creates, modifies or deletes no file under them and opens no network connection
- [x] 3.3 Implement `environment()` in the HTTP client in `src/ui/api.ts` and verify `bun run typecheck` passes for that side

## 4. Settings section

- [x] 4.1 Append `environment` to `SECTION_IDS` in `src/ui/settingsSections.ts` and verify with a test that existing deep links are unchanged, `?section=` is still absent for `roots`, and `environment` round-trips through `parseSection`/`serializeSection`
- [x] 4.2 Create `src/ui/environment.tsx`: the section listing each check in report order with label, status as text, what was found and its remedy, `not-needed` entries de-emphasised but readable, a heading count of the non-`ok`, non-`not-needed` checks, a loading state, an error state that keeps **Re-check**, and a **Re-check** control that marks itself working; verify by rendering it against a hand-made report in a test
- [x] 4.3 Wire the section into `src/ui/settings.tsx` as the last section, taking the report and a re-check callback as props and holding no draft state, and verify that the save bar shows no unsaved changes after a re-check
- [x] 4.4 Give the navigation entry its count: the number of non-`ok`, non-`not-needed` checks, emphasised above zero, a pending indicator while computing and no number when no report loaded; verify with a test that the entry count equals the section heading count and that emphasis does not rely on colour alone
- [x] 4.5 Add the section's styles to `src/ui/styles.css` using existing status tokens, and verify in light and dark themes that every status is legible and distinguishable without colour

## 5. Hero indicator

- [x] 5.1 Own the report state in `src/ui/app.tsx`: fetch on mount, after `onSaved`, and on re-check; never from the auto-refresh timer or `loadState()`. Verify with a test that a simulated hour of auto-refresh triggers no further environment request
- [x] 5.2 Add the indicator to the hero's status corner beside the scan-failure badges — count plus short label, text and icon, a real link to `/settings?section=environment` navigating without a reload, hidden when every check is `ok` or `not-needed`, while no report has loaded, and when the request failed; verify with tests over those four cases
- [x] 5.3 Verify with a test that the indicator changes no column, count, filter or card on the combined board

## 6. Demo

- [x] 6.1 Add the fixed all-passing report to `src/ui/demo/sampleData.ts` with made-up paths and implement `environment()` in `demoApi.ts`, deriving the `not-needed` entries from the demo config's `agentSessions.enabled`; verify `bun run typecheck` passes and that the demo report contains no real path from the build machine
- [x] 6.2 Verify with a test that the demo's `environment()` starts no process, reads no file and opens no connection, and that switching agent sessions off in the demo config turns the agent, identity and GitHub CLI checks into `not-needed`

## 7. Verification

- [x] 7.1 Run `bun run check` and verify lint, typecheck and the full test suite pass
- [x] 7.2 Run `bun run build` and verify `dist/openspec-dashboard` serves `GET /api/environment` with the same report as `bun run dev`, which proves nothing in the new module resolves files relative to a module path (invariant 3)
- [x] 7.3 Run `openspec validate environment-check --strict` and verify it reports the change as valid
- [~] 7.4 In a browser against the local dashboard, verify the Environment section lists every check, that moving the `openspec` executable aside and pressing **Re-check** turns its check non-`ok` (the running server keeps the PATH it started with, so the file has to move, not the PATH), and that the hero then shows the indicator and following it lands on the section
- [~] 7.5 In a browser, verify that switching agent sessions off and saving makes the agent, identity and GitHub CLI checks read as not needed, the navigation count drop to zero and the hero indicator disappear
