# Design

## Context

See `proposal.md` for why. Today the setting reaches only Ship: `SessionManager.ship()` asks
`shipsOnlyOpenSpec(worktree, baseRef(repo))` and passes `autoMerge` to `shipPrompt()`, which appends
`AUTO_MERGE_DOCS_INSTRUCTION` after the profile's suffix. Archive prompts come from `openingPrompt()` on two paths:

- `SessionManager.open()` — computes the prompt **before** the worktree exists (it refuses early when the agent has no
  Archive prompt), then creates the worktree and launches. Archive always gets a fresh worktree and branch of its own
  (`archive-<change>`), branched by `ensureWorktree` from `origin/HEAD` or `HEAD` — the same ref `baseRef()` returns —
  unless that branch is left over from an earlier archive, in which case the existing branch is checked out.
- `SessionManager.prompt()` — types a starter's prompt into the change's running session, whatever worktree that is
  (often the Implement worktree, which carries code).

`open()` may also return an already-open session without typing anything.

## Goals / Non-Goals

**Goals:**
- One docs-only decision shared by Ship and Archive, differing only in whether "nothing changed yet" counts.
- The archive instruction composed in the same place and order as Ship's: last, after the profile's suffix.
- Every failure mode falls back to today's prompt, byte for byte.

**Non-Goals:**
- Checking anything after the agent ran (what the pull request finally contains is the agent's check, per the
  instruction, and GitHub's required checks).
- Changing Ship's check, prompt or result.

## Decisions

### D1 — One check, an `allowEmpty` option

`shipsOnlyOpenSpec(worktreePath, base, { allowEmpty = false } = {})` — same path collection, and the final test becomes
`(allowEmpty || paths.length > 0) && paths.every(underOpenSpec)`. Ship keeps `allowEmpty: false` ("nothing to ship" is
not docs-only); Archive passes `true` because a fresh archive worktree has no path yet and is exactly the case to
cover. A separate function was rejected: two copies of the rename/untracked parsing would drift. The name stays (it
answers "would shipping this hand over only OpenSpec documents"); the doc comment gains the Archive use.

### D2 — A separate, conditional constant

`AUTO_MERGE_DOCS_ARCHIVE_INSTRUCTION` in `src/shared/types.ts`, next to Ship's. Ship's text presumes a pull request
("once the pull request is open"); the default Archive prompts open none, and an agent told "once the pull request is
open" may well open one to comply. So the archive text is conditional — *if* you open a pull request for this work —
and says explicitly not to open one just for this. Reusing Ship's constant with a prefix was rejected: two sentences
pulling in different directions in one prompt. One line, agent-neutral, no placeholder.

### D3 — Composition in `openingPrompt`

`openingPrompt(agent, action, change, { autoMerge = false } = {})` appends the archive instruction after `compose()`
when `autoMerge && action === "archive"` — ignoring it for any other action, so a caller mistake cannot leak the
instruction into Implement. Appended after `{change}` substitution, like Ship, so the fixed text is never substituted.

### D4 — `open()`: compose after the worktree exists

The early `openingPrompt()` call stays as the availability check (refusing before any worktree is created). After
`ensureWorktree`/`copyChangeIfMissing`, and only for `action === "archive"`, not in place, and
`repo.agent?.autoMergeDocs === true`, the manager runs `shipsOnlyOpenSpec(session.worktreePath, await
baseRef(repo.path), { allowEmpty: true })` and re-composes the prompt with `autoMerge`. The copied change directory is
untracked under `openspec/changes/<name>/`, so it does not defeat the check. `open()` returns
`StartResult = Session & { autoMerge: boolean }`; the early-return of an existing session carries `autoMerge: false`
(nothing was typed). The route (`POST /api/sessions`) already returns whatever `open()` returns.

Rejected: deciding before the worktree exists from the base alone — a leftover `archive-<change>` branch with code in
it would be missed.

### D5 — `prompt()`: same check in the session's worktree

For `action === "archive"`, a non-in-place session and the setting on, `prompt()` runs the same check in
`session.worktreePath` before typing. `prompt()` returns `AutoMergePromptResult = PromptResult & { autoMerge: boolean }` (always `false` for other
actions); `ShipResult` becomes an alias of it so its call sites don't move. `PromptResult` itself is unchanged, because
Resolve conflicts returns it too and has no auto-merge to report. The "no git command"
sentence of the send requirement narrows to "no git command that writes" (spec delta).

### D6 — UI notice per action

`autoMergeId` in the session UI context becomes `autoMerge?: { id, action: "ship" | "archive" }`. Reading the
session's recorded action at render time was rejected: it changes when the next prompt is sent, while the notice is
still shown. `AUTO_MERGE_NOTICE` becomes `autoMergeNotice(action)`: Ship keeps today's sentence; Archive says
the agent was asked to enable auto-merge **if it opens a pull request**, because only OpenSpec documents are in the
worktree. `sessions.tsx`'s `start` reports it from both `openSession` and `promptSession` results, opening the panel's
notice the same way Ship does. The demo's `open`/`prompt` return `autoMerge: false`.

## Risks / Trade-offs

- [The agent opens a pull request because the instruction mentions one] → the text says not to; the instruction is
  conditional, and the user's own Archive additional instructions decide whether a pull request is opened.
- [The archive session later writes code, so its pull request is not docs-only] → the instruction makes the agent
  re-check every file of the pull request before enabling auto-merge, and GitHub's required checks still run; the
  dashboard's check is a gate on asking, not a guarantee.
- [Repository without required checks merges immediately once auto-merge is enabled] → unchanged from Ship; README
  states it.
- [Extra git calls on every Archive start] → two read-only commands, only when the setting is on.
