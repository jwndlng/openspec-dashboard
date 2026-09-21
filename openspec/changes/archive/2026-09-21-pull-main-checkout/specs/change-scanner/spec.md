## ADDED Requirements

### Requirement: The default branch and whether the main checkout is on it are reported
For each successfully scanned git repository the scanner SHALL report `defaultBranch` — the branch that `refs/remotes/origin/HEAD` points to, or, when that ref does not exist, `main` if such a local branch exists, otherwise `master` if it exists — and `onDefaultBranch`, which is `true` when the main checkout's current branch is that branch and `false` otherwise, including when HEAD is detached. When no default branch can be determined both SHALL be omitted. Determining them MUST use only read-only git commands and MUST NOT contact a remote, and a failure to determine them MUST NOT fail the repository's scan. When a repository's scan fails, the previous values SHALL be retained.

#### Scenario: On the default branch
- **WHEN** `origin/HEAD` points to `origin/main` and the main checkout is on `main`
- **THEN** the repository reports `defaultBranch: "main"` and `onDefaultBranch: true`

#### Scenario: On a feature branch
- **WHEN** `origin/HEAD` points to `origin/main` and the main checkout is on `feat/redesign`
- **THEN** the repository reports `defaultBranch: "main"` and `onDefaultBranch: false`

#### Scenario: Default branch is not called main
- **WHEN** `origin/HEAD` points to `origin/trunk` and the main checkout is on `trunk`
- **THEN** the repository reports `defaultBranch: "trunk"` and `onDefaultBranch: true`

#### Scenario: No origin/HEAD
- **WHEN** the repository has no `refs/remotes/origin/HEAD`, a local branch `master` and no `main`, and the checkout is on `develop`
- **THEN** the repository reports `defaultBranch: "master"` and `onDefaultBranch: false`

#### Scenario: Detached HEAD
- **WHEN** the main checkout has a detached HEAD
- **THEN** `onDefaultBranch` is `false`

#### Scenario: Cannot tell
- **WHEN** the repository has no `origin/HEAD` and neither a `main` nor a `master` branch
- **THEN** neither field is reported and the scan succeeds
