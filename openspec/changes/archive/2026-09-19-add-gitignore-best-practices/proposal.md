## Why

The repository was bootstrapped in one sitting and has only the four-line `.gitignore` from the MVP: build leftovers (`.*.bun-build`) sit unignored in the root, nothing pins the Bun version the single-binary build depends on, nothing but `tsc` checks the code, and no CI runs the tests. Several OpenSpec changes are now developed in parallel by different agent sessions on one uncommitted `main`, so shared conventions and an automated gate are needed before the next changes land, not after.

## What Changes

- **`.gitignore`** completed and grouped: dependencies, build output and Bun compile temp files (`*.bun-build`), logs, coverage, env files (`.env*` except `.env.example`), OS and editor folders, TypeScript build info, local agent settings (`.claude/settings.local.json`). `bun.lock`, `.claude/commands|skills` and everything under `test/fixtures/` stay tracked.
- **`.gitattributes`**: LF-normalised text, `*.woff2` binary, `bun.lock` and `test/fixtures/**` marked generated/vendored so they collapse in diffs and drop out of language stats.
- **`.editorconfig`**: UTF-8, LF, final newline, 2-space indentation; Markdown keeps trailing whitespace.
- **Pinned toolchain**: `.bun-version` plus `packageManager` in `package.json`; CI installs exactly that version with a frozen lockfile.
- **One check command**: Biome for lint + format, and `bun run check` = Biome check + `tsc --noEmit` + `bun test`. The one-off reformat lands as its own commit after the in-flight changes, to avoid conflicts.
- **CI (GitHub Actions)**: `bun run check`, the binary build and a `--help` smoke run on Ubuntu and macOS for pushes to `main` and pull requests; a PR-title workflow enforcing Conventional Commits; Dependabot for the actions (Bun packages once Dependabot can read Bun 1.4 lockfiles). Workflows use read-only permissions and SHA-pinned actions.
- **Conventions written down**: `CONTRIBUTING.md` (branch `feat/<openspec-change-name>` so the dashboard's own branch matching works on itself, Conventional Commits with an `openspec` scope for proposals and archives, one change per PR) and `CLAUDE.md` with an `AGENTS.md` pointer recording the project invariants agents must keep (read-only towards tracked repos, loopback-only server, library access only through `openspecAdapter.ts`, single-file UI build, no network at runtime).
- Non-goals: choosing a `LICENSE`, git hooks, release automation, changing application behaviour.

## Capabilities

### New Capabilities
- `repo-hygiene`: what the repository guarantees about itself — what is never tracked, how text and vendored files are treated, the pinned toolchain, the single check command, the CI gate, and the documented contribution and agent conventions.

### Modified Capabilities
<!-- none — no application behaviour changes -->

## Impact

- New files: `.gitattributes`, `.editorconfig`, `.bun-version`, `biome.json`, `.github/workflows/ci.yml`, `.github/workflows/pr-title.yml`, `.github/dependabot.yml`, `CONTRIBUTING.md`, `CLAUDE.md`, `AGENTS.md`. Modified: `.gitignore`, `package.json` (scripts, `packageManager`, `@biomejs/biome` dev dependency), `README.md` (contributing pointer).
- A single formatting commit will touch most of `src/`, `test/*.ts` and `scripts/`; it is sequenced after `dedupe-discovery` and `add-light-theme` are merged. Fixtures, `openspec/` and `dist/` are excluded from Biome.
- CI minutes on GitHub for two runners per push/PR. No runtime, API or data changes; the compiled binary is unaffected.
