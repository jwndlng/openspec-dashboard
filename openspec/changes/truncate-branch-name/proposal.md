## Why

Branches are conventionally named after their change (`feat/<change-name>`), so the branch badge on a card is usually longer than the change name itself. Badges are `white-space: nowrap` with no width limit, so a long branch name does not fit the 272px column and runs out of the card — past its border, the repository group panel and sometimes the column. It looks broken and gets worse the better people follow the branch naming convention.

## What Changes

- The branch badge on a card never exceeds the card's content width. A branch name that does not fit is truncated with an ellipsis; one that fits is shown in full as today.
- Truncation keeps the **end** of the branch name visible (`⎇ …resource-control-policies` rather than `⎇ feat/introduce-resource-c…`), because the prefix (`feat/`, `fix/`, `chore/`) is the least informative part and the tail is what distinguishes branches of similar changes. The `⎇` glyph always stays visible.
- The full branch name remains available: as the badge's tooltip (together with the existing "a branch or worktree matches this change" hint) and as its accessible name, so nothing is lost to truncation.
- The badge wraps onto its own line inside the card's meta row when it does not fit next to the age/other badges, instead of squeezing them.
- The same rule applies to the current-branch badge in the repository board header, which can overflow on narrow windows for the same reason.
- Unchanged: which branch is matched and how (`branchMatch` detection), other badges, card layout otherwise. Pure presentation — no server, API or snapshot change.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `kanban-board`: **Cards show repository, name, progress, activity and branch** gains the rule that the branch badge stays within the card, truncating long names from the start with an ellipsis while exposing the full name via tooltip and accessible name; scenarios for a long and a short branch name are added.

## Impact

- `src/ui/kanban.tsx`: branch badge markup on `ChangeCard` (inner text span, `title` / `aria-label` with the full name) and the current-branch badge in the repository header.
- `src/ui/styles.css`: a truncating badge variant (`max-width: 100%`, `min-width: 0`, `overflow: hidden`, `text-overflow: ellipsis`, start-side truncation) and `min-width: 0` on the card meta row so flex children may shrink; token-based, no new colours.
- `src/ui/format.ts` + test, only if start-side truncation is done in code rather than CSS (decided in design).
- No dependency, API, config or data-model changes.
- Shares `kanban.tsx` / `styles.css` with the in-flight `collapsible-repo-groups` (group header) and `create-change-from-dashboard` changes; this one stays within the badge and card meta rules.
