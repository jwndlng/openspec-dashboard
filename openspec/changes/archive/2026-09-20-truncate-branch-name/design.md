## Context

`ChangeCard` in `src/ui/kanban.tsx` renders `<span class="badge brand mono">⎇ {card.branchMatch}</span>` inside `.card .meta` (a wrapping flex row). `.badge` is `display: inline-flex; white-space: nowrap` with no width constraint, and flex items default to `min-width: auto`, so the badge can neither wrap nor shrink: a branch like `feat/introduce-tenant-quota-enforcement` (≈ 290px in 11px JetBrains Mono) overflows a card whose content box is ≈ 230px (272px column − column, group-panel and card padding). The repository board header has the same construct for `repo.currentBranch`.

## Goals / Non-Goals

**Goals:**
- The branch badge never paints outside its card (or the header), at any column width.
- The most distinguishing part of the name — its end — stays readable; the full name stays reachable.
- CSS-driven: adapts to the real available width without measuring text in JavaScript.

**Non-Goals:**
- Changing how `branchMatch` is detected or which branch wins when several match.
- Making columns resizable or wider.
- Truncating other badges (none of them carries unbounded text).

## Decisions

### D1: Middle truncation with a two-part badge
The badge text is rendered as two adjacent spans: a **head** that may shrink (`flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis`) and a **tail** that never shrinks (`flex: none`). The browser truncates only the head, so the result reads `⎇ feat/intro…quota-enforcement`; when everything fits, no ellipsis appears and the badge looks exactly as today.

*Alternatives considered:*
- *End truncation* (`text-overflow: ellipsis` on the whole text): simplest, but cuts exactly the part that tells `…-enforcement` from `…-enforcement-v2` apart. Rejected.
- *Start truncation via `direction: rtl` + `<bdi>`*: pure CSS and keeps the tail, but bidi reordering of neutral characters (`/`, `-`, `.`) is fragile, Safari has a history of `text-overflow` bugs in RTL boxes, and it hides the type prefix. Rejected.
- *Truncating in JavaScript to N characters*: independent of the actual width, so it either truncates names that would fit or still overflows in narrow layouts. Rejected.

### D2: Where to split is a pure, tested helper
`splitBranchLabel(name, tailLength = 16)` in `src/ui/format.ts` returns `{ head, tail }`: names of `tailLength + 4` characters or fewer are returned as `{ head: name, tail: "" }` (nothing worth splitting); otherwise `tail` is the last `tailLength` characters, extended leftwards to the previous `-`, `/`, `_` or `.` if one is within 4 characters, so the tail starts at a word boundary where cheaply possible (`quota-enforcement`, not `uota-enforcement`). 16 mono characters at 11px ≈ 106px, which always fits the card.

### D3: Full name via `title` and `aria-label`
The badge gets `title="<full branch> — a branch or worktree matches this change"` and `aria-label="branch <full branch>"`; the two spans are `aria-hidden` so screen readers get the name once and unbroken. Selecting/copying the badge text still yields the full name, because the DOM contains all characters — only painting is clipped.

### D4: Layout rules
- `.badge.truncate { max-width: 100%; min-width: 0; }` and the glyph `⎇` sits in its own `flex: none` span.
- `.card .meta > * { min-width: 0; }` so the badge may shrink below its content width; `.meta` already wraps, so a long badge moves to its own line instead of squeezing the age badge.
- The repository header's current-branch badge reuses the same component and class, capped by the header's available width.
- A small `BranchBadge` component in `kanban.tsx` replaces both inline usages.

## Risks / Trade-offs

- [Two adjacent spans could show a visual seam or double spacing] → Both spans share font and have no gap/padding between them; the flex `gap` of `.badge` applies only between glyph and text wrapper, so the text parts live inside one inner inline-flex wrapper with `gap: 0`.
- [Tail starts mid-word for names without separators near the split] → Acceptable; the word-boundary nudge in D2 covers the conventional `type/kebab-case` names.
- [Concurrent edits to `kanban.tsx` / `styles.css` by other in-flight changes] → Touch only the badge markup, `.badge.truncate*` and the `.card .meta` child rule.
