# Design

## Context

See `proposal.md` — Why. `src/ui/newChangeForm.tsx` focuses its first field with an inline ref callback:

```tsx
ref={(el) => el?.focus()}
```

Preact compares ref props by identity. An arrow function written in JSX is a new value on every render, so on every
render Preact detaches the old ref (calling it with `null`) and attaches the new one — which calls `focus()` again.
Every state update in the form (the prompt's `onInput`, the name's `onInput`, the error and busy flags) and every
re-render of the surrounding board (the poll refreshes the snapshot every few seconds) therefore pulls the focus back
into the change name input.

The project has no DOM test harness: `test/vnode.ts` walks Preact VNodes without a renderer and explicitly cannot
expand a component that uses hooks, and the UI tests (`pullUi`, `workStatusUi`, `sharedConfigUi`, `quickReplies`) all
test plain functions in `src/ui/*.ts`. Adding a DOM implementation as a dev dependency for a four-line fix is not
worth it, so the design puts the behaviour where the existing harness can reach it.

## Goals / Non-Goals

**Goals:**

- The form focuses its first field once, when it opens, and never moves the focus again.
- The "once" part is covered by a test that runs in `bun test` as it stands today.

**Non-Goals:**

- No DOM or browser test harness, and no new dependency.
- No change to how other components manage focus (`sessionPanel.tsx` focuses a terminal deliberately, on its own
  signals, and stays as it is).
- No visual, validation or submission change to the form.

## Decisions

**A stable callback ref from a tiny helper, over `useRef` + `useEffect`.**
`src/ui/focus.ts` exports `focusOnce()`, which returns a ref callback that focuses the first non-null element it is
given and ignores every later call:

```ts
export function focusOnce(): (el: { focus(): void } | null) => void
```

The form holds one instance for the life of the mounted component (`useMemo(focusOnce, [])`) and passes it as the
input's `ref`. Because the ref value is now stable, Preact attaches it once and does not re-run it on later renders;
the helper's own guard additionally covers the case where Preact does re-attach it (a keyed move, a future refactor).

The alternative, `const ref = useRef<HTMLInputElement>(null)` plus `useEffect(() => ref.current?.focus(), [])`, is the
more conventional Preact spelling and fixes the bug just as well, but it is only testable with a DOM. The helper is a
plain function over anything with a `focus()` method, so `test/focus.test.ts` can assert with a fake element that the
second and third calls do nothing — which is exactly the regression this change is about. The helper is three lines
and reusable if another dialog ever needs the same thing.

**Focus on open stays.** Opening the form to type the name immediately is the point of the action; the bug is the
repetition, not the initial focus. The spec states both halves so a later refactor cannot silently drop either.

## Risks / Trade-offs

- **A helper module for one call site reads as over-engineering.** → It exists to be tested; the decision above says
  so, and `src/ui/` already keeps small, single-purpose, testable modules (`format.ts`, `quickReplies.ts`,
  `groupState.ts`).
- **The unit test proves "focuses once", not "the browser focus stays in the prompt field".** → The remaining gap is
  the wiring (`ref={focusOnce}`), which is one line and is checked by hand in `bun run dev` against the scenarios in
  the spec delta.
- **Someone reintroduces an inline `ref={(el) => el?.focus()}` elsewhere.** → Not guarded automatically; the helper
  gives the next such case an obvious thing to reach for instead.
