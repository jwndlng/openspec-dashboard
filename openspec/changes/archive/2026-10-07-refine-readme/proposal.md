# Proposal

## Why

The README has grown change by change into a reference manual: one tagline, then a 200-line feature list in which
every bullet carries its own edge cases, file paths and flags. A person landing on the repository cannot tell within a
minute what Spec Control is, what problem it solves, or whether it is for them — and the details that matter to a
newcomer (it is local, it is read-only, it is one binary) are buried among the details that do not. The full detail
already lives where it belongs: in the built-in Help, in `openspec/specs/`, and in `CONTRIBUTING.md`. The README should
be the front door, not the manual.

Contribution is also mis-signposted: the README sends readers to `CONTRIBUTING.md`, which describes the maintainer's and
agents' pull-request workflow. Outside contributors should open a GitHub Issue instead.

## What Changes

- Rewrite `README.md` for a human reader, in this order:
  - **What it is** — one or two plain sentences, then the demo link and the board screenshot (kept as today).
  - **The problem** — a short paragraph: with OpenSpec changes spread across many repositories and agents working on
    them in parallel, you lose track of what is proposed, in progress, done or waiting on you.
  - **Key features** — a short list (about six to eight one-line bullets) of what you get, not how each edge case works.
  - **How it is organised** — a short section on the three levels: the global console and projects overview, a
    project (its board and its project console), and a change (its card, detail and agent session in its own worktree).
  - **Run** — download and verify a release binary, macOS quarantine note, first-run steps, building from source;
    shorter, same facts.
  - **What it touches** — a brief trust summary: loopback only, reads by default, writes only on your click, the
    network only for Pull and the pull-request query; the full list stays linked in the dashboard-api spec.
  - **Contributing** — open a GitHub Issue for bugs and ideas; pull requests are not the way in. Points maintainers and
    agents to `CONTRIBUTING.md` and `CLAUDE.md`.
  - **License**.
- Remove the per-feature reference detail (label marker files, chip glyphs, column rules, flag lists, rename-migration
  notes) from the README; it is already covered by the Help view and the specs, which the README links to once.
- Add a short note at the top of `CONTRIBUTING.md` that it describes how the project itself is developed, and that
  outside contributors should start with a GitHub Issue.
- Stop the README from growing back: the README was already overhauled once (`overhaul-readme`, 2026-09-22) and
  regrew because every feature change appended its edge cases to it. `CONTRIBUTING.md`'s Implement step gains one
  line: feature detail goes into the built-in Help and the spec; the README changes only when a key feature, the
  structure, the run steps or what the dashboard touches changes.
- No code, UI, Help text or behaviour changes.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `repo-hygiene`: adds a requirement on the README's purpose and structure (human-first overview, problem, short
  feature list, the global → project → change structure, run instructions, trust summary, issue-first contribution),
  that it stays an overview rather than a feature reference, and that `CONTRIBUTING.md` sends outside contributors to
  GitHub Issues.

The existing README requirements in `demo-site` (demo link and screenshot near the top) and `release-publishing` (the
**Run** section links releases, verification and the macOS quarantine prompt) stay as they are and are kept.

## Impact

- `README.md` — rewritten.
- `CONTRIBUTING.md` — one short paragraph added at the top and one line in the Implement step; the rest unchanged.
- `openspec/specs/repo-hygiene/spec.md` — via this change's delta spec, on archive.
- No source, test, fixture, workflow or UI file is touched.
