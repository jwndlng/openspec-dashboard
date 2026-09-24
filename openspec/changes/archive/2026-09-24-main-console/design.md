# Design

## Context

See `proposal.md` — Why. What shapes the approach:

- A session today is always a `(repoId, change, action)` triple. `SessionManager.open` (`src/server/sessions/manager.ts`)
  validates the change against the snapshot, builds an opening prompt, then picks the working directory (worktree,
  adopted worktree, or the folder itself for an in-place session). The PTY, scrollback, fan-out to viewers, the echo-
  checked `submit`, the store (`store.ts`) and shutdown handling are all independent of the repository — they only need
  an argv, a cwd and an environment.
- `launchCommand` (`agents.ts`) has two modes — `{prompt}` substituted into argv, or typed after start-up — and no
  "no prompt" mode. `openingPrompt` returning `undefined` makes `open` refuse.
- The detail view's frame is already exported as `DetailOverlay` (`src/ui/changeDetail.tsx`), and it sits outside the
  `inert` `div.app` but inside `SessionProvider` (`src/ui/app.tsx`). `TerminalView` in `src/ui/sessionPanel.tsx` is
  self-contained apart from `useSessionUi()` (`focusTick`, `unsentId`, `reportUnsent`), but not exported. `ConsolePanel`
  around it is change-oriented throughout.
- Things that assume a session has a repository: activity reporting (`sessionEvent` needs `repoId`/`change`), `openWork()`
  and the change lookups in `sessionState.ts`, `EndSessionDialog` (pull offer, change name), `prepareRestart`
  (repository lookup, `isCleaningUp`), and `ship`/`prompt`/`worktreeStatus`/`close({removeWorktree})`.
- The config schema (`config.ts`) is used both when loading and when saving; loading must never fail because a folder
  disappeared since.

## Goals / Non-Goals

**Goals:**

- Reuse the session machinery (PTY, scrollback, store, WebSocket, guards, submit, status badge, shutdown) unchanged;
  the console differs only in how it is started and what the UI offers around it.
- Make "this session has no repository" a type-level fact, so the compiler finds every place that assumed one.
- Keep invariant 1 intact without editing the "never writes" requirement: the console's cwd is never inside a tracked
  repository.

**Non-Goals:**

- No per-console agent choice, no console-specific prompt templates, no several consoles, no console history browser
  (ended console records are kept and deletable like others, but only the most recent is shown).
- No change to change sessions, Open work's shape, the detail view, or the terminal protocol.

## Decisions

### A console is a `Session` with `console: true`, not a second manager

`Session` becomes a union in effect: change sessions keep `repoId`, `change`, `action`; a console session has
`console: true` and none of the three (and no `branch`, `adopted`, `inPlace`). `worktreePath` keeps its role as the
session's cwd, so `store.loadAll` (which requires it) and `prune` work unchanged, and console records count towards the
50 kept. Implementation: make the three fields optional on `Session` and add a `isConsole(session)` guard plus a
`ChangeSession` narrowed type for code that needs them; the type checker then points at every consumer.

Alternative considered: a separate `ConsoleManager` with its own record store. Rejected — it would duplicate the PTY
lifecycle, scrollback, viewer fan-out, submit queue and shutdown, which are the parts most worth sharing, and would need
a second WebSocket route and guard.

Alternative considered: a sentinel repository id (`repoId: "console"`). Rejected — every repository lookup would
silently miss instead of failing to compile.

### `openConsole()` beside `open()`, sharing `start()`

`SessionManager.openConsole()`:
1. refuse `403` unless `agentSessions.enabled`;
2. return the running console session if any (one at a time — keyed on `console`, not on a worktree);
3. resolve the folder (`consoleDir` or `paths.consoleDir()` = `<dashboardHome>/console`), `mkdir -p` only for the
   default, and refuse `409` if it is not an existing directory or is inside a tracked repository (re-checked at open,
   since the config or the file system may have changed);
4. take `config.agentSessions.defaultAgent`, refuse `503` if `Bun.which` misses it;
5. build argv with a new `launchCommand(agent)` overload with no prompt: drop every argument containing `{prompt}`,
   `typed` undefined;
6. `saveMeta` and the existing `start()`.

`resume` goes through `prepareRestart`, which for a console skips the repository lookup and `isCleaningUp`, and
`restart` already skips worktree creation for anything that is not a worktree session — the console is added to that
condition. The resume check "another session is running in this worktree" becomes "another console is running" for a
console. `ship`, `prompt`, `worktreeStatus` throw `SessionError(409)`; `close` ignores `removeWorktree`.

### Activity is skipped at the source

`report()` returns early for a console session. The activity log is about changes, its event schema requires
`repoId`/`change`, and adding a repository-less event kind would ripple through the feed and its filters for little
value.

### The console folder: validated on save, re-checked on open

`agentSessions.consoleDir?: string` in the schema checks only shape (non-empty, absolute after `expandPath`) so that a
config whose folder was deleted still loads. `PUT /api/config` additionally checks existence (`statSync().isDirectory()`)
and "not equal to or inside any configured repository path" — both paths compared after `realpath`, so symlinks cannot
sneak a repository in — and answers `400` with a reason naming the repository. `openConsole` repeats both checks. A
parent of tracked repositories is allowed on purpose: that is the "workspace root" use case, and the agent's reach there
is governed by its own permission prompts, exactly as in a worktree.

Only the default folder is ever created by the dashboard; it lives under `dashboardHome()`, so tests with
`OPENSPEC_DASHBOARD_HOME` never touch the real home.

### UI: `ConsoleOverlay` reusing `DetailOverlay` and `TerminalView`

- `sessionPanel.tsx` exports `TerminalView` (which already carries the `Shortcuts:` row), `Copy` and the hook that gives
  a restarted session a fresh terminal view, so the console does not fork them.
- New `src/ui/console.tsx`: `ConsoleButton` (top bar) and `ConsoleOverlay`. Open/closed is component state in the app
  shell, not the URL — the spec keeps the route unchanged, and a console is not a place in the app's navigation. The
  overlay is mounted next to `ChangeDetail`, outside `div.app`, and `div.app` becomes `inert` while either is open.
- On open, the overlay picks the most recent console session from `useSessionUi().sessions`; if none runs it shows the
  last ended one (output, Resume, New console, Delete record) or, with none at all, calls `POST /api/console` directly.
  A refusal is shown in the overlay body.
- `Escape`: the same focus-aware `closeOnEscape` guard as the Console tab (terminal host contains the target → let xterm
  have it).
- The button's state reuses the session badge's decision function (`running`/possibly needs you + silence) and puts the
  words into `title` and `aria-label`; visually a small dot on the icon, `--info` like every running badge.
- `SessionProvider` splits the polled list: `sessions` holds only change sessions (typed `ChangeSession[]`, so every
  card, Console tab and Open work helper keeps its types) and `consoles` the console sessions; `openWork()` also filters
  defensively.
- Ending the console is an inline confirm in the overlay. `EndSessionDialog` is about worktrees and pulls and keeps
  handling change sessions only.
- Settings: `agentSettings.tsx` gets a "Console folder" text field under the agent sessions section, placeholder showing
  the default, empty meaning default; the server's `400` reason is shown inline as for other config errors.

### Icon

The existing `IconTerminal` in `icons.tsx`. The button is icon-only, so its name (with the running state) is carried by
`aria-label` and `title`. No new colour token.

### Demo

`demoApi.ts` gains `openConsole` creating an in-memory console session under `/home/demo/console`, and
`demoSessions.ts` a short vendor-neutral transcript (greeting, one question, a listing of the sample repositories by their
sample names, exit). The existing demo leak tests cover it because they scan every transcript.

## Risks / Trade-offs

- [A console folder that is a workspace root lets the agent edit a tracked repository's main checkout] → That is the
  agent acting under its own permission prompts, the same trust model as any session; the dashboard itself writes
  nothing there, and the settings field states it plainly. Pointing it *at* a repository is refused, so the default path
  to "agent in a main checkout" is closed.
- [Optional `repoId`/`change`/`action` ripple through many files] → Done by narrowing with `isConsole()` at each boundary;
  the typechecker in `bun run check` is the guard, and the change-session code paths keep their current types after the
  narrowing.
- [Only the most recent console is shown; older ended console records pile up] → They count towards the 50-record prune,
  and Delete record works on the one shown.
- [Validation on save uses the file system, so a config valid on one machine may be refused on another] → Only
  `PUT /api/config` checks existence; loading never does, and open reports the reason.

## Migration Plan

Additive: `consoleDir` is optional and absent in existing configs, and existing session records have no `console` field
and are read as change sessions. Rollback is reverting the change; console records left behind are ignored by an older
build only if it tolerates missing `repoId` — `store.loadAll` requires only `worktreePath` and `agentId`, so they load,
and would show as broken rows. Acceptable for a local tool; mention it in the release notes.
