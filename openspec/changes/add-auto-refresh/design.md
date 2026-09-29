# Design

## Context

See `proposal.md` — Why. What shapes the approach is the refresh machinery that already exists in `src/ui/app.tsx`:

- A `loadState()` callback fetches `GET /api/state` and, on load and then on `setInterval(pollIntervalSeconds)`, puts
  the snapshot in state. This only re-reads what the server already has; it triggers nothing.
- `refresh()` is the Refresh button's handler: it sets `refreshing`, calls `POST /api/scan`, then polls `api.state()`
  every 500ms for up to 40 tries until `generatedAt` differs from the snapshot it started with, and finally clears
  `refreshing`. It is a plain `async` function recreated on every render, closing over `snapshot?.generatedAt`.
- `POST /api/scan` answers `ScanTriggerResult { started: boolean }`, and `started` is `false` when a full scan was
  already in flight — the scanner refuses a second concurrent one (`change-scanner`). That flag is the cheap way to
  tell "a scan is now running for me" from "someone else's scan is running".
- Everything downstream — the boards, the overview and the change detail view — already re-renders off a new
  `snapshot` object, so nothing but `app.tsx` needs to know that a refresh happened more often.
- UI tests in this project exercise pure modules (`boardFilters.test.ts`, `groupState.test.ts`, `pullState.ts`), not
  rendered components. Anything worth testing has to live outside the component.

## Goals / Non-Goals

**Goals:**

- One refresh action shared by the button and the timer, with a single in-flight guard, so the two can never scan at
  once however they interleave.
- The interval logic — options, parsing, storage, and when the next tick is due — testable without a browser or a
  rendered component.
- No server, config or API change: the same two calls the button already makes.

**Non-Goals:**

- Live push from the server (SSE or a WebSocket on the snapshot). That is the right long-term answer to staleness and
  would make polling unnecessary, but it is a server capability of its own and not what this change is.
- Per-repository or per-view intervals, and any interval other than the three asked for.
- Changing `pollIntervalSeconds`, its 10s floor, or the baseline snapshot re-fetch. Auto-refresh sits beside them.
- Reducing what a scan costs. A 2s cadence on many large repositories is the user's choice to make, and `Off` is the
  default precisely because it is a choice.

## Decisions

### A `setTimeout` chain, rescheduled after each refresh finishes — not `setInterval`

`setInterval` fires on a fixed schedule regardless of how long the work takes, so at 2s against a 6s scan it would
queue three ticks per scan and the guard would spend its life dropping them. Chaining `setTimeout` from the end of
each refresh gives exactly the behaviour the spec asks for — "the next tick SHALL be timed from the refresh that
finished" — and makes a slow repository degrade into "as fast as scans complete" instead of a backlog.

*Alternative considered:* `setInterval` plus the in-flight guard. Same observable outcome in the easy case, but the
timer and the work drift apart and the effect becomes harder to reason about than the chain.

### One shared refresh action with a ref-based in-flight guard

`refresh()` becomes a `useCallback` with a `useRef<boolean>` guard, and returns immediately when the guard is set. The
guard is a ref rather than the existing `refreshing` state because state updates are batched: two callers in the same
frame would both read `refreshing === false` and both scan. `refreshing` stays, but only for the button's label — it
is presentation, not control. The button keeps calling `refresh()`; the timer calls the same function, so "the user
clicked Refresh while an automatic refresh is in flight" needs no extra case.

*Alternative considered:* a separate `autoRefresh()` that duplicates the scan-and-wait. Two code paths to keep in step
for no gain, and the cross-interleaving case would need its own guard anyway.

### The timer's effect depends on the interval and a stable action

The auto-refresh effect keys on the chosen interval and on the refresh callback. So that a snapshot arriving does not
tear the timer down and rebuild it, the callback must not depend on `snapshot`: the `generatedAt` it compares against
is read from a ref that `loadState` and `refresh` both keep current. This is also what lets the completion wait be
correct when the baseline poll happens to land mid-scan.

### `started: false` short-circuits the completion wait

On a tick, if `POST /api/scan` answers `started: false`, another scan is already running; the tick does not enter the
500ms wait loop but takes one `api.state()` and reschedules. This keeps a fast cadence from holding a 20s loop open
against a scan it did not start. The manual path keeps the full wait, because the user is watching the button.

### A pure `src/ui/autoRefresh.ts`, in the shape of `theme.ts`

The module owns the option list (`Off`, `2s`, `5s`, `10s`), `parseInterval` for an unknown or absent stored value,
`loadInterval`/`saveInterval` over `localStorage` behind `try`/`catch`, and the storage key. `theme.ts` is the
established pattern for "a per-browser UI preference": pure resolution plus thin storage effects, with the effects
tolerating storage being unavailable. Choosing `Off` removes the key rather than storing a zero, as `savePreference`
does, so a default that changes later is not shadowed by an old write.

*Alternative considered:* the URL, like the board layout and filters. Rejected: an interval is a standing preference
for this browser, not part of what a shared link should describe — a pasted link should not start scanning someone
else's machine every two seconds.

*Alternative considered:* the dashboard config. Rejected with the user: it needs an API schema change, it would be
shared across machines, and it invites confusion with `pollIntervalSeconds`.

### The chain itself is an injectable scheduler, not effect code

The no-overlap rule, the "timed from the refresh that finished" rule and the hidden/visible pause are the parts most
worth testing and the parts hardest to see by reading an effect. So `autoRefresh.ts` also exports a small scheduler —
given an interval, a `run()` that performs one refresh, and injected `setTimeout`/`clearTimeout` and a visibility
reading, it returns `start()`/`stop()`/`pause()`/`resume()`. It holds the in-flight flag and the pending handle; it
knows nothing about Preact, `api` or the DOM. The effect in `app.tsx` constructs it with the real timer functions and
`refresh` as `run`, and subscribes it to `visibilitychange`. A test drives it with a fake clock and a `run()` that
records calls and resolves when told, which is how the pile-up and interleaving scenarios get covered — including that
nothing but the refresh action is ever invoked, so no timer path can reach the pull action.

### Pausing on `visibilitychange`

The effect listens for `visibilitychange`: hidden cancels the pending timeout, visible again runs one refresh
immediately and restarts the chain. Refreshing at once on return is deliberate — coming back to the tab is exactly
when the user wants current data, and it makes the "hidden for ten minutes" scenario observable. Browsers already
throttle timers in background tabs, but throttling is not stopping, and a dashboard left open overnight should not
scan every repository thousands of times for nobody.

### The control is a native `<select>` dressed as a control

The filter bar's `.control.select-control` pattern (`boardFilters.tsx`'s Stale menu) is a `<label>` holding an icon, a
text label, a native `<select>` and a chevron; the native select fills the control so the whole thing opens it, and the
`.on` class marks a non-default value. Reusing it gives keyboard and screen-reader behaviour for free and an accessible
name from the label. The status corner runs smaller than the 34px filter bar, so the change is a size variant in
`styles.css`, not a new component. The `.on` state marks any interval other than `Off`, so "is this dashboard
refreshing itself" is visible at a glance and not only in the text.

## Risks / Trade-offs

- **2s against many or large repositories means near-continuous scanning** → `Off` is the default, the user picks the
  cadence knowingly, and the chain degrades to "as fast as scans finish" rather than piling up. The scanner's bounded
  concurrency, per-repository timeout and refusal of concurrent full scans are the existing back-pressure.
- **A permanently fast cadence keeps repository files in the page cache and burns CPU** → out of scope to fix here; the
  hidden-page pause removes the worst case (an open tab nobody is looking at).
- **The button would read "Scanning…" — and, being `disabled` while it does, go dead — every 2s** → only a refresh the
  user asked for takes the button over; an automatic tick refreshes quietly. What shows an automatic refresh is the
  `updated` age resetting and the interval control standing marked, so the corner stays calm and the button stays live
  between ticks. A click during an automatic refresh is harmless anyway, since `refresh()` is idempotent under the
  guard.
- **An error from an automatic refresh lands in the same header `error` badge as a manual one** → intended by the spec,
  but a repository that fails every tick will show a badge the user did not ask for. It is the same badge a failing
  scan already produces on the server's own poll, so nothing new appears.
- **Storage is per-origin, so the dashboard and the demo build keep separate choices** → correct, and the same is
  already true of the theme.
- **The `visibilitychange` pause could hide a stuck refresh** → the guard is cleared in `finally`, so a failed or timed
  out refresh releases it; hiding the page cancels the pending timeout, not an in-flight request.

## Migration Plan

None. Nothing is stored yet, so every existing user starts at `Off` and sees today's behaviour until they choose an
interval. The change is additive in the UI only: no config migration, no API version, no server change, and reverting
it leaves a stray `localStorage` key that the next read ignores.
