# Spec Delta

## MODIFIED Requirements

### Requirement: Continuous integration gates every pull request
A CI workflow SHALL run on pull requests and on pushes to `main`, on Linux and macOS, executing `bun run check`, the single-binary build, the demo build and a smoke invocation of the built binary. A separate workflow SHALL verify that pull request titles follow Conventional Commits. Workflows MUST request only read permissions, with these exceptions, each granted to that job only and to no other job in its workflow:
- the job that deploys the demo site to GitHub Pages MAY request `pages: write` and `id-token: write`, in a workflow that runs only for pushes to `main` or manual dispatch and never for pull requests;
- the job that updates the draft release MAY request `contents: write`, in a workflow that runs only for pushes to `main`;
- the job that labels a pull request from its title MAY request `pull-requests: write`, and MUST NOT check out or execute any code from the pull request;
- the job that attaches binaries to a published release MAY request `contents: write`, `id-token: write` and `attestations: write`, in a workflow that runs only when a release is published; the jobs that build those binaries MUST stay read-only.

Workflows MUST pin third-party actions to a full commit SHA, and automated updates SHALL be configured for the actions. Automated package updates SHALL be added once the update service can read the lockfile format written by the pinned Bun version; until then package updates are manual.

#### Scenario: Broken build blocks the pull request
- **WHEN** a pull request makes `bun run build` fail
- **THEN** the CI workflow reports failure on that pull request

#### Scenario: Broken demo blocks the pull request
- **WHEN** a pull request makes `bun run build:demo` fail
- **THEN** the CI workflow reports failure on that pull request

#### Scenario: Binary smoke test
- **WHEN** the CI build step succeeds
- **THEN** the job runs `./dist/openspec-dashboard --help` and `./dist/openspec-dashboard --version` and fails if either exits non-zero

#### Scenario: Non-conventional title is rejected
- **WHEN** a pull request is titled `update stuff`
- **THEN** the title workflow fails, and a title such as `feat(discovery): ignore paths` passes

#### Scenario: Superseded runs are cancelled
- **WHEN** a second commit is pushed to a pull request while CI is still running for the first
- **THEN** the earlier run is cancelled

#### Scenario: Write scopes are confined to the deploy job
- **WHEN** the workflows are inspected
- **THEN** workflow-level permissions are read-only everywhere, the only jobs declaring a write scope are the Pages deploy, the draft-release update, the pull request labeller and the release upload, each declares only the scopes listed for it, and none of them has a checkout of pull request code

#### Scenario: A pull request cannot reach the release scopes
- **WHEN** a pull request is opened, from this repository or from a fork
- **THEN** no job holding `contents: write`, `id-token: write`, `attestations: write` or `pages: write` runs for it
