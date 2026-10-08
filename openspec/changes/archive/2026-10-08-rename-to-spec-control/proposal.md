## Why

"OpenSpec Dashboard" describes the first version: a board that lists changes. The product now tracks agent sessions, worktrees, pull requests and cleanup across every repository on the machine, and the name undersells that while sounding like an official OpenSpec project. **Spec Control** keeps the link to specs, reads as the place where all agent work is overseen, and pairs with the new tagline: *Spec Control — mission control for every agent change across your repositories. Never miss a change.*

## What Changes

- Product name `OpenSpec Dashboard` becomes `Spec Control` everywhere a person sees it: the hero title, the page title, the onboarding tour, Help, What's new, the demo banner, README, CONTRIBUTING and the agent guide.
- The hero tagline becomes `Mission control for every agent change across your repositories. Never miss a change.`
- The executable becomes `spec-control`: `dist/spec-control`, the CLI usage and startup lines, CI smoke tests, and release assets named `spec-control-<tag>-<platform>`.
- `package.json` name and description change to `spec-control` and the new tagline.
- The GitHub repository is renamed `jwndlng/spec-control`; links to the repository, releases and the demo follow, and the old demo URL redirects.
- A What's new entry announces the new name.
- **Not in this change (follow-up):** local identifiers keep their current names: the home directory `~/.openspec-dashboard/` (config, sessions, worktrees, console folder, backups), the `OPENSPEC_DASHBOARD_HOME` and `OPENSPEC_DASHBOARD_VERSION` variables, browser storage keys `openspec-dashboard.*`, the `openspec-dashboard:shared` markers in repositories' `openspec/config.yaml`, and the `depends-on.yaml` header comment. Renaming those needs a migration and is planned separately.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `kanban-board`: the hero shows `Spec Control` and the new tagline; the mark's accessible name is `Spec Control`.
- `dashboard-api`: the executable is started as `spec-control`.
- `release-publishing`: release assets are named `spec-control-<tag>-<platform>`; `spec-control --version` reports the version.
- `repo-hygiene`: the CI smoke test runs `./dist/spec-control`.

## Impact

- Code: `src/ui/app.tsx` (hero), `src/ui/tourState.ts`, `src/ui/helpContent.tsx`, `src/ui/whatsNew.tsx` and `src/ui/demo/banner.tsx` (URLs), `src/ui/logoMark.ts` (comment), `src/server/index.ts` (usage and startup lines), `scripts/build.ts`, `scripts/build-ui.ts` (page titles), `src/ui/changelog.ts`.
- Build and release: `.github/workflows/ci.yml`, `.github/workflows/release.yml` (artifact names, notes template), `package.json`, `bun.lock`.
- Docs: `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `AGENTS.md`.
- Tests whose expectations contain the product name or binary path.
- GitHub: repository rename; the Pages demo moves to `https://blog.wndlng.ch/spec-control/`.
- Users: download names and the binary name change; existing configuration, sessions and worktrees keep working untouched because the home directory is unchanged.
