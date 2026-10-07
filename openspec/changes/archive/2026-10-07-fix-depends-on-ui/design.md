# Design

## Context

`DependsOnField` (`src/ui/newChangeForm.tsx`) renders each choice as
`<li><input type="checkbox"> <label><span class="mono">name</span> <span class="hint">column</span></label></li>`.
The form-wide rule `.new-change label` makes every label `display: flex; flex-direction: column; gap: 6px` — right for
"caption above input" fields like the name and prompt. `.new-change .new-change-depends label` overrides `display`,
`gap` and `align-items` but not `flex-direction`, so the column direction leaks through: the name and the column stack,
and the checkbox (centred by the `li`) sits beside the pair instead of on the name's line.

The By label repository checklist (`.new-change-targets`) has the same markup shape and avoids the leak by making its
label `display: inline`.

## Goals / Non-Goals

**Goals:**
- Checkbox, name and column on one line per choice; column right-aligned; long names wrap inside the name only.
- A regression test that fails if the Depends on label goes back to a column layout.

**Non-Goals:**
- Changing the markup, the choices offered, the selection order or the request.
- Reworking the general `.new-change label` rule — the other fields rely on it.

## Decisions

- **Fix it in the Depends on rule, not the form-wide rule.** Add `flex-direction: row` to
  `.new-change .new-change-depends label` and keep it a flex row (not `display: inline` like the targets list) so the
  column hint's `margin-left: auto` keeps pushing it to the row's end and `min-width: 0` lets the name wrap.
  Alternative: give the label `display: inline` as `.new-change-targets` does — rejected, because the column would then
  follow the name directly instead of aligning at the end.
- **Align on the first line.** Set the `li` to `align-items: baseline` and the checkbox to `flex: none; margin: 0`, so
  when a long name wraps, the checkbox stays on the name's first line rather than centring against the wrapped block,
  and the box never shrinks.
- **Test the stylesheet text**, as `test/consoleLayout.test.ts` does: read `src/ui/styles.css`, find the
  `.new-change .new-change-depends label` rule and assert `flex-direction: row`. A rendering test is not available in
  `bun test`; the rule check catches the exact regression.

## Risks / Trade-offs

- [Baseline alignment of a native checkbox varies slightly between browsers] → acceptable; the `.new-change-targets`
  list next to it already uses `align-items: center` and looks right, so if baseline looks off in manual checking,
  fall back to `center` on the `li` with `flex-start` only on the label — verified in `bun run dev` before shipping.
