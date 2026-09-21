## Why

The published demo is the first thing most people see of the dashboard, and it hides the most distinctive part of it. Agent sessions are switched off in the demo config and the mock API refuses them, so there is no running badge on a card, no session panel, no terminal, no work status (`3 uncommitted`, `2 unpushed`, `pushed`, `merged`), no "Open work" list and no Ship action. Shared-config state is empty until a visitor creates a profile. What remains looks like a static Kanban, which undersells the product and leaves screenshots (which may only come from the demo build) without its best features.

## What Changes

- **Agent sessions are enabled by default in the demo, and simulated.** The demo starts with sessions switched on and one fictional, vendor-neutral agent profile reported as available, so nothing has to be configured to see them; a visitor can still switch them off in Settings for the current page session. The mock API keeps sessions in memory and implements every session operation: starting a session for a card, resume, Ship, close (with and without removing the worktree), delete, worktree status and removal. Nothing is started, nothing is contacted, and a reload resets everything — the same contract the demo already has for config and shared-config edits.
- **The first screen already shows work happening.** The sample is seeded with sessions in every state a visitor should see — running and printing, running but quiet (waiting for an answer), ended cleanly, failed to start — attached to sample changes that live in worktrees, and with session worktrees covering every work status: uncommitted files, unpushed commits, pushed, merged, a stale one, and a worktree whose session record is gone. Cards show the running badge and work-status badges, the top bar shows "Open work" with a count, and Ship is offered where the real app offers it.
- **The session terminal plays a scripted recording.** The session panel gets its byte stream through the UI's API interface instead of opening a WebSocket itself; the product implementation is the WebSocket, the demo implementation plays an invented transcript into the same terminal view with realistic pacing. Opening a running session fast-forwards to where it "is" and continues; a session that is waiting shows the question and advances when the visitor answers (typing or a quick-reply button); Ship plays a commit–push–pull-request transcript and the work status moves accordingly. The panel and the banner state that this is a recording and that nothing runs.
- **Shared-config state is pre-seeded**: two profiles exist and are carried by several sample repositories, one of them outdated, so Projects and repository headers show `in sync` / `outdated` without setup.
- **Everything stays synthetic — and the guard rails are extended to prove it.** Every new repository name, branch, path, change name, agent name, commit message and transcript line is invented, in the style of the existing sample; paths stay under `/home/demo/`. The automated checks that fail on real-looking home directories are extended to the session data and every transcript, and additionally fail on e-mail addresses, URLs other than the project's own, and host names, none of which a transcript needs.
- **All times stay relative to page load**: "running for 4 min", "quiet for 12 min", "unpushed for 2 days (stale)" do not age with the published demo.
- The demo banner gains one clause saying that agent sessions are simulated.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities
- `demo-site`: "The sample showcases the dashboard and stays fresh" (sessions in every state, every work status, seeded shared-config state, relative session times), "The mock API lets the UI be explored without saving anything" (sessions are simulated in memory instead of refused; the terminal stream is part of the API interface), "Demo data is synthetic and never read from a machine" (transcripts and session data are covered by the checks, which also reject e-mail addresses, foreign URLs and host names); new requirements for the simulated sessions and for the scripted terminal.

## Impact

- `src/ui/api.ts`: the API interface gains `openTerminal(sessionId, handlers)`; the HTTP implementation wraps the existing WebSocket. `src/ui/sessionPanel.tsx` uses it instead of constructing a WebSocket — behaviour of the product is unchanged.
- `src/ui/demo/`: `demoApi.ts` (session state machine), new `demoSessions.ts` (seed data derived from the sample), new `transcripts.ts` (invented recordings and their player), `sampleData.ts` (agent profile, sessions enabled, seeded shared-config profiles), `banner.tsx`.
- `test/`: demo API tests for every session operation and state transition; transcript player tests (fast-forward, waiting for input, exit, Ship); demo data tests (every session state and work status present, times relative to now, ids consistent with the sample); synthetic-data checks extended to sessions and transcripts; the bundle tests keep asserting that the product bundle contains no sample data and no transcript.
- `README.md` / demo docs: what the demo simulates.
- No server, scanner or spec change outside `demo-site`. The product bundle does not grow by the transcripts (they are only imported by the demo entry point).
- In-flight changes: `animate-running-badge` animates the badge this change makes visible in the demo — no file overlap beyond `styles.css`, which this change does not need to touch. `add-change-detail-view`, `add-settings-nav`, `create-change-from-dashboard` each add API operations the demo must implement; whichever lands later adds its operation to the demo as the type checker demands.
