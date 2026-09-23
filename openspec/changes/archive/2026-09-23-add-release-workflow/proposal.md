# Proposal

## Why

The dashboard is meant to ship as a single binary, but nobody can download one: there are no tags, no releases and no
record of what changed between two builds. Anyone who wants to run it needs Bun and a checkout. The maintainer's other
project already has a release process that works with almost no effort — release notes drafted from merged pull
request titles, a version chosen from their Conventional Commit types, and a workflow that does the rest when the
draft is published — and this repository already enforces the titles that process feeds on.

## What Changes

- **Labels from titles.** Every pull request is labelled from its Conventional Commit type (`feat`, `fix`, `docs`,
  `chore`, …) by release-drafter's autolabeler, running next to the existing title check. No code is checked out.
- **A standing draft release.** Each push to `main` updates one draft GitHub release with release-drafter: the merged
  pull requests grouped under Features, Bug Fixes, Maintenance and Documentation, and a next version resolved from
  their labels (`feat` → minor, everything else → patch, a manually added `major` label → major). The tag is `v<x.y.z>`.
- **Publishing builds the binaries.** When the maintainer publishes the draft, a release workflow builds
  `openspec-dashboard` from the new tag for macOS (arm64, x64) and Linux (x64, arm64) on native runners, smoke-tests
  each binary, and attaches them to the release together with a `SHA256SUMS` file and GitHub build-provenance
  attestations, then appends download and verification instructions to the release notes. A draft or a non-`v` tag
  runs nothing.
- **The binary knows its version.** `openspec-dashboard --version` prints the version it was built as: the release tag
  in a release build, `dev` in any other build. The release job refuses to publish a binary whose `--version` does not
  match the tag.
- **Write scopes, narrowly.** The CI rule that every workflow is read-only gains the three jobs that need to write —
  drafting the release, labelling a pull request, and uploading to a published release — each with only the scopes it
  uses, none of which checks out or runs pull request code.
- **Documented.** `CONTRIBUTING.md` describes how to cut a release; `README.md` points to the downloads.

Adapted, not copied: the source project publishes a Docker image and waits for it before attesting. This project has no
image — the artifacts are the binaries — and its actions stay pinned to full commit SHAs like every other workflow here.

Out of scope: code signing and notarisation of the macOS binary, Windows builds, Homebrew or other package managers, a
changelog file in the repository, and updating `package.json`'s `version` on release.

## Capabilities

### New Capabilities

- `release-publishing`: how pull requests are labelled, how the draft release and its version are maintained, what
  publishing a release builds, verifies and attaches, what the binary reports as its version, and how releasing is
  documented.

### Modified Capabilities

- `repo-hygiene`: the CI requirement's permission rule — today only the Pages deploy job may write — gains the release
  jobs and states exactly which scopes each may hold and on which triggers.

## Impact

- `.github/workflows/draft-release.yml` (new) — release-drafter on pushes to `main`.
- `.github/workflows/release.yml` (new) — build matrix, checksums, attestation, upload, release-notes footer.
- `.github/workflows/pr-title.yml` — a second job running the autolabeler.
- `.github/release-drafter.yml` (new) — categories, version resolver and autolabeler rules.
- `src/server/index.ts` — `--version`, and the version in `--help`.
- `src/server/version.ts` (new) — the build-time version constant with its `dev` fallback.
- `scripts/build.ts` (new) and `package.json` — `bun run build` passes the version to `bun build --compile`; the
  command line stays the same for local builds.
- `.github/workflows/ci.yml` — the smoke test also runs `--version`.
- `test/` — a test for the version constant's fallback and for the CLI flag.
- `CONTRIBUTING.md` (Releasing section), `README.md` (a download line in **Run**). `README.md` is also touched by the
  in-flight `settings-nav-follows-content` (Settings bullet only) and may be reworked by `overhaul-readme`; this change
  adds only a few lines under **Run**.
- `CLAUDE.md` — the build command's note mentions `--version`; the invariants are unchanged (the release runs on
  GitHub, never in the dashboard, and the binary gains no network access).
