# Tasks

Order matters: the Console tab has to be worth reaching before the card sends every user there. So the predicates come
first, then the pane and the tab that the always-present quick link leads to, and the card's layout last.

## 1. Console availability, as two questions

- [x] 1.1 Add `consoleTabAvailable(config, repoId)` to `src/ui/sessionState.ts` — whether a change gets a Console tab
      and its card a console quick link, which is `sessionsEnabledFor` — with the comment saying why it is not
      `consoleAvailable`; verify with `bun test test/workStatusUi.test.ts`
- [x] 1.2 Leave `consoleAvailable` unchanged and add a test in `test/workStatusUi.test.ts` asserting the two differ
      exactly where it matters: with sessions enabled and neither a session nor a worktree, `consoleTabAvailable` is
      true and `consoleAvailable` is false; with sessions off or the repository excluded, both are false; verify
      `bun test test/workStatusUi.test.ts` passes

## 2. One session component for the card

- [x] 2.1 Drop the `part` prop from `SessionControls` in `src/ui/sessions.tsx` so badge and starters render together,
      and drop the dead `part === undefined` work-badge branch with it (the detail header keeps using `WorkBadge`);
      verify `bun run typecheck` reports no unused `worktree` binding and no caller left passing `part`
- [x] 2.2 Remove the `badge-x` close control and its `session-chip` wrapper from `SessionControls`, leaving
      `SessionBadgeView` with its `openPanel` click; verify no `badge-x` remains anywhere in `src/` (`grep -rn badge-x src/`)
- [x] 2.3 Hide the starters while any session of the change is running — `sessionsForChange` already returns the running
      ones — so a failed or badly ended session still shows its badge **and** the starters. The rule is the pure
      `cardSessionControls` in `sessionState.ts`, not a condition inside the component, because `test/vnode.ts` cannot
      look inside a component that uses hooks; `SessionControls` renders what it returns and drops its now-unreachable
      "sends the prompt to the running session" branch. Verified by task 6.2

## 3. The Console tab always leads somewhere

- [x] 3.1 Give `ConsolePanel` in `src/ui/sessionPanel.tsx` the change it stands for, so it still knows which change it is
      about with neither a session nor a worktree; verify `bun run typecheck` passes with `changeDetail.tsx` passing it
- [x] 3.2 Add the "no agent has worked on this change yet" empty state to `ConsolePanel`, rendering `SessionControls` for
      the change's starters beside the explanation, next to the existing worktree-only empty state and without touching
      the terminal's flex chain; verify `bun test test/consoleLayout.test.ts` still passes
- [x] 3.3 Switch the tab strip's `hasConsole` in `src/ui/changeDetail.tsx` to `consoleTabAvailable`, leaving the
      gone-from-snapshot branch on `consoleAvailable`; verify a change name that exists in neither the snapshot nor any
      session or worktree still renders the not-found state (`bun test test/changeDetail.test.ts`)
- [x] 3.4 Add tests to `test/changeDetail.test.ts` for the tab strip: `Console` last for a change with no session while
      sessions are enabled, no `Console` tab with the feature off, and a URL naming the Console tab with the feature off
      falling back to the first artifact with content; verify `bun test test/changeDetail.test.ts` passes

## 4. The card

- [x] 4.1 In `ChangeCard` (`src/ui/kanban.tsx`) move `ConsoleLink` into the card's top as a sibling of `.card-title`,
      remove the `.card-status` span, and render `SessionControls` once in the `.meta` footer before **Show details**;
      verify by reading the rendered tree in the card test of group 5
- [x] 4.2 Change `ConsoleLink`'s gate to `consoleTabAvailable` so it is drawn whenever agent sessions apply to the
      repository; verify a card in a sessions-enabled repository with no session shows the link, and a card with the
      feature off shows none

## 5. Styles

- [x] 5.1 Make `.card-top` a row again — `.card-title` keeps its column and `min-width: 0` so the name wraps — with the
      console link as a top-aligned fixed-size sibling; verify in the running app (`bun run dev`) that a long change
      name wraps inside the card and never runs under or past the icon
- [x] 5.2 Remove the `.card-status` rule from `src/ui/styles.css` (`.session-chip` and `.badge-x` went with task 2.2,
      so nothing emits or styles them) and give the footer
      the spacing the badge needs beside the starter and **Show details**; verify `bun test test/consoleLayout.test.ts`
      and `test/repoContrast.test.ts` still pass and no rule references a removed class (`grep -n "card-status\|badge-x\|session-chip" src/ui/styles.css`)

## 6. Card tests

- [x] 6.1 Update the card-content test in `test/changeDetail.test.ts`: the card top is `card-title` plus the console
      link with no `card-status` between age and progress bar; verify `bun test test/changeDetail.test.ts` passes
- [x] 6.2 Test the rule itself in `test/agents.test.ts` (`cardSessionControls`), since the DOM-free helpers cannot look
      inside a component that uses hooks and a renderer dependency is not worth one branch: a running session gives a
      badge and no starter, printing or silent alike; a failed or badly exited one gives a badge **and** the starter; a
      clean exit gives the starter alone; an archive session running beside the change's own counts as running; another
      change's session changes nothing; the feature off gives neither. Verify `bun test test/agents.test.ts` passes
- [x] 6.3 Assert that every card carries the console link's slot in its top and nowhere else (the link is a hook
      component, so the DOM-free walker sees the slot, not its anchor; whether it draws is `consoleTabAvailable`'s call,
      covered by task 1.2), including an archived card; verify `bun test test/changeDetail.test.ts` passes

## 7. Finish

- [x] 7.1 Run `bun run check` and fix everything it reports
- [x] 7.2 See it rendered, with agent sessions enabled. The demo build (`bun run build:demo`) is the honest way to do
      this without starting a real agent in a tracked repository: it has a running session, a silent one, a failed one
      and changes with no session at all, and simulates everything in memory. Rendered in headless Chrome
      (`bun run screenshots`, plus one-off routes): the board shows `● working` and `◆ may need you 11m` in the
      starter's place with no starter and no `✕`, a failed change showing its badge **and** `▶ Implement`, and the
      console link in the same top-right corner of every card including those with no session; the Console tab of a
      change no agent has worked on shows its sentence and `▶ Implement`; the Console tab of the running session shows
      `↳ Implement` and **End session**, which is where the card's two lost controls went
- [x] 7.3 Verify the compiled binary behaves the same (`bun run build`, then run `dist/openspec-dashboard`), since the
      UI is embedded at build time: the served page must carry the new `.card-top` row, the console empty state's text
      and `.console-starters`, and none of `card-status`, `badge-x` or `session-chip`
- [x] 7.4 Confirm no wording in `README.md` describes the card's close control, the card's next-step button while a
      session runs, or the console link appearing only with a session, and update what does; verify with
      `grep -n "console\|badge\|starter\|next step" README.md`
