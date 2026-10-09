# Proposal

## Why

Publishing `v0.7.0` built and verified all four binaries, but the `desktop` job failed its smoke test with "no bundled
spec-control binary under desktop/build", so the publish job never ran and the release went out with nothing attached
(run 37917618784). `v0.7.0` was the first release with the `desktop` job, and the test had never run before: it looks
for `bin/spec-control` under `desktop/build/`, but `electrobun build --env=stable` replaces the app there with its
self-extracting wrapper — a `launcher` and a zstd-compressed tarball of the real app — so the bundled binary is never a
plain file under `desktop/build/` and the step fails for every release.

## What Changes

- The `desktop` job's smoke test reads the bundled binary from what is shipped: it mounts the disk image (as it already
  does for the signature and layout checks), unpacks the wrapper's `.tar.zst` payload from the app in it into the
  runner's temp directory, and runs the `bin/spec-control` it finds there with `--version`, which must print exactly the
  tag. The payload is decompressed with Bun, which the job already sets up, because macOS's `tar` needs a separate
  `zstd` program to read it.
- The signature and installer-layout checks, the artifact name and the publish job are unchanged.
- `v0.7.0` itself cannot be repaired by re-running its workflow: a `release` event runs the workflow file of the tag's
  commit. Shipping the fix needs a new release from the draft once this is merged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. `release-publishing` already requires that "the binary inside the app MUST likewise print exactly the release
tag"; the workflow did not implement that correctly, and this change makes it do so. The change sets `skip_specs: true`.

## Impact

- `.github/workflows/release.yml` — the `desktop` job's **Smoke test the app** step.
- A throwaway workflow on this branch runs the same build and smoke test on `macos-latest` to prove it before merging,
  and is removed before the merge.
- No source, UI, server or desktop-app code changes; no new dependency, secret or permission.
