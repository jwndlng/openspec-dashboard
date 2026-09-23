# Design

## Context

The source process (the maintainer's other project) is three workflows and one config file: a PR-title check that also
labels via `action-runner/conventional-labeler`, `release-drafter` on every push to `main` with a
`draft-release-config.yml`, and a `release: published` workflow that waits for a Docker image, attests it and appends
`docker pull` lines to the notes. This repository already has a title check (`pr-title.yml`, read-only,
`pull_request_target`), SHA-pinned actions with Dependabot, a CI matrix that builds and smoke-tests the binary, and a
repo-hygiene rule that only the Pages deploy may write. There are no tags or releases yet, and `bun run build` produces
an unversioned `dist/openspec-dashboard`.

## Goals / Non-Goals

**Goals:**
- Keep the source's shape — labels from titles, one standing draft, publishing is the only manual step — so the two
  projects release the same way.
- Every write scope sits on one small job that runs no untrusted code.

**Non-Goals:**
- Cross-compiling from one runner, signing, notarising, a `CHANGELOG.md`, bumping `package.json`.

## Decisions

**Labelling: release-drafter's autolabeler, not `conventional-labeler`.** release-drafter v7 ships an `autolabeler`
sub-action (`release-drafter/release-drafter/autolabeler@<sha>`) that reads `autolabeler:` rules from the same config
file the drafter reads. One third-party project instead of two, one config for "what label means what", and the rules
are plain title regexes (`/^feat(\(.+\))?!?:/`). It runs as a second job in `pr-title.yml` with
`pull-requests: write`; the workflow keeps `pull_request_target` (fork PRs need a token that can label) and neither job
checks out code. Missing labels are created by GitHub on first use, so no label setup step. *Alternative:* copy
`conventional-labeler` verbatim — rejected, it duplicates the type list in a second action and is a smaller, less
maintained project to hand a write token to.

**Config at `.github/release-drafter.yml`.** The default path of both sub-actions, so no `config-name` input. Content is
the source's categories and version resolver, with `build` added to Maintenance (this repo's title check allows it), the
source's `name-template`/`tag-template` `v$RESOLVED_VERSION`, and `change-template` `- $TITLE @$AUTHOR (#$NUMBER)`.
Pre-existing unlabelled PRs land in the uncategorised list; the first draft is expected to be tidied by hand.

**First version.** With no prior release, release-drafter resolves from `0.0.0`, so the first draft is `v0.1.0` (there
are `feat` PRs), matching `package.json`'s `0.1.0`. Nothing to seed.

**Release workflow: build matrix read-only, one publish job writes.**
```
release: published ──if !draft && tag starts with v──▶ build (matrix, contents: read)
   ubuntu-latest→linux-x64  ubuntu-24.04-arm→linux-arm64  macos-latest→darwin-arm64  macos-15-intel→darwin-x64
     checkout tag · setup-bun (.bun-version) · bun install --frozen-lockfile
     OPENSPEC_DASHBOARD_VERSION=<tag> bun run build
     --help ok · --version == tag · rename → openspec-dashboard-<tag>-<platform> · upload-artifact
                     │ all four succeeded
                     ▼
publish (contents: write, id-token: write, attestations: write)
     download-artifact · sha256sum > SHA256SUMS · attest-build-provenance (subject-path: binaries)
     gh release upload <tag> … · gh release edit --notes-file (append Download section)
```
Native runners rather than `bun build --target=…` cross-compilation: every binary gets executed before it is attached,
which is the only check that catches a platform-specific failure (the PTY support, embedded text imports). The publish
job never checks out the repository — it only needs artifacts and `gh` with `--repo`. `needs:` on the whole matrix
gives "one platform fails → nothing attached" for free. The source's image-wait loop and `docker/login` disappear.

**Version injection.** `src/server/version.ts` exports `VERSION`, backed by a `--define`d global
(`OPENSPEC_DASHBOARD_BUILD_VERSION`) read behind `typeof … === "string"` so `bun run dev` and tests get `"dev"` without a
ReferenceError. `scripts/build.ts` replaces the inline `bun build --compile …` in `package.json`: it runs the same
command with `--define OPENSPEC_DASHBOARD_BUILD_VERSION='"<v>"'`, where `<v>` is `$OPENSPEC_DASHBOARD_VERSION` or `dev`,
and removes the `.*.bun-build` droppings as today. One build path for CI, release and local use; the release only sets
an environment variable. *Alternative:* read `package.json`'s version — rejected, it would need a bump commit per
release, which the source process avoids. *Alternative:* `git describe` at build time — rejected, it makes a local build
depend on tags and breaks in shallow checkouts.

`--version` is handled in `parseArgs` next to `--help` and exits before `loadConfig`, so it touches nothing on disk.

**Release-notes footer.** Appended by the publish job, like the source's Docker section: a table-free list of the four
file names, `shasum -a 256 -c --ignore-missing SHA256SUMS`, `gh attestation verify <file> --repo <owner>/<repo>`, and the
macOS `xattr -d com.apple.quarantine` hint. Re-running the job would append twice; the step first checks whether the
body already contains the heading and skips if so.

**Pins.** Every new action (`release-drafter`, its `autolabeler`, `actions/upload-artifact`, `actions/download-artifact`,
`actions/attest-build-provenance`, plus the already-pinned checkout and setup-bun) is pinned to a full SHA with the
version in a comment. Dependabot's existing `github-actions` entry picks them up.

## Risks / Trade-offs

- [`macos-15-intel` is GitHub's last Intel image and will be retired] → when it goes, build `darwin-x64` on
  `macos-latest` with `--target=bun-darwin-x64` and run it under Rosetta for the smoke test; documented in the workflow.
- [macOS binaries are unsigned, so Gatekeeper blocks a double-clicked download] → README states it and gives the
  `xattr` command; notarisation is a separate change.
- [Publishing a draft with a hand-edited, non-`v` tag] → the workflow's `if:` skips it; the release simply has no
  binaries, visible at a glance.
- [A write-scoped job on `pull_request_target`] → the labeller checks out nothing and runs only a pinned action reading
  the title from the event payload; same trust model as the existing title check.
- [release-drafter runs on every push to `main`, concurrently] → `concurrency: draft-release` with
  `cancel-in-progress: false` so two merges in a row do not race on the draft.

## Migration Plan

Merge, then check that the next PR is labelled and that the draft appears after its merge. Label the already-open PRs
by editing their titles (or leave them uncategorised), tidy the first draft, publish `v0.1.0`, and confirm four binaries,
`SHA256SUMS` and the footer appear. Rollback is deleting the three workflow additions; a published release can be
deleted by hand.
