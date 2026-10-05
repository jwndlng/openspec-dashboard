# Design

## Context

See `proposal.md` for the motivation and the delta specs for the requirements. Today:

- `src/server/pullRequests.ts` runs `gh pr list --json <FIELDS>` per GitHub repository and caches the parsed
  `PullRequest`s (cache file version 1). `checks` is already summarised (`summarizeChecks`); mergeability is not read.
- `src/shared/pullRequestLink.ts` derives the one pull request a change links, on display only.
- `src/ui/pullRequestsState.ts` `createPrRefresher` is the single place the UI starts a refresh: one at a time,
  `refreshIfStale` / `openBoard` gate on the five-minute freshness window. `POST /api/pull-requests/refresh` takes
  `{ repoId?, force? }`.
- A card is "live" (`.card.live`: tint + name sweep) only via `cardIsLive`, derived from session badges.
- Invariant 4 in `CLAUDE.md` and the `pull-requests` spec forbid any timed `gh` run. This change carves out the board's
  watch, as agreed with the user.

## Goals / Non-Goals

**Goals:**
- One pure readiness rule in `src/shared/`, used by card, header and watch.
- A watch schedule that is pure and testable without Preact or timers, with the timer wiring kept thin.
- No new `gh` subcommand; no change to what the server does on its own.

**Non-Goals:**
- Review approval or branch-protection state (`mergeStateStatus` `BLOCKED`/`BEHIND`) in readiness.
- Watching from the Pull requests view, the detail view or the overview.
- Notifications (sound, OS) when a pull request turns ready.
- Any action on the pull request (re-run checks, update branch).

## Decisions

### D1 — Read `mergeable` with the existing `gh pr list` call

Add `mergeable` to `FIELDS` and map `MERGEABLE`/`CONFLICTING`/`UNKNOWN` (any other or missing value → `unknown`) onto
`PullRequest.mergeable: "mergeable" | "conflicting" | "unknown"`. `mergeStateStatus` is rejected: it folds in required
reviews and "behind base", which the user explicitly did not ask for, and it differs per branch-protection setup.
Fetching per-pull-request details (`gh pr view`, `gh api`) is rejected: it is a new subcommand under invariant 1.

The type gets `mergeable` as an optional field on read paths: cache files written before this change stay at version 1
and simply lack it, and the readiness rule treats a missing value as `unknown`. No cache version bump, so an upgrade
does not throw away cached lists; the first refresh fills the field. GitHub computes mergeability lazily, so the first
list after a push often says `UNKNOWN` — that is exactly what the one-minute watch absorbs.

### D2 — `src/shared/pullRequestReadiness.ts`

```ts
type Readiness =
  | { ready: true }
  | { ready: false; reason: "draft" | "conflicts" | "checks failing" | "checks running" | "mergeability unknown"; inProgress: boolean };
export function pullRequestReadiness(pr: PullRequest): Readiness | undefined; // undefined unless state === "open"
```

Defensive like `linkedPullRequest` (cache contents are untrusted shapes). The reason order makes "needs a human"
(draft, conflict, failure) outrank "still computing", so a conflict with running checks is reported as a conflict.
A sibling helper `readinessRole(readiness)` maps to status roles (`success`/`danger`/`warning`/`branch`) so the card
and header cannot drift.

### D3 — The card's working state is the union of two sources

`cardIsLive` stays about sessions. A new pure `cardWorkingState(card, sessions, config, now)` returns
`{ tinted: boolean; sweeping: boolean }`: tinted when the session rule says live **or** the linked PR is open and not
ready; sweeping when the session is live **or** the PR is in progress. The card renders `.card.live` for tinted and a
separate modifier (`.card.pr-waiting`) that turns the name sweep off when only a waiting PR tints it. Reusing the
existing class keeps both themes and `prefers-reduced-motion` handling for free. The tint must not suppress starters,
because `cardSessionControls` is untouched.

Alternative rejected: a new tint colour for "waiting on GitHub". The user asked for the *working* state, and a third
card background would compete with repository panel hues.

### D4 — The watch is a pure schedule plus a thin hook

In `pullRequestsState.ts`:

```ts
export function watchPlan(cards, lists, now, lastSettledAt): { repoIds: string[]; dueAt: number } | undefined;
```

`repoIds` are the repositories of cards whose linked PR is open and not ready, excluding lists whose status is
`unavailable`; `dueAt` is `lastSettledAt + 60 s` if any of them is in progress, else `+ 5 min`; `undefined` means no
watch. `createPrRefresher` gains `lastSettledAt` tracking and `watch(repoIds)` which is `refresh({ repoIds, force: true })`
unless one is in flight, and is a no-op when `synthetic`.

The board (`kanban.tsx`) owns a `useEffect` that recomputes the plan whenever cards, lists or visibility change and
sets a single `setTimeout` to `dueAt` (clamped to ≥ 0). It clears the timer on unmount and on
`visibilitychange` → hidden, and recomputes on visible. Because the plan is recomputed from the answer, "ready ends the
watch" needs no extra code. Only one board is mounted at a time, so there is one watch.

Alternative rejected: server-side polling. It would make the server contact GitHub with no view open, which is the
thing invariant 4 most wants to avoid, and would need a lifecycle for "is anyone looking".

### D5 — `repoIds` on the refresh endpoint

`POST /api/pull-requests/refresh` accepts `repoIds: string[]` (each validated like `repoId`; unknown or disabled → 404,
non-array/non-string → 400; `repoId` and `repoIds` together → 400). `PullRequests.refresh` takes
`options.repoIds` and filters `byGithub` groups to those containing any listed id. The crossSiteRefusal guard is
unchanged since the route already passes through it.

### D6 — Invariant and docs wording

`CLAUDE.md` invariants 1 and 4 and `README.md` gain one clause: "…or while an open Kanban board shows a linked pull
request that is not ready (the board's watch, at most once a minute, only for those repositories, paused while the tab
is hidden)". `test/pullRequestsApi.test.ts`'s proof that scans and discovery start no `gh` stays as is.

## Risks / Trade-offs

- [`gh pr list` returns `UNKNOWN` mergeability for a long time on large repositories] → the reason reads
  `mergeability unknown` and the watch keeps asking every minute; it never claims ready. Acceptable.
- [A board left open all day with a perpetually failing PR] → waiting PRs are polled every five minutes only, and the
  watch pauses while the tab is hidden; two `gh pr list` calls per five minutes per repository is in line with the
  existing freshness window.
- [GitHub API rate limits] → at most one refresh at a time, concurrency 3, only watched repositories; a failure is
  reported like any other refresh failure and keeps the previous list.
- [Tint without a session confuses users who read tint as "agent running"] → the session badge still says `ended`
  or nothing, and the PR badge says why; the help page explains the working state.
- [Older cache lacks `mergeable`] → treated as `unknown`, so a cached open PR shows `mergeability unknown` until the
  first refresh — which opening the board triggers when the cache is stale.

## Migration Plan

No migration. Older caches load unchanged (D1). Rolling back leaves an extra `mergeable` field in the cache that the
older version ignores.
