# Design

## Context

`deriveStage` (`src/shared/columns.ts`) is a pure function of `{ archived, artifacts, tasks }`. It reaches `done`
only when `tasks.done === tasks.total`, and `availableActions` (`src/shared/types.ts`) offers **Archive** only in
`done`. `TaskProgress` is `{ done, total }`, produced by `parseTaskProgress` (`src/server/tasksParser.ts`) from a
regex that accepts exactly `[ ]`, `[x]` and `[X]`, and the comment there says it mirrors what `openspec` counts.

So the whole question is what a leftover checkbox means. Today there is one answer for two situations: "still to
build" and "built, waiting on a person". Everything else — column, badge, starter, archive eligibility — follows from
telling those apart, which is why this change is mostly one new task state threaded through pure functions.

OpenSpec's archive workflow (`node_modules/@fission-ai/openspec/dist/core/templates/workflows/archive-change.js`)
states that a checkbox is complete only when its content is `x` or `X`, that `- [~]` and `- [-]` are incomplete
markers it assigns no meaning to, and that an unfamiliar marker must never be read as complete. That constrains the
design and is taken as given below.

`simplify-kanban-board` and `restructe-task-title` are merged but not archived; the board requirements modified here
start from their deltas, as `dismiss-task` did with its own baselines.

## Goals / Non-Goals

**Goals:**
- A change that is code-complete but awaiting a person is visibly distinct from one that is half-built, and can be
  archived.
- The distinction lives in the repository, so it survives a rescan, a different checkout and a deleted activity log
  (invariant 5).
- Nothing about today's two-state `tasks.md` changes: a repository that never writes `- [~]` behaves exactly as now.

**Non-Goals:**
- The dashboard writing `tasks.md`. See the proposal's non-goals.
- A `Validate` board column, or per-task validation state beyond the marker itself.
- Blocking archive on validation. `Archive` stays available for the whole `Done` column; the user decides.

## Decisions

### D1. `- [~]` in `tasks.md` is the signal, not dashboard-local state

The alternatives were a trailing `## Validation` heading and deriving the state from session history.

A heading needs no new marker, but it forces every validation task to the end of the file and cannot mark a stray
"check this in the browser" step inside section 5 — which is exactly the shape the leftovers in `dismiss-task` and
`integrate-console-detail-view` have. Session history was rejected outright: invariant 5 says the activity log is
never an input to columns, counts or actions, and session records are dashboard-local, so a change would show a
different state in a fresh install or after the log is deleted.

The marker travels with the change, is visible in the file, in a diff and in a pull request, and any checkout of the
repository derives the same state. The cost is that it is a convention this project introduces: OpenSpec does not
define it (D5), and a human writing `- [~]` by hand gets no validation of the spelling. Accepted — the same is true
of every other convention in `tasks.md`.

*Chosen because*: it is the only option that keeps the repository the source of truth.

### D2. `TaskProgress` gains `awaiting`; `done` keeps its meaning

```ts
export interface TaskProgress {
  done: number;      // `[x]` / `[X]` — unchanged
  awaiting: number;  // `[~]` — finished by the agent, not yet confirmed
  total: number;     // done + awaiting + open
}
```

`done` deliberately does **not** include `awaiting`. Every existing reader — the progress bar's fill, the `done/total`
label, `isComplete`, the overview counts — keeps working and keeps telling the truth: 13/15 means thirteen tasks are
verified. A change awaiting validation is therefore never shown at 15/15 until someone confirms it.

`awaiting` is optional in the type (`awaiting?: number`) so snapshots cached by an older version still load, the same
compatibility rule `checkout` and `specsSynced` already follow; readers treat a missing value as `0`.

*Alternative:* counting `[~]` as done and carrying a separate flag — rejected, it makes `13/15` read as `15/15` and
quietly turns every existing count into a claim nobody verified.

### D3. The sub-state is derived, and only `Done` has one

```ts
export type DoneSubState = "complete" | "validate";

// in deriveStage, replacing the `done` test:
const settled = tasks.done + (tasks.awaiting ?? 0);
if (tasks && tasks.total > 0 && settled === tasks.total) {
  return at("done", tasks.awaiting ? "validate" : "complete");
}
if (tasks && settled > 0) return at("implementing");
```

`deriveStage` returns `{ stage, column, subState? }`; `subState` is present only for `done`. `Stage`, `STAGE_COLUMN`
and `boardColumns` are untouched, so nothing that enumerates columns — filters, the overview, the demo, the archived
bound — has to change.

Note the second line: `implementing` now also triggers on awaiting-only progress, so a change whose agent marked the
first task `- [~]` and nothing else leaves `Ready` as it should.

*Alternative:* a `validate` value in `Stage` with `STAGE_COLUMN.validate = "Done"` — rejected, it breaks the type's
documented "each stage has exactly one board column" invariant and `Object.values(STAGE_COLUMN)` would yield `Done`
twice in `boardColumns`.

### D4. `Validate` is a fourth `SessionAction`, replacing `Implement` in that state

```ts
export const SESSION_ACTIONS = ["draft", "implement", "validate", "archive"] as const;
```

`availableActions` gains one line and changes one:

| stage | sub-state | starters |
|---|---|---|
| `ready`, `implementing` | — | Implement |
| `done` | `validate` | **Validate**, Archive |
| `done` | `complete` | Archive |

**Implement** is not offered alongside **Validate**: there is nothing left to implement, and offering it is the
mistake this change exists to prevent. It remains reachable — the user can type into the session — but it is not the
next step the card suggests.

Like every other starter, **Validate** appears only when the repository's agent has a prompt for it
(`startersFor` filters on `agent.prompts[action]`), so a user-defined agent profile without one simply shows
**Archive**. `nextStepFor` needs no change: `validate` is not `archive`, so it follows the default path and is typed
into the change's running session when there is one.

*Alternative:* no starter at all, just a badge and **Archive** — rejected, a phase with no action of its own is a
label, and the user's ask was to validate them, not only to see them.

### D5. The prompts carry the convention, and old ones migrate

The dashboard cannot teach OpenSpec what `- [~]` means, so the preconfigured `claude` profile's prompts do:

- **Implement** — `/opsx:apply {change}` plus: when a task can only be verified by me, do the work, then leave it as
  `- [~]` instead of `- [x]` so I can confirm it.
- **Validate** (new) — take the change's `- [~]` tasks one at a time, tell me exactly what to check, and tick off only
  the ones I confirm.
- **Archive** — today's text plus: tick off the tasks left for me to validate once I have confirmed them.

Each is one line, because a prompt may be typed into a terminal (`submit.ts`). `config.ts` already upgrades a saved
`claude` profile whose Archive prompt is verbatim one of `FORMER_ARCHIVE_PROMPTS`; this generalises that to a
`FORMER_PROMPTS: Record<PromptKey, readonly string[]>` and adds today's Archive and Implement texts to it. A prompt
the user edited, or removed, is left exactly as saved — unchanged rule, wider application.

The Archive prompt is the "simply archive and tick off the remaining boxes" path: because OpenSpec counts `- [~]` as
incomplete, `openspec archive` asks the user to confirm before archiving, and that confirmation is the validation.
The prompt turns the user's "yes" into ticked boxes, so the archived change records what was confirmed.

### D6. Presentation

The card's progress bar gets a third segment: filled for `done`, a hatched or muted segment for `awaiting`, empty for
the rest, labelled `13 + 2 awaiting / 15 Tasks`. Label, tooltip and accessible name all name the awaiting count —
colour is never the only cue (`kanban-board`: "Status labels use a semantic colour palette"). With `awaiting: 0` the
bar renders byte-for-byte as it does today.

The `Validate` badge uses the `warning` role, not `success`: the change is not finished. The `Done` column marker
stays `success`, because the column as a whole is still the done column.

In the detail view's checklist, an awaiting task renders as a third checkbox state (indeterminate, `aria-checked`
`mixed`), still `disabled`.

## Risks

- **A hand-written `- [~]` is silently wrong.** Someone types `- [-]` or `- [~ ]` and the task counts as open. Mitigated
  by the parser accepting `~` with the same tolerant spacing as `x`, and by the marker normally being written by the
  agent, not by hand.
- **`done/total` means something new to a reader who knows the old board.** A change can now sit in `Done` at 13/15.
  Mitigated by the badge and the bar's label, both of which say `awaiting` in words.
- **Prompt migration touching a prompt someone meant to keep.** Only an exact, verbatim match of a former
  preconfigured text migrates — the existing rule, and the existing test for it, extended to the new keys.
