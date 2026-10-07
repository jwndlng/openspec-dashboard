## 1. Visible name and tagline

- [~] 1.1 Hero: title `Spec Control`, tagline `Mission control for every agent change across your repositories. Never miss a change.` (`src/ui/app.tsx`); verify the hero at 1920px and 720px in both themes
- [x] 1.2 Page titles `Spec Control` and `Spec Control — Demo` (`scripts/build-ui.ts`); tour welcome step `Welcome to Spec Control` (`src/ui/tourState.ts`); product name in Help (`src/ui/helpContent.tsx`) and in comments that name the product (`src/ui/logoMark.ts`)
- [x] 1.3 Search `src/` and `scripts/` for any other user-visible `OpenSpec Dashboard`, `openspec-dashboard` or "the dashboard" used as the product name in UI copy, and update it; leave local identifiers untouched (home directory, `OPENSPEC_DASHBOARD_*`, storage keys, shared-config markers, `depends-on.yaml` header)

## 2. Executable and release

- [x] 2.1 Build output `dist/spec-control` (`scripts/build.ts`); CLI usage and startup lines say `spec-control` (`src/server/index.ts`); verify `./dist/spec-control --help` and `--version`
- [x] 2.2 CI smoke test runs `./dist/spec-control` (`.github/workflows/ci.yml`)
- [x] 2.3 Release workflow: build, verify, name, checksum, attest and upload `spec-control-<tag>-<platform>`; the notes template names the new files and verification commands (`.github/workflows/release.yml`); check with `actionlint`
- [x] 2.4 `package.json` name `spec-control` and description from the tagline; refresh `bun.lock`
- [x] 2.5 Repository URLs to `https://github.com/jwndlng/spec-control` (`src/ui/whatsNew.tsx`, `src/ui/demo/banner.tsx`)

## 3. Docs

- [x] 3.1 README: title, opening tagline line plus the OpenSpec Kanban sentence, demo and screenshot URLs under `/spec-control/`, Run section with `spec-control` file names and `gh attestation verify … --repo jwndlng/spec-control`, a note for verifying releases built before the rename
- [x] 3.2 CONTRIBUTING.md and CLAUDE.md/AGENTS.md: product and binary name, demo URL, release asset names; add a note in CLAUDE.md that the home directory, `OPENSPEC_DASHBOARD_*`, storage keys and shared-config markers deliberately keep the old name until the follow-up change

## 4. Tests

- [x] 4.1 Update test expectations that contain the product name or binary path (not the ones about the home directory, markers or storage keys); `bun run check` passes

## 5. Repository, demo and release

- [x] 5.1 After merge, rename the GitHub repository to `jwndlng/spec-control`, update its description and topics (keep `openspec`); confirm the old git remote, a release download URL and an issue URL redirect
- [~] 5.2 Confirm `pages.yml` deploys the demo at `https://blog.wndlng.ch/spec-control/`; add `openspec-dashboard/index.html` to the user-site repository redirecting to the new path with the hash preserved; verify `https://blog.wndlng.ch/openspec-dashboard/#/board` lands on the new board
- [ ] 5.3 Publish the next release; verify assets are `spec-control-<tag>-<platform>`, `gh attestation verify` works with `--repo jwndlng/spec-control`, and check whether a pre-rename release still verifies with the new name (drop the README note if it does)
- [x] 5.4 Write a follow-up OpenSpec change for renaming the local identifiers (home directory with worktree repair, `OPENSPEC_DASHBOARD_*`, storage keys, shared-config markers)

## 6. What's new

- [x] 6.1 Add the What's new entry `2026-10-07-spec-control` (`OpenSpec Dashboard is now Spec Control`: new binary and download names; settings, sessions and worktrees carry over) at the top of `src/ui/changelog.ts`; `test/whatsNew.test.ts` passes
