# Tasks

## 1. Projects table layout

- [x] 1.1 In `src/ui/styles.css` add `.projects .repo-name .label-chips { flex-wrap: nowrap; }` with the chips kept at
  their own width (`flex: none` on the chips); verify in `bun run dev` with a repository carrying five labels that its
  row shows three chips and `+2` on one line at 50%, 100%, 150% and 200% zoom, none overlapping the **Open** column or
  another row
- [x] 1.2 Scope the agent profile header rule to its card: `.agent-toggle`, `.agent-toggle:hover`,
  `.agent-toggle:focus-visible` and `.agent-toggle strong` become `.agent-card-head .agent-toggle…`; verify with grep
  that no unscoped `.agent-toggle` rule is left and that `test/agentSettingsUi.test.ts` and
  `test/projectSettingsUi.test.ts` still pass
- [x] 1.3 Add a stylesheet test (beside the existing ones reading `styles.css`) asserting that the table's label chips
  do not wrap and that every `.agent-toggle` rule is scoped to `.agent-card-head` or to `.control`; verify it fails on
  the old stylesheet and passes on the new one
- [x] 1.4 Verify in `bun run dev`: the overview rows' **Agent sessions** and **Docs auto-merge** toggles show switch and
  text on one line inside their border and do not reach the row below; with agent sessions off globally both show a
  dashed border; a tile's Settings panel shows the same toggles alike; the agent profile header in Settings keeps its
  borderless look, hover background and focus ring

## 2. Pull-request notices

- [x] 2.1 In `src/ui/pullRequestsState.ts` give each `PrNotice` a `kind`: `"not-on-github"` for `unavailable` without
  `setup`, `"failed"` for `failed`, decided from the status alone; update `test/pullRequestsState.test.ts` so the
  existing notice test expects the kinds, and verify it passes
- [x] 2.2 In `Notices` (`src/ui/pullRequests.tsx`) render one collapsed summary per kind present —
  `<n> repository isn't on GitHub` / `<n> repositories aren't on GitHub`, and, with the warning style,
  `<n> repository could not be listed` / `<n> repositories could not be listed` — each listing only its own
  repositories with their reasons; add a render test covering one kind alone and both together, and verify it passes
- [x] 2.3 Verify in the demo build (`bun run build:demo`) that the Pull requests view shows
  `1 repository isn't on GitHub` for `quill-docs` and no "could not be listed"

## 3. Home link in the hero

- [x] 3.1 In `src/ui/app.tsx` turn the hero title's text into a link to `/` inside the `h1` (`href("/")`,
  `onClick={(e) => followInApp(e, "/")}`, `aria-current="page"` on the overview) and wrap the mark in a second anchor
  to the same place with `tabindex="-1"` and `aria-hidden="true"`; extract it as a small component if that makes it
  testable, and add a test that both anchors point at `href("/")`, only the title is focusable, and a modifier click is
  not intercepted; verify it passes
- [x] 3.2 Style the link in `src/ui/styles.css` so the title looks unchanged (inherited colour, no underline) with an
  accent hover and the brand focus ring; verify in `bun run dev` that clicking the title or the mark on a board shows
  the overview without a reload, Cmd/Ctrl-click opens a new tab, and in the demo the link navigates through its hash
  route

## 4. Wrap-up

- [x] 4.1 Add a What's new entry at the top of `src/ui/changelog.ts` covering the tidier projects table, the clearer
  "isn't on GitHub" note and the home link (see "What's new" in CONTRIBUTING.md); verify its test passes
- [x] 4.2 Run `bun run check` and verify lint, typecheck and tests all pass; run `openspec validate
  polish-overview-and-header --strict` and verify it reports the change valid
