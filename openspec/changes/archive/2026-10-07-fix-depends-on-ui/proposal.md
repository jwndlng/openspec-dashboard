# Proposal

## Why

In the **New change** form, each entry of the **Depends on** field breaks across lines: the change's name and its
column are stacked under each other next to the checkbox instead of sitting on one line with it, so the list looks
broken and takes twice the height. The row's label inherits the form's general label layout (a vertical stack meant for
"caption above input" fields), and the Depends on rule overrides the display but not the direction.

## What Changes

- Each **Depends on** entry shows its checkbox, the change name and its column on one line, the column right-aligned,
  like the By label repository checklist in the same form. A long name may still wrap within its own text, but never
  pushes the column or the checkbox onto a separate line of their own.
- Stylesheet only: no change to what is offered, selected, sent or written.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `change-creation`: the requirement "The form can declare the change's dependencies" states that each choice is shown
  on one line — checkbox, name, column — so the layout is part of the contract and covered by a test.

## Impact

- `src/ui/styles.css` — the `.new-change-depends` rules.
- `test/` — a stylesheet check for the Depends on row layout, in the manner of `test/consoleLayout.test.ts`.
- No API, server, file-system or git behaviour changes; no new dependency.
