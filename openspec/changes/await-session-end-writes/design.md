# Design

## Context

See proposal.md — Why. `SessionStore.serial` queues writes per session and `idle()` awaits what is queued *now*;
`end()` queues its second write only after its first finishes, so `idle()` can resolve in between.

## Decisions

**D1 — Track the exit handler's `end()` in the manager, not in the store.** A `Map<sessionId, Promise<void>>` set in
the exit handler and cleared when the promise settles (only if it is still the entry, so a later end of a resumed
session is never dropped). The store cannot know that more writes are coming; the manager can.
Alternative: make `idle()` loop until the queue stays empty — rejected, because it would still race a write queued
after a tick of unrelated work, and it hides the dependency instead of naming it.

**D2 — `close()` keeps its short state poll and then awaits the entry.** The exit handler is registered before
`close()` awaits `proc.exited`, so the entry exists by the time `close()` resumes; the poll stays as a harmless guard.

**D3 — Swallow the error on the tracked promise.** It was already unawaited, i.e. an unhandled rejection; the record
is bookkeeping, and `touchLater` sets the precedent.

## Risks / Trade-offs

- [`close()` now takes as long as two small file writes longer] → Negligible; it is what callers assumed already.
