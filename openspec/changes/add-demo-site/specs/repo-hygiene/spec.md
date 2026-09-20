## MODIFIED Requirements

### Requirement: Continuous integration gates every pull request
A CI workflow SHALL run on pull requests and on pushes to `main`, on Linux and macOS, executing `bun run check`, the single-binary build, the demo build and a smoke invocation of the built binary. A separate workflow SHALL verify that pull request titles follow Conventional Commits. Workflows MUST request only read permissions, with one exception: the job that deploys the demo site to GitHub Pages MAY request `pages: write` and `id-token: write`, and those scopes MUST be granted to that job only, in a workflow that runs only for pushes to `main` or manual dispatch and never for pull requests. Workflows MUST pin third-party actions to a full commit SHA, and automated updates SHALL be configured for the actions. Automated package updates SHALL be added once the update service can read the lockfile format written by the pinned Bun version; until then package updates are manual.

#### Scenario: Broken build blocks the pull request
- **WHEN** a pull request makes `bun run build` fail
- **THEN** the CI workflow reports failure on that pull request

#### Scenario: Broken demo blocks the pull request
- **WHEN** a pull request makes `bun run build:demo` fail
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

#### Scenario: Write scopes are confined to the deploy job
- **WHEN** the workflows are inspected
- **THEN** only the Pages deploy job declares write permissions, its workflow has no `pull_request` trigger, and every other job and workflow is read-only
