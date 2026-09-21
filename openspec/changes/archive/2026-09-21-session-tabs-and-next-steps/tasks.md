# Tasks

## 1. Server
- [x] 1.1 One running session per worktree in `open()` and restarts
- [x] 1.2 `manager.prompt(id, action)`: validation, write without Enter, record the action
- [x] 1.3 `POST /api/sessions/:id/prompt`; `GET …/worktree` returns a fresh `work`
- [x] 1.4 Tests: prompt typed without Enter, refusals (stage, archive, not running, disabled, cross-site), archive next to a running session, fresh work status

## 2. UI helpers
- [x] 2.1 `sessionTabs`, `sessionsForChange`, `nextStepFor`, `endSeverity` with tests
- [x] 2.2 Api interface, http and demo implementations

## 3. UI
- [x] 3.1 Cards: badge(s) plus stage starters; starters prompt the running session; ✕ on the running badge
- [x] 3.2 End-session dialog as an overlay, graded, with Ship instead; used by card and panel
- [x] 3.3 Panel: tab strip and next-step buttons in the header
- [x] 3.4 Styles from theme tokens; keyboard and screen-reader semantics for tabs and ✕

## 4. Docs and verification
- [x] 4.1 `README.md` agent sessions section
- [x] 4.2 `bun run check`, `bun run build`, `build:demo`; prompt endpoint exercised against the compiled binary with the fake agent
