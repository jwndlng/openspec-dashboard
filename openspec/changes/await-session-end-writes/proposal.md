# Proposal

## Why

When an agent's process exits, its exit handler starts `SessionManager.end()` and drops the promise. `end()` marks the
session `exited` at once and only then writes the scrollback and the record. `close()` waits for that state, and
`shutdown()` waits for the store's queued writes — but the record's write is queued only after the scrollback's, so
both can return while the record is still being written. A caller that removes the dashboard home next (every session
test's teardown) races that write: CI on macOS fails with `ENOENT … sessions/<id>/meta.json.<pid>.<n>.tmp` as an
unhandled error, on `main` and on every pull request since the project console tests landed. The same race lets
`close()` answer before the ended record is on disk.

## What Changes

- The session manager keeps the promise of every `end()` an exit handler starts, until it settles.
- `close()` waits for that promise after the process exited; `shutdown()` waits for all of them before waiting for the
  store, so nothing of the manager's is still writing when either returns.
- A failed write in such an `end()` is swallowed, as `touchLater` already does, instead of surfacing as an unhandled
  rejection that would take the dashboard down.

No behaviour described by a spec changes, so the change carries no spec deltas (`skip_specs: true`).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

_None._

## Impact

- `src/server/sessions/manager.ts` — the `ending` map, the exit handler, `close()`, `shutdown()`.
- `test/terminalSessions.test.ts` — a regression test: after `close()` and after `shutdown()` the record on disk is the
  ended one.
- No new dependency, no network, nothing written anywhere new; invariant 1 is untouched.
