# Proposal

## Why

User feedback turned up four small flaws in the most-used screens. Two of them make the projects table look broken:
when the page is zoomed, a row's label chips overlap one another and spill into the **Open** column, and the **Docs
auto-merge** and **Agent sessions** toggles wrap their text under the switch so it overlaps the row below. The Pull
requests view words a repository that simply is not on GitHub as one that "could not be listed", which reads like a
failure. And the product mark and title in the hero do not lead anywhere, although every user expects them to go home.

## What Changes

- **Label chips stay on one line in a table row.** A row shows at most three chips and `+<n>`, so they no longer wrap;
  the name cell is as wide as its content needs and nothing in it paints over the next column, at any zoom level.
- **The overview's project toggles keep their own look.** The rule styling the agent profile header in Settings no
  longer leaks onto the overview's **Agent sessions** and **Docs auto-merge** toggles: they stay on one line inside their
  24px height, with their border back, including the dashed border of a toggle that is off globally.
- **The Pull requests notice tells "not on GitHub" from "failed".** A repository that cannot be queried because it is
  not on GitHub or not a git repository is summarised as information (`1 repository isn't on GitHub`); only a query
  that failed is summarised as `… could not be listed`. When both occur, both summaries are shown. The demo keeps
  `quill-docs` without pull requests, which now shows the informational note.
- **The product mark and the title link to the Projects overview.** A plain click navigates in the app; a modifier
  click or middle click opens a new tab as for any link; in the demo the link uses its hash route.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `project-overview`: a new requirement that table rows keep their content inside their own cell at any zoom level —
  label chips and the project toggles included — and that the toggles look the same in a row and in a tile's Settings
  panel.
- `pull-requests`: "Pull requests view in the top navigation" separates repositories that are not on GitHub (an
  informational note) from repositories whose query failed (`could not be listed`).
- `kanban-board`: "The dashboard opens with a hero header" makes the product mark and the title a link to the Projects
  overview.

## Impact

- `src/ui/styles.css` — `.projects .repo-name .label-chips` no longer wraps; the `.agent-toggle` rules (and their
  `:hover`, `:focus-visible` and `strong` variants) are scoped to `.agent-card-head`; the hero link's styling.
- `src/ui/pullRequestsState.ts` — `pullRequestNotices` says which kind each notice is.
- `src/ui/pullRequests.tsx` — `Notices` shows the informational and the failure summary separately.
- `src/ui/app.tsx`, new `src/ui/heroHome.tsx` — the hero's mark and title become a link to `/` with `href()` and
  `followInApp`.
- `src/ui/changelog.ts` — a What's new entry.
- `test/pullRequestsState.test.ts`, `test/pullRequestsUi.test.ts` — the notice kinds and their summaries; new
  `test/heroHome.test.ts` and `test/overviewStyles.test.ts`.
- No server, API, configuration or demo-data change; no new write, git command or network request.
- The hero requirement's delta is written on top of the version in `rename-to-spec-control` (merged, not archived yet),
  so that change has to be archived before this one.
