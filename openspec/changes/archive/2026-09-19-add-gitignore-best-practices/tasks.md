## 1. Land outstanding work first

> 1.2–1.4: the outstanding work was landed directly on `main` rather than on branches, because the working tree was shared
> by live sessions and switching branches there was unsafe. The repository was later re-created with a single initial
> commit, so no earlier commit ids are referenced here.

- [x] 1.1 Record a baseline: `git ls-files | sort > <scratch>/tracked-before.txt` and the count of tracked files under `test/fixtures/`
- [x] 1.2 Commit the already finished OpenSpec bookkeeping on a branch `chore/archive-completed-changes`: the `kanban-dashboard-mvp` and `discover-on-root-change` archive moves plus `openspec/specs/` (`chore(openspec): archive kanban-dashboard-mvp, discover-on-root-change`)
- [x] 1.3 Ask the user to confirm which uncommitted application work is complete (`discover-on-root-change` code, `add-light-theme`), then commit each on its own `feat/<change-name>` branch with a Conventional Commit message; do not modify that work
- [x] 1.4 Commit the proposals for `dedupe-discovery` and this change (`docs(openspec): add dedupe-discovery`, `docs(openspec): add add-gitignore-best-practices`)

## 2. Ignore, attributes, editor defaults

- [x] 2.1 Rewrite `.gitignore` in commented groups per design D1 (dependencies, build incl. `*.bun-build` and `*.tsbuildinfo`, logs, coverage, env with `!.env.example`, OS, editors with `!.vscode/extensions.json`, `.claude/settings.local.json`)
- [x] 2.2 Remove the stray `.*.bun-build` entries from the repository root
- [x] 2.3 Add `.gitattributes` per design D2
- [x] 2.4 Add `.editorconfig` (root, UTF-8, LF, final newline, 2 spaces; `[*.md] trim_trailing_whitespace = false`)
- [x] 2.5 Verify: `git check-ignore -v` matches nothing under `test/fixtures/`, `openspec/`, `.claude/commands`, `.claude/skills`, nor `bun.lock`; tracked-file list equals the baseline; `git add --renormalize . && git status --short test/fixtures` is empty (otherwise switch fixtures to `-text`)
- [x] 2.6 Verify a clean tree after `bun install && bun test && bun run build`; verify a scratch `.env` is ignored and `.env.example` is not

## 3. Toolchain pin

- [x] 3.1 Add `.bun-version` with `1.4.2`; add `"packageManager": "bun@1.4.2"` and `"engines": { "bun": ">=1.4.0" }` to `package.json`
- [x] 3.2 Replace `"@types/bun": "latest"` with a caret range matching the installed version so installs are reproducible; run `bun install` and commit the lockfile

## 4. Lint, format and the check command

- [x] 4.1 Add `@biomejs/biome` as a dev dependency and `biome.json` per design D4 (formatter settings, recommended rules, `files.ignore` for `dist`, `node_modules`, `test/fixtures`, `openspec`, `src/ui/fonts`, `*.bun-build`)
- [x] 4.2 Add scripts `lint`, `format` and `check` to `package.json`; until task 8.x, `lint` runs `biome lint .` (Biome 2's `check` also enforces import sorting, which is a repo-wide rewrite like formatting)
- [x] 4.3 Run `bun run lint`; fix findings or suppress individually with a reason comment; no blanket rule disabling
- [x] 4.4 Verify `bun run check` fails on a deliberately introduced type error and on a failing test, then passes when reverted

## 5. Continuous integration

- [x] 5.1 Add `.github/workflows/ci.yml` per design D6 (triggers, concurrency, `contents: read`, Ubuntu + macOS matrix, setup-bun with `bun-version-file`, `bun install --frozen-lockfile`, `bun run build:ui`, `bun run check`, `bun run build`, `./dist/openspec-dashboard --help`)
- [x] 5.2 Add `.github/workflows/pr-title.yml` enforcing Conventional Commit PR titles with `pull-requests: read` only and no checkout
- [x] 5.3 Pin every third-party action to a full commit SHA with the version as a trailing comment
- [x] 5.4 Add `.github/dependabot.yml` for `github-actions`, weekly, grouped (the `bun` ecosystem was added and removed again: Dependabot cannot parse `bun.lock` lockfileVersion 2)
- [x] 5.5 Open a pull request and confirm: both matrix jobs pass, the job's `bun --version` equals `.bun-version`, a second push cancels the first run, and a PR titled `update stuff` fails the title check

> 5.5 verified on 2026-09-19: push run on `main` green on Ubuntu and macOS incl. `Verify pinned Bun version`, smoke test and
> clean-tree step; on a verification pull request the title `update stuff` failed `pr-title`, the first `ci` run was cancelled by the second push,
> the second run passed, and the renamed conventional title passed.

## 6. Conventions and agent guidance

- [x] 6.1 Write `CONTRIBUTING.md` per design D7 (branch naming tied to OpenSpec change names, Conventional Commits with `openspec` scope examples, one change per PR, `bun run check` before pushing)
- [x] 6.2 Write `CLAUDE.md` with commands, the OpenSpec workflow used here, and the invariants listed in design D7; add `AGENTS.md` pointing to it
- [x] 6.3 Add a "Contributing" pointer and the `check` command to `README.md`

## 7. Wrap-up of the non-formatting part

- [x] 7.1 Merge groups 2–6 via a pull request titled `chore: repository hygiene, CI and conventions`
- [x] 7.2 Remind the user of the two owner decisions from design Open Questions: choose a `LICENSE`; enable branch protection on `main` requiring `ci` and `pr-title`

> 7.1: groups 2–6 were landed on `main` directly rather than through a pull request.

## 8. One-off reformat (after `dedupe-discovery` and `add-light-theme` are merged)

- [ ] 8.1 Confirm no OpenSpec change with uncommitted application code is in flight (`openspec list`, `git status`)
- [ ] 8.2 On branch `style/biome-format`, run `bun run format`; confirm nothing under `test/fixtures/` or `openspec/` changed; `bun run check` and `bun run build` pass
- [ ] 8.3 Commit as `style: apply biome format`, add the commit SHA to a new `.git-blame-ignore-revs`, and mention `git config blame.ignoreRevsFile` in `CONTRIBUTING.md`
- [ ] 8.4 Switch the `lint` script to full `biome check .` so formatting is enforced by `bun run check` and CI; merge via pull request
