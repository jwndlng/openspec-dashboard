# Proposal

## Why

New features land almost every day, but someone running the dashboard only finds out by stumbling over them — the
release notes live on GitHub, which nobody opens before upgrading a local tool. The dashboard should tell its own users,
inside the UI and without touching the network, what is new since they last looked.

## What Changes

- A curated changelog of user-visible features, kept in the repository as typed data (`src/ui/changelog.ts`: id, date,
  title, short Markdown summary) and compiled into the UI bundle — so the single binary and the demo site carry it with
  no request to any host.
- A **What's new** button in the hero's top corner opens a dialog listing the entries, newest first and grouped by
  month, each with its date, title and summary; a link to the GitHub releases page (a link the user follows, not a
  request the page makes) points at the full release notes.
- The button shows how many entries the user has not seen yet. Seen entries are remembered per browser in
  `localStorage`, like the activity feed's marker; the very first visit takes every existing entry as seen, so a new
  user is not greeted with the whole history. Opening the dialog marks everything seen; entries that were new when it
  opened keep a **New** mark until it closes.
- A test guards the data: unique, well-formed ids, valid dates, newest first, non-empty title and summary.
- Contributors are told to add an entry with every `feat` pull request that users can see (`CONTRIBUTING.md`), and
  this repository's `openspec/config.yaml` gains a `tasks` rule so agents planning a feature add that task themselves.
- The changelog is seeded with the user-visible features shipped between `v0.2.0` and `v0.3.0`.

Non-goals: no server endpoint or API change, no per-version grouping (the UI does not know which release an entry
shipped in), no CI gate that fails a `feat` pull request without an entry, no `CHANGELOG.md` file, and no change to the
GitHub release notes, which stay generated from pull request titles.

## Capabilities

### New Capabilities
- `whats-new`: the embedded feature changelog, the What's new button with its unseen count and dialog, how seen entries
  are remembered, and how contributors keep the changelog current.

### Modified Capabilities
<!-- none: the release notes, the API and the demo's mock API are unchanged; the demo shows the same embedded list -->

## Impact

- New: `src/ui/changelog.ts` (entries), `src/ui/whatsNewState.ts` (unseen count and `localStorage` marker, pure),
  `src/ui/whatsNew.tsx` (button and dialog), `test/whatsNew.test.ts`.
- Changed: `src/ui/app.tsx` (button in `topbar-end`), `src/ui/styles.css`, `src/ui/icons.tsx` (one icon),
  `CONTRIBUTING.md`, `README.md` (one line), `openspec/config.yaml` (a `rules.tasks` entry).
- No server, API, demo-API, dependency or network change; reuses `Modal` and the Markdown renderer.
