# Tasks

## 1. Shared rules

- [x] 1.1 Add `PROJECT_NAME` (plus the `.git`-suffix, `.` and `..` refusals) as an `isProjectName` helper and the `CreateProjectRequest`/`CreateProjectResponse` types to `src/shared/types.ts`; verify with unit cases for valid names, `../x`, `a/b`, `x.git`, `.hidden` and a 101-character name
- [x] 1.2 Add `newProjectUnavailable(config, agents)` to `src/shared/types.ts` (no scan roots → "add a workspace root in Settings", else `integrateUnavailable`); verify with unit tests for each reason and for `undefined` when available

## 2. Server

- [x] 2.1 Add a `gitInit(dir)` runner in `src/server/createProject.ts` — not `src/server/git.ts`, which is read-only by contract, as `createChange.ts` does for its `git add` — (`git init --quiet`, no shell, `GIT_OPTIONAL_LOCKS=0`, redirecting `GIT_*` variables dropped, stderr masked) and verify a temp directory gains `.git` with no commits and no remote
- [x] 2.2 Create `src/server/createProject.ts` with the precondition checks in the design's order, the non-recursive `mkdir` (EEXIST → 409), `gitInit` (failure → 500 with path, folder kept, no agent) and the hand-off to `sessions.openIntegration`; verify with `test/createProject.test.ts` covering success, each refusal creating nothing and starting nothing, a root inside a tracked repository, an ignore path, an existing file/dir/symlink at the target, and two concurrent requests where exactly one succeeds
- [x] 2.3 Route `POST /api/projects` in `src/server/api.ts` behind `crossSiteRefusal`, returning `201 { path, session }`; verify in the test file that a cross-site request gets `403` and creates nothing, and that the returned session is an integration session for the new path
- [x] 2.4 Verify end to end with the fake agent that writing `openspec/config.yaml` in the new folder and ending the session adds the project with `enabled: true` and triggers a scan, and that ending without the marker leaves the config unchanged and `POST /api/discover` lists the folder as integratable
- [x] 2.5 Extend the "writes" test (or add one) proving a project creation leaves every fixture tracked repository byte-for-byte unchanged and that the only git subcommand run is `init`

## 3. UI

- [x] 3.1 Add `createProject(root, name)` to `src/ui/api.ts` and verify it surfaces the server's reason on refusal
- [x] 3.2 Build `src/ui/newProject.tsx`: modal with the root select (preselected with one root), name input with live `isProjectName` validation, the resulting path, **Create**, error display; on success close and `showIntegration(session.id)`; verify manually with `bun run dev` that the integration overlay opens on the new folder
- [x] 3.3 Add **New project** to the overview band's actions next to **Pull all** in `src/ui/overview.tsx` and to the empty state in `src/ui/empty.tsx`, disabled with `newProjectUnavailable` as tooltip and in the accessible name; verify both placements and the disabled reason with agent sessions off and with no workspace root

## 4. Documentation and checks

- [x] 4.1 Update `CLAUDE.md` invariant 1 (and the module list it names) and `README.md` to enumerate the new project folder and `git init`; verify the wording matches the `dashboard-api` delta
- [x] 4.2 Run `bun run check` and `bun run build`, then create a project with `dist/openspec-dashboard` against a temp workspace root to confirm it works in the compiled binary
