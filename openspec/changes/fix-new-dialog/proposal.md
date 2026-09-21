# Proposal

## Why

In the "New change" form on a repository board, every keystroke in the optional prompt field throws the keyboard focus
back to the change name field, so the prompt cannot be typed at all. The name input carries an inline ref callback
(`ref={(el) => el?.focus()}` in `src/ui/newChangeForm.tsx`), and a ref whose identity changes on every render is
re-attached on every render — so the input is re-focused on every render of the form, including the renders caused by
typing in the prompt field and by the board's background poll.

## What Changes

- The change name input is focused **once**, when the form opens, and never again — not while the user types, not when
  the board re-renders around it.
- Focus-on-open moves out of the inline ref into a small helper used by the form, so the "focus once" behaviour has a
  unit test in a project with no DOM test harness.
- No change to validation, submission, the API, or anything the server writes.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `change-creation`: adds a requirement that the form takes the keyboard focus once when it opens and afterwards leaves
  it where the user puts it. The capability is introduced by the in-flight `create-change-from-dashboard` change (its
  code is merged; its spec is not synced into `openspec/specs/` yet), so this change's delta only **adds** a
  requirement and does not touch that change's files.

## Impact

- `src/ui/newChangeForm.tsx` — the change name input's focus handling.
- `src/ui/focus.ts` (new) — the focus-once helper.
- `test/focus.test.ts` (new) — its unit test.
- No server, API, config or repository-writing code is touched; no dependency is added.
