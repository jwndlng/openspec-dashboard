# Tasks

## 1. Smoke test

- [x] 1.1 In `.github/workflows/release.yml`, rewrite the `desktop` job's **Smoke test the app** step (D1–D3): unpack the `.tar.zst` payload of the app in the mounted `.dmg` with Bun into `$RUNNER_TEMP`, detach, then require `bin/spec-control` in it and `--version` equal to the tag; keep the signature and layout checks and the copy to `release/`. Verify the YAML parses and, against a local `bun run build:desktop` with `SPEC_CONTROL_VERSION` set, the step passes with that tag and fails with another
- [ ] 1.2 Verify on GitHub's `macos-latest` before merging: a throwaway workflow on this branch builds the binary and the app with a test version and runs the same smoke test; it succeeds. Remove the throwaway workflow before merging
- [x] 1.3 Verify `openspec validate fix-release-flow --strict` and `bun run check` pass

## 2. Release

- [ ] 2.1 After merging, publish the next draft release and confirm the run attaches the four binaries, `Spec-Control-<tag>-darwin-arm64.dmg` and `SHA256SUMS`; decide what to do with the empty `v0.7.0` release
