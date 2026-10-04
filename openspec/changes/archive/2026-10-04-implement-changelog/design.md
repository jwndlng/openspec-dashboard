# Design

## Context

See proposal.md for the why and specs/whats-new/spec.md for the behaviour. What shapes the approach:

- The UI is one self-contained `dist/ui/index.html` (invariant 4: no runtime network beyond pull and the `gh` query),
  served by the binary and, unchanged apart from its API, by the demo site.
- The release notes already exist on GitHub, drafted from pull request titles. They list every `chore` and `fix` with
  author and number — written for maintainers, not for someone who wants to know what they can now do.
- Per-browser "seen" state already has a precedent: the activity feed keeps its marker in `localStorage`
  (`src/ui/activityState.ts`) with the same first-visit baseline and storage-refused tolerance; theme, auto-refresh and
  minimized groups do the same.

## Goals / Non-Goals

**Goals:** a changelog that ships inside every build at no runtime cost, is written for users, and can be kept current
by the same people (mostly agents) who ship the features.

**Non-Goals:** knowing which release an entry shipped in; deriving entries automatically; server-side state.

## Decisions

**D1 — Typed data in the UI source, not a Markdown file parsed at build time.** `src/ui/changelog.ts` exports
`CHANGELOG: readonly ChangelogEntry[]` with `{ id, date, title, summary }`, `summary` a short Markdown string. Imported
like any module, so `scripts/build-ui.ts`, the demo build and the compiled binary need no change, and the type checker
catches a missing field. Alternatives: a `CHANGELOG.md` parsed by a build plugin (the user chose an in-app view, not a
repository document; a parser adds a format to get wrong and a build step to keep in sync in two builds); generating
from `feat` commits or archived OpenSpec proposals (titles and "Why" sections are written for reviewers and say nothing
about where the feature lives in the UI).

**D2 — Ids are `<date>-<slug>`, and "seen" is a set of ids.** The marker stored under one `localStorage` key is the
JSON list of ids seen. Unseen = entries whose id is not in it. A single "newest seen" marker (the activity feed's
approach) would mis-count when an entry is backdated, inserted between older ones or removed; a set does not care. The
set grows by a handful of short strings per release; on every save it is pruned to ids still in the changelog. First
visit (key absent) seeds the set with every current id and shows no count. Malformed stored JSON counts as absent.

**D3 — A button in the hero corner opening a `Modal`, not a route.** The changelog is occasional reading, not a working
view, so it does not get a main-navigation entry or a URL. `WhatsNew` sits in `topbar-end` before `ConsoleButton`, a
`btn sm ghost` with a gift/sparkle icon and, when unseen > 0, a count styled like the Activity nav count (`nav-count`).
The dialog reuses `Modal` (Escape, backdrop, close) and the Markdown renderer from `markdown.tsx`, which never produces
raw HTML. On open, the component snapshots the unseen ids into state (for the **New** marks) and saves every id as seen
at once, so a reload while it is open does not show the count again.

**D4 — Month grouping from the entry date, formatted without time zones.** Dates are calendar dates (`YYYY-MM-DD`),
so they are parsed into year/month/day and formatted with `toLocaleDateString` on a local `Date(y, m-1, d)` — no UTC
off-by-one at midnight.

**D5 — Pure state module for testability.** `src/ui/whatsNewState.ts` holds `unseenIds(entries, seen)`,
`loadSeenIds()`/`saveSeenIds()` (try/catch around storage, like `activityState.ts`), and `groupByMonth(entries)`;
`test/whatsNew.test.ts` covers them and validates `CHANGELOG` itself (spec: well-formed and current).

**D6 — Keeping it current is a convention plus an agent rule, not a CI gate.** `CONTRIBUTING.md` gets a short
"What's new" paragraph under Releasing; `openspec/config.yaml` gets a project-owned (unmarked, so shared-config apply
leaves it alone) `rules.tasks` entry: a change that adds or changes something users can see ends with a task to add an
entry to `src/ui/changelog.ts`. A CI check failing `feat` pull requests without an entry would also fire for internal
`feat`s and be bypassed by retitling — the rule targets the point where the work is planned instead.

## Risks / Trade-offs

- [Entries are forgotten] → the tasks rule makes it a planned task; missing ones can be added later without harm, since
  a late entry still counts as unseen for everyone who saw the older ones.
- [Entry text drifts from the UI after later changes] → entries describe the feature when it shipped, dated; they are
  history, not documentation.
- [Count differs between browsers] → intended: seen state is per browser, like the activity marker.
- [Demo visitors never see a count] → first visit baselines; the dialog itself is the showcase. Acceptable.

## Migration Plan

None: new UI only. Existing users see no count on the first load after upgrading (no marker yet → baseline), and counts
start with the first entry added after that.
