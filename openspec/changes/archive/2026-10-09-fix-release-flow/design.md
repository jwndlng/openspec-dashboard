# Design

## Context

The `desktop` job of `.github/workflows/release.yml` builds the macOS app with `bun run build` in `desktop/`
(`electrobun build --env=stable`), then a smoke test checks it before anything is attached. A local build reproduces
what the runner produced for `v0.7.0`:

```
desktop/build/stable-macos-arm64/Spec Control.app/Contents/MacOS/launcher
desktop/build/stable-macos-arm64/Spec Control.app/Contents/Resources/<hash>.tar.zst
desktop/artifacts/macos-arm64-SpecControl.dmg              (styled by desktop/scripts/style-dmg.ts)
desktop/artifacts/stable-macos-arm64-SpecControl.app.tar.zst
```

The stable build compresses the real app (with `Contents/Resources/app/bin/spec-control`) into the wrapper's payload,
and the wrapper replaces the real app in `desktop/build/`. The old `find desktop/build -path '*/bin/spec-control'`
therefore never matches. `styled-dmg-installer` already knew the image holds that wrapper; the smoke test was written
before it and never ran until `v0.7.0`.

## Goals / Non-Goals

**Goals:** the smoke test checks the binary inside the app that is actually attached, and fails when it is missing or
prints anything but the tag.

**Non-Goals:** changing how the app is built, signed or laid out; checking the inner app's own signature (the wrapper in
the image is what Gatekeeper sees and what is already verified); re-publishing `v0.7.0`.

## Decisions

### D1 — Read the binary from the disk image's app, not from `desktop/build/`

The payload is taken from `Spec Control.app/Contents/Resources/*.tar.zst` in the mounted `.dmg`, while it is mounted for
the signature and layout checks. That is the exact app a user installs. `desktop/artifacts/*.app.tar.zst` holds the same
app, but it is an update-bundle by-product that is not attached; reading it would check something next to what ships.

### D2 — Decompress with Bun

macOS's `bsdtar` reads `.tar.zst` only by running an external `zstd`; without one on the `PATH` it fails with "unable to
run program zstd". Bun, which the job already installs from `.bun-version`, has `Bun.zstdDecompressSync`, so the step
pipes the decompressed tar into `tar -x` with no new tool. Alternatives: rely on the image's preinstalled `zstd` (works
today, but a runner image change would break releases again), or `brew install zstd` (network and time for nothing).

### D3 — Order and failure handling

Mount → verify signature → check layout → unpack payload → detach → fail on layout → find `bin/spec-control` under the
unpacked directory, fail with a clear error if absent → compare `--version` with the tag → copy the `.dmg` to
`release/`. GitHub's default `bash -e` has no `pipefail`, so a failed decompression shows up as the missing-binary error
rather than silently passing. The image is detached before any version failure exits.

## Risks / Trade-offs

- Electrobun could change the wrapper's layout in a later version → the step then fails loudly with "bundles no
  spec-control binary", which is the intended behaviour; the fix would be to follow the new layout.
- The payload is ~40 MB and decompressed in memory → negligible on the runner.

## Migration Plan

Merge, then publish the next draft release (`v0.7.1` or whatever the draft proposes). Whether to leave `v0.7.0` as a
release without downloads or remove it is the maintainer's call: until a newer release exists, the update check points
users at `v0.7.0`.
