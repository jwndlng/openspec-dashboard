# Tasks

## 1. The binary knows its version

- [x] 1.1 Add `src/server/version.ts` exporting `VERSION`: the `--define`d global `OPENSPEC_DASHBOARD_BUILD_VERSION`
      when it is a string, else `"dev"` (declared for TypeScript, read behind `typeof` so `bun run` does not throw).
      Verify with a test in `test/version.test.ts` that `VERSION` is `"dev"` under `bun test`.
- [x] 1.2 Handle `--version` in `parseArgs` in `src/server/index.ts` next to `--help`: print `VERSION`, exit 0, before
      `loadConfig`; add `--version` to the usage line. Verify with a test that spawns `bun run src/server/index.ts
      --version` with `OPENSPEC_DASHBOARD_HOME` set to an empty temp dir and asserts stdout `dev`, exit 0, and that the
      temp dir is still empty; and that `--help` output mentions `--version`.
- [x] 1.3 Add `scripts/build.ts` running the current compile command (`bun build --compile src/server/index.ts --outfile
      dist/openspec-dashboard`) with `--define OPENSPEC_DASHBOARD_BUILD_VERSION='"<v>"'`, `<v>` from
      `$OPENSPEC_DASHBOARD_VERSION` or `dev`, then removing `.*.bun-build`; point `package.json` `build` at
      `build:ui` + this script. Verify: `bun run build && ./dist/openspec-dashboard --version` prints `dev`;
      `OPENSPEC_DASHBOARD_VERSION=v9.9.9 bun run build && ./dist/openspec-dashboard --version` prints `v9.9.9`;
      `git status --porcelain` is empty afterwards.
- [x] 1.4 Add `./dist/openspec-dashboard --version` to the smoke-test step in `.github/workflows/ci.yml`. Verify by
      reading the workflow and by CI passing on the pull request.

## 2. Labels and the draft release

- [x] 2.1 Add `.github/release-drafter.yml`: `name-template`/`tag-template` `v$RESOLVED_VERSION`, the source's
      template, `change-template` and `change-title-escapes`, the four categories (Maintenance including `build`), the
      version resolver (`major` → major, `feat` → minor, default patch) and `autolabeler` rules mapping each title type
      (with optional scope and `!`) to its label. Verify each title in the release-publishing spec's labelling scenarios
      against the regexes (e.g. a quick `bun -e` loop) and that the file parses as YAML.
- [x] 2.2 Add a `label` job to `.github/workflows/pr-title.yml` running `release-drafter/release-drafter/autolabeler`
      pinned to the v7 release SHA, with job-level `permissions: pull-requests: write`, `timeout-minutes`, and no
      checkout; leave the workflow-level permissions read-only. Verify by reading the workflow against the repo-hygiene
      write-scope scenario and, after merge, that the next PR gets its label (`pull_request_target` runs the base
      branch's workflow and config, so this change's own PR is not labelled).
- [x] 2.3 Add `.github/workflows/draft-release.yml`: on push to `main`, workflow permissions `contents: read`, one job
      with `contents: write` and `pull-requests: read` running `release-drafter/release-drafter` at the same SHA,
      `concurrency: { group: draft-release, cancel-in-progress: false }`. Verify by reading it and, after merge, that a
      draft `v0.1.0` exists under Releases.

## 3. Publishing builds and attaches the binaries

- [x] 3.1 Add `.github/workflows/release.yml`, trigger `release: types: [published]`, workflow permissions
      `contents: read`, guarded by `!github.event.release.draft && startsWith(github.event.release.tag_name, 'v')`.
      `build` job: matrix of the four runner/platform pairs from design.md, checkout of the tag with
      `persist-credentials: false`, setup-bun from `.bun-version`, `bun install --frozen-lockfile`,
      `OPENSPEC_DASHBOARD_VERSION=<tag> bun run build`, `--help` must succeed, `--version` must equal the tag, rename to
      `openspec-dashboard-<tag>-<platform>`, `upload-artifact`. Verify with `actionlint` if available, otherwise by
      reading it against the spec's scenarios.
- [x] 3.2 Add the `publish` job (`needs: build`, permissions `contents: write`, `id-token: write`,
      `attestations: write`, no checkout): download the four artifacts, write `SHA256SUMS`, run
      `actions/attest-build-provenance` with `subject-path` over the binaries, `gh release upload <tag> --repo …`, then
      append the Download section (file names, `shasum -a 256 -c --ignore-missing SHA256SUMS`,
      `gh attestation verify`, macOS `xattr` hint) unless the body already contains its heading. Pass the tag and repo
      through `env:`, never interpolated into `run:`. Verify by reading it and in the first release (4.2).
- [x] 3.3 Pin every new action to a full commit SHA with its version in a comment, matching the existing workflows.
      Verify with `grep -n 'uses:' .github/workflows/*.yml` showing only 40-character SHAs.

## 4. Documentation and first release

- [x] 4.1 Add a Releasing section to `CONTRIBUTING.md` (labels from titles, draft on every merge, version rules, `major`
      label, publishing is the only manual step, what publishing produces) and a short download paragraph to the
      **Run** section of `README.md` (releases link, checksum and attestation check, macOS quarantine note); mention
      `--version` next to the build command in `CLAUDE.md`. Verify the scenarios under "Releasing is documented" by
      reading the result, and `bun run check` passes.
- [ ] 4.2 After merge (maintainer): confirm the draft `v0.1.0`, tidy its uncategorised entries, publish it, and check
      that four binaries, `SHA256SUMS`, attestations and the Download section appear, and that a downloaded binary's
      `--version` prints `v0.1.0`.
