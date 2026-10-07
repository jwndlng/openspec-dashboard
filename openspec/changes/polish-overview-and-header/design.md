# Design

## Context

Four independent UI fixes (see proposal.md). Each is small, and none touches the server, the API or what is written
anywhere. The specs are in `specs/`.

- **Label chips.** `.projects th, .projects td` are `white-space: nowrap` (`src/ui/styles.css`, Projects overview),
  but `.label-chips` is an `inline-flex` box with `flex-wrap: wrap`. With the automatic table layout a wrapping flex
  box contributes only its widest item as min-content, so the name column is sized for one chip while the chips are
  laid out in a row that, on zoom, overflows the cell and paints over `td.num.total`.
- **Project toggles.** `.agent-toggle` (with `:hover`, `:focus-visible` and `strong`) styles the header button of an
  agent profile card in Settings (`agentSettings.tsx`). The overview's `AgentToggle` and `AutoMergeToggle`
  (`projectSettings.tsx`) carry the class `control switch-control agent-toggle`, so the global rule gives them
  `display: flex; flex-wrap: wrap; flex: 1; border: 0`; inside the fixed 24px height of `.control.agent-toggle` the
  label wraps under the switch and overlaps the next row, and the border, including the dashed off-globally one, is
  gone.
- **Pull-request notices.** `pullRequestNotices` (`pullRequestsState.ts`) returns every `unavailable` or `failed`
  repository without a machine-wide `setup` problem; `Notices` (`pullRequests.tsx`) puts them all under one
  "could not be listed" summary. Per-repository `unavailable` without `setup` is produced in exactly one place on the
  server: "not on GitHub" / "not a git repository" (`src/server/pullRequests.ts`).
- **Hero.** `app.tsx` renders `LogoMark` and the `h1.hero-title` as siblings in the `.hero-brand` grid (mark, copy,
  status corner). Routing goes through `href()` / `followInApp()` (`url.ts`), which already handle hash routing and
  modifier clicks.

## Goals / Non-Goals

**Goals:**
- Fix each defect at its cause, not by masking it (no clipping that would hide a focus ring or a badge).
- Keep the agent profile header in Settings looking exactly as it does now.

**Non-Goals:**
- No change to the demo data: `quill-docs` stays a repository that is not on GitHub.
- No change to the board header's or tile's label layout (they wrap by design), nor to the server's statuses or reasons.
- No new hero element: the tagline stays plain text.

## Decisions

1. **`flex-wrap: nowrap` for chips in a table row** (`.projects .repo-name .label-chips`). A row shows at most three
   chips and `+<n>`, so one line is always short enough, and a non-wrapping flex box reports its whole row as
   min-content, which makes the automatic table layout reserve the full width. *Alternative:* `overflow: hidden` on the
   name cell — rejected: it would cut chips and focus rings instead of making room. As a guard the chips get
   `flex: none` so a narrow table scrolls (the overview already scrolls) rather than squeezing them.

2. **Scope the profile-header rule to its card** — `.agent-card-head .agent-toggle` for the base rule and its three
   variants. *Alternative:* rename the overview toggles' class — rejected: `.control.agent-toggle` and
   `.off-globally` are the toggles' own rules and tests and the tour may refer to them; the leak is the unscoped
   Settings rule, so that is what changes. After the fix the overview toggles get their look from `.control`,
   `.switch-control` and `.control.agent-toggle` only, which is also what a tile's Settings panel uses.

3. **Notices carry a kind.** `pullRequestNotices` adds `kind: "not-on-github" | "failed"` to each notice:
   `not-on-github` for `status: "unavailable"` without `setup`, `failed` for `status: "failed"`. It is decided from the
   status, not from the reason text, so a reworded reason cannot move a repository between the two. `Notices` renders
   one `<details>` per kind present: the informational one plain (`isn't on GitHub` / `aren't on GitHub`), the failure
   one with the warning style and `could not be listed`. Each lists only its repositories with their reasons; the
   "showing the last list that was fetched" hint stays on failed ones that have a list. *Alternative:* filter
   not-on-GitHub repositories out of the notices entirely — rejected: the spec still wants them listed with a reason,
   and with the repository filter set the view must say why that repository has nothing.

4. **Two anchors, one stop.** The mark and the title sit in different grid cells, so wrapping both in one `<a>` would
   change the hero's grid. Instead the title's text becomes `<a class="hero-home" href={href("/")}>` inside the `h1`
   (keeping the heading semantics, accessible name `Spec Control`), and the mark is wrapped in a second anchor to the
   same place with `tabindex="-1"` and `aria-hidden="true"`, so keyboard and screen-reader users meet one link while a
   pointer can click either. Both use `onClick={(e) => followInApp(e, "/")}`. The link inherits the title's colour and
   has no underline; hover and `:focus-visible` get the accent colour and the brand focus ring. `aria-current="page"`
   is set while the overview is shown.

## Risks / Trade-offs

- [Wider name column on narrow windows] → the overview container already scrolls horizontally inside its band; at most
  three chips plus `+<n>` keep the growth bounded.
- [Another view relying on the global `.agent-toggle` rule] → only `agentSettings.tsx` and `projectSettings.tsx` use the
  class (checked with grep); both are verified visually after the change.
- [Archive order] → this change's hero delta is written on top of the version in `rename-to-spec-control`, which is
  merged but not archived. Archiving this change first and that one afterwards would overwrite the link sentence;
  archive `rename-to-spec-control` first.
