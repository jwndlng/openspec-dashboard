# Tasks

## 1. Shared checks

- [x] 1.1 Add `src/shared/github.ts`: parse `owner/name`, `https://github.com/owner/name[.git][/]` and `git@github.com:owner/name.git` to `owner/name`, validate owner and name, refuse other hosts, longer paths, query, fragment and credentials (reason never echoes the secret), derive the default folder name; `test/github.test.ts` covers every accepted form and refusal scenario
- [x] 1.2 Extract the new-folder placement checks and exclusive `mkdir` from `src/server/createProject.ts` into a shared helper used by New project and the clone; `test/createProject.test.ts` still passes unchanged and new tests cover the helper's refusals

## 2. Workspace folder

- [x] 2.1 Add `POST /api/setup/workspace-folder` (`src/server/setup.ts`, `src/server/api.ts`): absolute path, existing parent, placement checks, non-recursive exclusive `mkdir`, config untouched, behind `crossSiteRefusal`; tests cover `201`, `400`, `404` (parent missing), `409` (exists, inside a tracked repository, ignore path, home) and cross-site `403`

## 3. Clone

- [x] 3.1 Add `src/server/githubClone.ts`: placement checks, exclusive `mkdir`, the design D2 `git clone` command and environment, 10-minute timeout, masked reason with the `gh auth setup-git` hint on auth failure, non-recursive `rmdir` of an empty target on failure; `test/githubClone.test.ts` clones from a local bare repository redirected with `url.<base>.insteadOf` via `GIT_CONFIG_COUNT`/`KEY`/`VALUE` and covers success, failure, timeout and a template-installed `post-checkout` hook that must not run
- [x] 3.2 Add the in-memory job list with ids, states, timestamps, a two-clone semaphore, retry replacing a failed entry and dismiss of finished entries; tests prove two concurrent requests for one target yield one clone and one folder, and a third clone waits while two run
- [x] 3.3 On success, track a clone holding `openspec/config.yaml` through the serialized track mutation (default name, disambiguation, scan trigger) and leave the config alone otherwise; tests cover both outcomes and a name collision
- [x] 3.4 Pass running target paths to discovery and leave them out of both results in `src/server/discover.ts`; extend `test/discover.test.ts` with the clone-in-progress scenario

## 4. GitHub listing

- [x] 4.1 Add `gh repo list` through `runGh` in `src/server/gh.ts` (owner validated, one argument, default owner from `gh api user`, `added` from configured origins, sorted by `pushedAt`) and update the module comment listing allowed subcommands; extend `test/fixtures/fake-gh.ts` with a `repo list` scenario and test signed-in, other owner, `gh` missing, signed out and failed outcomes

## 5. API

- [x] 5.1 Add `POST /api/github/repos`, `POST /api/github/clone`, `GET /api/github/clones` and `POST /api/github/clones/dismiss` to `src/server/api.ts`, mutating routes behind `crossSiteRefusal`, with the status codes of the dashboard-api delta; `test/githubApi.test.ts` covers every endpoint scenario including cross-site `403` with no process started
- [x] 5.2 Extend the no-side-effect tests: a scan, discovery and the state endpoint start no `git clone` and no `gh`; a listing starts only `gh repo list`/`gh api user` and writes nothing; a clone changes nothing outside its target folder

## 6. UI

- [ ] 6.1 Add the API calls to `src/ui/api.ts` and a shared `githubClonesState` that polls `GET /api/github/clones` every second only while a job is `cloning`; unit test the start/stop rule
- [ ] 6.2 Add `src/ui/addGithub.tsx`: owner field, list with search, private/archived/last-push, `added` entries not selectable, typed entry with instant validation, root choice (preselected when one) and editable folder name with the full path shown, duplicate-target check, `gh` unavailable/failed messages, Refresh, `clone` and `collect` modes; component tests cover listing, typed entry, refusals and that closing without Clone starts nothing
- [ ] 6.3 On the projects overview: **Add from GitHub** in the header band and empty state (inactive with reason without a root or without git), and `Cloning…` / `clone failed` entries with Retry and Dismiss under Unmanaged projects; extend the overview tests for the project-overview delta scenarios
- [ ] 6.4 In the setup wizard's Workspace step: **Create folder** for missing roots, the `~/Workspace` proposal, Continue inactive without a root, the GitHub repositories list fed by the dialog in `collect` mode, and Continue in the order create folders → save → track → clone with failure/retry handling; the Done step lists created roots and cloned repositories; extend the wizard tests with the setup-wizard delta scenarios

## 7. Demo

- [ ] 7.1 Implement the new operations in `src/ui/demo/demoApi.ts` with fictional repositories (one added, one without OpenSpec, one failing) and in-memory tracking with sample changes; `bun run typecheck` passes and `test/demoApi.test.ts` covers clone, failure, dismiss, workspace folder and reload reset

## 8. Docs and verification

- [ ] 8.1 Update `CLAUDE.md` invariants 1 and 4 (the cloned folder and workspace folder as writes outside tracked repositories, `git clone` as a write subcommand, `gh repo list` as a read-only subcommand, the clone as a network access on the user's action) and `README.md` (Add from GitHub, workspace folder in setup); verify by reading the diff against the dashboard-api delta
- [ ] 8.2 Run `bun run check` and `bun run build`, then verify in `dist/spec-control` with `SPEC_CONTROL_HOME` set to a scratch folder that the wizard creates a workspace folder and that cloning a local bare repository (redirected with `insteadOf`) into it tracks it and its board shows its changes
