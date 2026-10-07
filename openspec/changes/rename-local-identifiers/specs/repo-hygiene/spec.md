## MODIFIED Requirements

### Requirement: Contribution and agent conventions are documented
The repository SHALL contain `CONTRIBUTING.md` describing branch naming (`feat/<openspec-change-name>`, `fix/…`, `chore/…`), Conventional Commits including the `openspec` scope for proposals and archives, one OpenSpec change per pull request, and running `bun run check` before pushing. It SHALL contain `CLAUDE.md` stating the project commands and the invariants agents must preserve — read-only behaviour towards tracked repositories with the read-only git allow-list, loopback-only binding, access to `@fission-ai/openspec` internals only through `src/server/openspecAdapter.ts`, a self-contained UI without runtime network access, state confined to `~/.spec-control/`, and staying within a change's declared Impact when sessions run in parallel — and an `AGENTS.md` that points to `CLAUDE.md`.

#### Scenario: Branch name matches the change
- **WHEN** a contributor starts implementing the OpenSpec change `dedupe-discovery`
- **THEN** the documented branch name is `feat/dedupe-discovery`, which the dashboard's branch matching associates with that change

#### Scenario: Agent finds the invariants
- **WHEN** an agent session opens the repository
- **THEN** `CLAUDE.md` (or `AGENTS.md` pointing to it) lists the invariants and the `dev`, `check` and `build` commands
