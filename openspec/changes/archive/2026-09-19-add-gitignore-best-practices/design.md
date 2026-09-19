## Context

State on 2026-09-19: one commit on `main`, remote `a private GitHub repository`, Bun 1.4.2, global OpenSpec CLI 1.3.1. The working tree holds uncommitted work from several sessions (the `kanban-dashboard-mvp` archive, `discover-on-root-change`, `add-light-theme`), and `dedupe-discovery` is proposed but not applied. `.gitignore` has four lines; three empty `.*.bun-build` temp entries from `bun build --compile` are in the root and not covered by any rule. There is no formatter, linter, CI or contributor/agent guidance. The author's other repositories (e.g. `beta-soc`) already use Conventional Commits, `feat/<change>` branches merged by pull request, `CLAUDE.md`, and lint/test/PR-title workflows — this change mirrors those rather than inventing new conventions.

Constraints: most tracked files are Markdown test fixtures that must stay byte-identical (scanner tests assert on them). The UI build inlines fonts and must stay offline. Other sessions are editing `src/ui/app.tsx`, `src/ui/styles.css`, `scripts/build-ui.ts` and the discovery code.

## Goals / Non-Goals

**Goals:**
- A clean `git status` after install, test and build, with nothing sensitive or generated trackable by accident.
- Reproducible toolchain and one command that answers "is this OK to merge?", run identically locally and in CI.
- Conventions short enough that an agent session reads and follows them.

**Non-Goals:**
- `LICENSE` choice, release/publishing automation, git hooks, coverage thresholds, changing application code beyond formatting.

## Decisions

### D1 — `.gitignore`: explicit groups, negations for what must stay tracked
Groups: dependencies (`node_modules/`), build (`dist/`, `*.bun-build`, `*.tsbuildinfo`), logs (`*.log`), test output (`coverage/`), secrets (`.env`, `.env.*`, `!.env.example`), OS (`.DS_Store`, `Thumbs.db`), editors (`.idea/`, `.vscode/*`, `!.vscode/extensions.json`), local agent state (`.claude/settings.local.json`). Patterns are anchored or specific enough not to match fixture content; a task verifies `git ls-files test/fixtures | wc -l` is unchanged and `git check-ignore` reports nothing under `test/fixtures/`, `openspec/` or `.claude/commands|skills`. `bun.lock` stays tracked (text lockfile, needed for `--frozen-lockfile`).
*Alternative*: a generated template (gitignore.io "Node") — rejected, 100+ irrelevant lines hide the few that matter.

### D2 — `.gitattributes`
`* text=auto eol=lf`; `*.woff2 binary`; `bun.lock linguist-generated=true -diff`; `test/fixtures/** linguist-vendored=true`. No `-diff` on fixtures: fixture changes are rare and worth reading. No `eol` override is needed for fixtures because they are already LF (task verifies `git add --renormalize .` produces no fixture changes; if it does, fixtures get `-text`).

### D3 — Pin Bun in two places
`.bun-version` (`1.4.2`, read by `oven-sh/setup-bun` via `bun-version-file` and by version managers) and `"packageManager": "bun@1.4.2"` in `package.json` (read by Corepack-aware tools and humans). `engines.bun` is set to `>=1.4.0` to fail early. Dependabot does not bump `.bun-version`; upgrading Bun is a deliberate commit because `--compile` and text-import behaviour are version-sensitive (see `kanban-dashboard-mvp` D1).

### D4 — Biome for lint + format; reformat last, as one commit
Biome is a single dev dependency covering TS, TSX, JSON and CSS with no plugin tree — fitting a "lightweight" tool. Config: 2 spaces, LF, double quotes, semicolons, trailing commas, `lineWidth: 160` (the code was written with long lines; 160 minimises churn), recommended lint rules, `noExplicitAny` on. `files.ignore`: `dist`, `node_modules`, `test/fixtures`, `openspec`, `src/ui/fonts`, `*.bun-build`.
Sequencing: config and scripts land first with `biome check` in *lint-only* mode in CI (`--formatter-enabled=false`). The repo-wide `biome format --write` is the last task, done on a fresh branch after `dedupe-discovery` and `add-light-theme` are merged, as a single `style:` commit listed in `.git-blame-ignore-revs`; the same PR flips CI to full `biome check`.
*Alternatives*: ESLint + Prettier (two tools, many transitive deps); `tsc` only (status quo, catches no unused code or hook mistakes).

### D5 — `bun run check` is the single gate
`"lint": "biome check ."`, `"format": "biome format --write ."`, `"check": "bun run lint && bun run typecheck && bun test"`. CI calls `bun run check` and nothing else for verification, so local and CI results cannot diverge.

### D6 — GitHub Actions
`ci.yml`: triggers `push` to `main` and `pull_request`; `concurrency` cancels superseded runs; `permissions: contents: read`; matrix `ubuntu-latest`, `macos-latest` (macOS covers the case-insensitive file-system tests from `dedupe-discovery` and is the author's platform). Steps: checkout → setup-bun (`bun-version-file: .bun-version`) → `bun install --frozen-lockfile` → `bun run build:ui` (the server entry imports `dist/ui/index.html`, so typecheck and tests that touch it need the UI built) → `bun run check` → `bun run build` → `./dist/openspec-dashboard --help`. Tests already use temp `OPENSPEC_DASHBOARD_HOME` and the in-repo fixtures, so they need no network or home directory.
`pr-title.yml`: `amannn/action-semantic-pull-request` on `pull_request_target` with `permissions: pull-requests: read`, types `feat, fix, docs, chore, refactor, test, style, ci, build, perf`, optional scopes. Squash-merge makes the PR title the commit subject, so checking titles is sufficient.
All third-party actions are pinned to a full commit SHA with the version in a trailing comment; `dependabot.yml` (ecosystem `github-actions`, weekly, grouped) keeps the actions current. The `bun` ecosystem was configured first and removed again: Dependabot's parser rejects `bun.lock` `lockfileVersion: 2` (written by Bun 1.4) with "supports up to 1", so the job failed on every run; packages are updated manually with `bun update` until that is supported.
*Alternative*: single Ubuntu runner — cheaper, but the two real bugs so far (compiled-binary schema lookup, case-insensitive paths) were platform/packaging specific.

### D7 — Conventions: `CONTRIBUTING.md` for humans, `CLAUDE.md` for agents, `AGENTS.md` as pointer
`CONTRIBUTING.md` (≤ 1 page): branch per OpenSpec change named `feat/<change-name>` (or `fix/`, `chore/`) — the dashboard's `branchMatch` then lights up for this repo too; Conventional Commits; `docs(openspec): add <change>` for proposals and `chore(openspec): archive <change>` for archives; one change per PR; run `bun run check` before pushing; never commit to `main` directly once CI exists.
`CLAUDE.md`: commands (`dev`, `check`, `build`), the OpenSpec workflow in this repo, and the invariants that reviews have already had to defend: read-only towards tracked repositories and the read-only git allow-list; bind `127.0.0.1` only; `@fission-ai/openspec` internals only via `src/server/openspecAdapter.ts`; UI ships as one self-contained `index.html` with no runtime network access; all state under `~/.openspec-dashboard/`; when several sessions work in parallel, stay inside the files your change's proposal lists under Impact. `AGENTS.md` contains one line pointing to `CLAUDE.md` so other agent CLIs find the same text without duplication.

### D8 — Land outstanding work before adding the gate
The first task group commits what is already finished but uncommitted, on branches following D7, so that CI's first run is against a coherent tree and the final reformat has nothing to conflict with. Work belonging to other sessions is committed only after the user confirms it is complete; this change does not modify that work.

## Risks / Trade-offs

- [Reformat conflicts with in-flight changes] → formatting is the last task, gated on those changes being merged; until then CI lints without formatting.
- [A new ignore pattern silently hides a needed file] → verification task compares `git ls-files` before/after and runs `git check-ignore -v` over fixtures, `openspec/` and `.claude/`.
- [`text=auto eol=lf` rewrites fixtures] → `--renormalize` dry run in tasks; fall back to `test/fixtures/** -text`.
- [macOS runners are slower and cost 10× minutes on private repos] → jobs are short (< 2 min); drop to Ubuntu-only plus a weekly macOS run if minutes become a concern.
- [`pull_request_target` runs with base-repo context] → the workflow checks the title only, checks out no code, and has `pull-requests: read` only.
- [Biome's recommended rules flag existing code] → fix or locally suppress with a reason in the same PR as the config; no blanket rule disabling.

## Migration Plan

1. Land outstanding work (D8). 2. Ignore/attributes/editorconfig/version pin — no behaviour change, safe alone. 3. Biome config + scripts + CI (lint-only formatting). 4. Docs. 5. After `dedupe-discovery` and `add-light-theme` merge: format commit + `.git-blame-ignore-revs` + flip CI to full check. Rollback of any step is a plain revert; nothing affects the shipped binary.

## Open Questions

- `LICENSE`: the repo is on GitHub without one. MIT would match OpenSpec and Fusion; left to the owner.
- Finding (2026-09-19): GitHub answers `403 Upgrade to GitHub Pro or make this repository public` for branch protection on this private repository, so the gate is advisory until the plan or visibility changes.
- Enable branch protection on `main` (require `ci` and `pr-title`) once the workflows have run green — a repository setting, not a file, so not part of this change's tasks beyond a reminder.
