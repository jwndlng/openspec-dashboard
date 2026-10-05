# Design

## Context

`deriveStage` (`src/shared/columns.ts`) is a pure function of `{ archived, artifacts, tasks }`. It runs in the scanner,
in `src/server/cache.ts` when cached snapshots are re-derived at start-up, and in the demo. It only sees
`ArtifactStatus { id, status }` — it does not know the schema. The schema, including `apply.requires`, is only known
to `readChangeArtifacts` in `src/server/openspecAdapter.ts`, which already reads `schema.apply` to find the tasks file.

## Goals / Non-Goals

**Goals:**
- `Ready` decided by the schema's `apply.requires`, the same way on the server, in the cache and in the demo.
- Old cached snapshots keep their current column until rescanned — no change appears to jump on start-up.

**Non-Goals:**
- No new column, sub-state or card badge for "optional artifact missing".
- No change to when **Draft artifacts** is offered (still: any artifact not done), nor to the detail view's artifact
  tabs or their `ready`/`blocked` states.
- No hard-coded artifact names (`design`, `tasks`) anywhere in the board logic.

## Decisions

**D1 — A per-artifact `required` flag on `ArtifactStatus`, not a change-level list.** `ArtifactStatus` gains
`required?: boolean`, set by `readChangeArtifacts` from `schema.apply?.requires` (every artifact when absent).
`deriveStage` then needs no new input: it already receives the artifacts, and so does every caller, including the
cache re-derivation. *Alternative:* `ChangeSnapshot.applyRequires: string[]` passed into `deriveStage` — one more
field every caller must thread through, and two sources to keep consistent.

**D2 — Missing flag means required.** The scanner sets the flag on every artifact (`true` or `false`), so a change
whose artifacts carry no flag at all was recorded before this change, and then every artifact counts as required: `const required = artifacts.some((a) => a.required !== undefined)
? artifacts.filter((a) => a.required) : artifacts`. This keeps snapshots cached by older versions (and the demo's
hand-written artifacts, unless they opt in) on today's rule. An empty required set (a schema whose `apply.requires`
lists ids that do not exist) also falls back to every artifact, so a change can never be `Ready` with nothing written.

**D3 — Order of checks stays.** `Done` and `Implementing` are still decided by tasks first, `Unknown` by no artifacts,
then `Ready` by required artifacts, then `Backlog`/`Drafts` by the count of done artifacts over all artifacts. A
change with only `tasks.md` is therefore `Ready` (per the user's chosen rule), not `Drafts`.

**D4 — Copies across worktrees.** `src/server/mergeChanges.ts` ranks copies by stage first, then by number of done
artifacts; it needs no change — a copy that became `Ready` without a design already outranks one in `Drafts`.

## Risks / Trade-offs

- [A `spec-driven` change with `tasks.md` but no proposal or specs shows as `Ready`] → This is OpenSpec's own
  `applyRequires` semantics and the user's chosen rule; **Draft artifacts** stays offered, and the card's
  progress/warnings are unchanged.
- [Activity log records `Drafts → Ready` moves for existing changes without a design on the first scan after upgrade]
  → Correct and expected: they really are ready now. History only; nothing is derived from it.
- [Custom schemas with a sloppy `apply.requires`] → They now control `Ready`; an empty or unknown list falls back to
  every artifact (D2).
