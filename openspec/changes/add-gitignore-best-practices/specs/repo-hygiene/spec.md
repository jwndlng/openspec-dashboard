## ADDED Requirements

### Requirement: Generated and local-only files are never tracked
The repository SHALL ignore dependencies (`node_modules/`), build output (`dist/`, `*.bun-build`, `*.tsbuildinfo`), logs, coverage output, environment files (`.env` and `.env.*` except `.env.example`), OS and editor metadata, and local agent settings (`.claude/settings.local.json`). The ignore rules MUST NOT match the lockfile (`bun.lock`), anything under `test/fixtures/`, `openspec/`, `.claude/commands/` or `.claude/skills/`.

#### Scenario: Clean tree after a full local cycle
- **WHEN** a contributor runs `bun install`, `bun run check` and `bun run build` on a clean checkout
- **THEN** `git status --porcelain` is empty

#### Scenario: Secrets cannot be added by accident
- **WHEN** a file named `.env` or `.env.local` exists in the repository root
- **THEN** `git status` does not list it, while `.env.example` would be listed

#### Scenario: Fixtures stay tracked
- **WHEN** the ignore rules are evaluated against every file under `test/fixtures/`
- **THEN** `git check-ignore` matches none of them and the number of tracked fixture files is unchanged

### Requirement: Text, binary and vendored files are declared
The repository SHALL declare via `.gitattributes` that text files are normalised to LF, that `*.woff2` is binary, that `bun.lock` is generated, and that `test/fixtures/**` is vendored. Applying these attributes MUST NOT change the content of any fixture file.

#### Scenario: Renormalisation is a no-op for fixtures
- **WHEN** `git add --renormalize .` is run after adding `.gitattributes`
- **THEN** no file under `test/fixtures/` shows as modified

#### Scenario: Fonts are treated as binary
- **WHEN** a font file under `src/ui/fonts/` changes
- **THEN** git reports a binary change rather than a text diff

### Requirement: Editor defaults are shared
The repository SHALL provide an `.editorconfig` setting UTF-8, LF line endings, a final newline and 2-space indentation for source files, and preserving trailing whitespace in Markdown.

#### Scenario: New file follows the defaults
- **WHEN** a contributor creates a new `.ts` file in an EditorConfig-aware editor
- **THEN** it is indented with 2 spaces, uses LF and ends with a newline

### Requirement: The toolchain version is pinned
The repository SHALL pin the Bun version in `.bun-version` and in `package.json` `packageManager`, and CI MUST install exactly that version and install dependencies with a frozen lockfile. Changing the pinned version SHALL be an explicit commit, not an automated dependency bump.

#### Scenario: CI uses the pinned version
- **WHEN** the CI workflow runs
- **THEN** `bun --version` in the job equals the content of `.bun-version`

#### Scenario: Lockfile drift fails the build
- **WHEN** `package.json` declares a dependency that `bun.lock` does not contain
- **THEN** the CI install step fails

### Requirement: A single command verifies the project
`bun run check` SHALL run linting (and, once the code base has been formatted, format verification), type checking and the test suite, and SHALL exit non-zero if any of them fails. Lint and format tooling MUST exclude `dist/`, `node_modules/`, `test/fixtures/`, `openspec/` and bundled fonts.

#### Scenario: Type error fails the check
- **WHEN** a source file contains a type error
- **THEN** `bun run check` exits non-zero

#### Scenario: Failing test fails the check
- **WHEN** any test fails
- **THEN** `bun run check` exits non-zero

#### Scenario: Fixtures are not linted or formatted
- **WHEN** `bun run format` is run
- **THEN** no file under `test/fixtures/` or `openspec/` is modified

### Requirement: Continuous integration gates every pull request
A CI workflow SHALL run on pull requests and on pushes to `main`, on Linux and macOS, executing `bun run check`, the single-binary build and a smoke invocation of the built binary. A separate workflow SHALL verify that pull request titles follow Conventional Commits. Workflows MUST request only read permissions, MUST pin third-party actions to a full commit SHA, and automated updates SHALL be configured for the actions. Automated package updates SHALL be added once the update service can read the lockfile format written by the pinned Bun version; until then package updates are manual.

#### Scenario: Broken build blocks the pull request
- **WHEN** a pull request makes `bun run build` fail
- **THEN** the CI workflow reports failure on that pull request

#### Scenario: Binary smoke test
- **WHEN** the CI build step succeeds
- **THEN** the job runs `./dist/openspec-dashboard --help` and fails if it exits non-zero

#### Scenario: Non-conventional title is rejected
- **WHEN** a pull request is titled `update stuff`
- **THEN** the title workflow fails, and a title such as `feat(discovery): ignore paths` passes

#### Scenario: Superseded runs are cancelled
- **WHEN** a second commit is pushed to a pull request while CI is still running for the first
- **THEN** the earlier run is cancelled

### Requirement: Contribution and agent conventions are documented
The repository SHALL contain `CONTRIBUTING.md` describing branch naming (`feat/<openspec-change-name>`, `fix/…`, `chore/…`), Conventional Commits including the `openspec` scope for proposals and archives, one OpenSpec change per pull request, and running `bun run check` before pushing. It SHALL contain `CLAUDE.md` stating the project commands and the invariants agents must preserve — read-only behaviour towards tracked repositories with the read-only git allow-list, loopback-only binding, access to `@fission-ai/openspec` internals only through `src/server/openspecAdapter.ts`, a self-contained UI without runtime network access, state confined to `~/.openspec-dashboard/`, and staying within a change's declared Impact when sessions run in parallel — and an `AGENTS.md` that points to `CLAUDE.md`.

#### Scenario: Branch name matches the change
- **WHEN** a contributor starts implementing the OpenSpec change `dedupe-discovery`
- **THEN** the documented branch name is `feat/dedupe-discovery`, which the dashboard's branch matching associates with that change

#### Scenario: Agent finds the invariants
- **WHEN** an agent session opens the repository
- **THEN** `CLAUDE.md` (or `AGENTS.md` pointing to it) lists the invariants and the `dev`, `check` and `build` commands
