# Proposal

## Why

The README has grown to ~290 lines that restate, feature by feature, what `openspec/specs/` already specifies. A
newcomer has to read a wall of edge cases (canonical paths, migration of old configs, marker syntax, dock resizing)
before learning what the tool is and how to start it. It should answer "what is this, is it safe, how do I run it"
in a minute and point elsewhere for the rest.

## What Changes

- Rewrite `README.md` to roughly a quarter of its length: one-paragraph pitch, live demo link and themed screenshot
  (kept — required by the `demo-site` spec), install/run, first run, a short feature list (one line per view or
  feature), a compact "what it writes" section, and links to specs, `CONTRIBUTING.md` and `CLAUDE.md`.
- Drop detail that is already specified: edge cases, migration notes, UI minutiae, the shared-config YAML example,
  the per-bullet agent-session walkthrough, the scanner internals. The README links to `openspec/specs/` instead of
  duplicating them.
- Move the developer-only commands (`build:demo`, `screenshots`, demo-recording rules) out of the README's Run section;
  `CONTRIBUTING.md` already documents the demo and screenshots.
- Plain, direct wording: no marketing phrases, no filler, no emoji.

No behaviour, code or spec changes.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
<!-- none — documentation only; `.openspec.yaml` sets `skip_specs: true`. The README still satisfies the
     demo-site requirement "The demo is published and linked from the README". -->

## Impact

- `README.md` (rewritten).
- `CONTRIBUTING.md`: only if a developer command dropped from the README is not yet mentioned there.
- Overlap: the in-flight change `update-detail-view` has a task (4.1) to reword the README's "Copy apply command"
  passages. After this rewrite those passages are gone or reduced to one line; whichever change merges second
  adjusts that line.
