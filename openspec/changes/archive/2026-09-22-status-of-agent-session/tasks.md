# Tasks

## 1. Name the two running states

- [x] 1.1 In `src/ui/sessionState.ts`, replace `QUIET_AFTER_MS = 60_000` with a 20s silence threshold and give it a
      name that says what it decides (e.g. `NEEDS_YOU_AFTER_MS`); verify by reading it back — no other module imports
      the constant (`grep -rn QUIET_AFTER_MS src/`).
- [x] 1.2 Add a duration helper next to it that renders under a minute as seconds (`45s`) and a minute or more as
      minutes (`3m`); verify with unit tests over 0s, 20s, 59s, 60s and 10m.
- [x] 1.3 Reword the two running branches of `sessionBadge()`: the printing branch to `● working` (tone `info`,
      `live: true`, title saying the terminal is producing output) and the silent branch to `◆ may need you <duration>`
      (tone `warning`, no `live`, title phrased as a possibility). Keep the `state === "failed"` and exited branches
      untouched; verify `bun test test/agents.test.ts`.
- [x] 1.4 Confirm a running session with no `lastOutputAt` at all still reads as `working` — a session that has just
      started has printed nothing yet and must not be announced as needing the user; verify with a unit test
      (today's `live({})` case in `test/agents.test.ts`).

## 2. Tests

- [x] 2.1 Update the two `sessionBadge` tests in `test/agents.test.ts` ("badges are honest about what a terminal can
      tell", "only an agent that is visibly working is shown with motion") to the new labels, tones and threshold, and
      fix their comments, which still describe both running states sharing the live role; verify
      `bun test test/agents.test.ts`.
- [x] 2.2 Add cases covering each scenario of the delta spec that a unit test can reach: just under and just over the
      threshold, the duration in seconds and in minutes, and output resuming after a silent spell (a later
      `lastOutputAt` returns the badge to `working` with no duration); verify `bun test test/agents.test.ts`.
- [x] 2.3 Assert that the two running states differ in `label`, not only in `tone` and `live` — the spec's
      "told apart by their words" requirement; verify the test fails if both labels are made equal.

## 3. Board card chip

- [x] 3.1 Check the chip in `src/ui/sessions.tsx` renders the longer `may need you 45s` label without truncating or
      wrapping the card; verify in `bun run dev` with a session left idle past the threshold, and narrow the board to
      its smallest column width.
- [x] 3.2 Ensure `tone-warning` exists for a session chip in `src/ui/styles.css` and reads as attention, not error,
      in both themes; reuse the existing status-label token rather than adding a colour, and rebase onto
      `agent-session-coloring` first if it has landed in `styles.css`; verify by eye in both themes.

## 4. Demo and docs

- [x] 4.1 Check `src/ui/demo/demoSessions.ts`: its `quietSince` seeds a waiting session 5s before "started" for the
      non-waiting case, which was below the old 60s threshold and is now near the new 20s one. Adjust the seeds so the
      demo still shows one working and one possibly-waiting session; verify `bun test test/demoSessions.test.ts` and
      the demo site.
- [x] 4.2 Update the doc comment above `sessionBadge()` and the `lastOutputAt` comment in `src/shared/types.ts`, both
      of which still speak of a "quiet spell"; verify by reading them against the delta spec's wording.

## 5. Verify the whole change

- [x] 5.1 Run `bun run check` (lint + typecheck + tests) and confirm it passes.
- [x] 5.2 Run `openspec validate status-of-agent-session` and confirm the change is valid.
- [x] 5.3 In `bun run dev`, start a session, watch the chip read `working` while the agent prints, then flip to
      `may need you <duration>` within one 3s poll after it falls silent, and flip back when output resumes.
