# Design

## Context

All Settings panels use `<h2>` for both the section title and the groups inside it, and the global `h2` rule
(`styles.css`) makes every one of them a 13px, upper-case, `--fg-subtle` label — the same colour as the hints. The
Agent sessions section (`src/ui/agentSettings.tsx`) renders each profile as a `<details class="agent-card">` whose body
is one flat column of `label.agent-tools` blocks, each with a multi-sentence hint. `AgentEditor` is hook-free and
exported so `test/agentSettingsUi.test.ts` can render it without a DOM; that has to stay true. The section fetches
`api.sessions()` for three things — agent availability, preset availability and the session list — and uses the last
one only for the "Session worktrees" list being removed.

Requirements: `specs/settings-page/spec.md` (coloured headlines) and `specs/repo-discovery/spec.md` (the section's
groups and the profile's groups). Motivation: `proposal.md`.

## Goals / Non-Goals

**Goals:**
- One heading hierarchy for the whole Settings page: section headline (`h2`), group heading (`h3`), and inside an agent
  profile a field-group heading (`h4`).
- An agent profile that reads as three short groups instead of fourteen fields.
- Keep every control, its value binding and its draft/save semantics exactly as they are.

**Non-Goals:**
- No change to the section list, the navigation, deep links, or what any panel configures.
- No restyling of the board, overview, dialogs or the session panel; no new tokens unless an existing one fails the
  contrast rule (none does — see below).
- No new tabs, wizards or progressive disclosure beyond the existing per-profile expand/collapse.

## Decisions

**Scope the heading styles under `.settings`, not the global `h2`.** `.settings h2` becomes the headline: normal case,
~16px, weight 600, `--brand-fg`, with a little more space above the hint that follows; `.settings h3` is the group
heading: 13px, weight 600, `--fg-heading`, normal case; `.settings h4` (inside agent cards) is 12px, weight 600,
`--fg-subtle`, upper-case — the old label look, now one level lower where it fits. The global `h2` rule is untouched,
so other views are unaffected (spec: "Other views keep their headings"). `--brand-fg` is `#a5b4fc` on `--bg-section`
`#2d2e33` in dark and `#4338ca` on the light panel — both well above 4.5:1, so no new token is needed. Using the brand
accent for headings is within kanban-board's "accent only" rule as long as it is not a border or status colour; it is
neither. Alternative considered: a coloured left bar on each panel — rejected, a resting brand-coloured border is what
that rule forbids.

**Demote in-section `h2`s to `h3`.** "Ignored paths" (roots panel), "Repositories" (shared config) and the agent
section's "Agents", "Shortcuts", "Console", "Projects" become `h3`. Text is unchanged, so finds and tests by text still
work. The Environment headline keeps its inline count span.

**Replace the profile's `<details>` with an explicit disclosure.** The header must carry **Make default** and
**Remove agent** (spec), and interactive controls inside `<summary>` both toggle the disclosure on click and nest
buttons inside the summary's button role. Instead the card is a `div.agent-card` with a header row: a toggle `button`
(`aria-expanded`, `aria-controls`) showing name, command and badges, then the two action buttons beside it; the body
renders only when expanded. To keep `AgentEditor` hook-free, open state lives in `AgentSettings` (a `Set` of expanded
ids, seeded with the default agent, as `open={isDefault}` did) and arrives as `open` / `onToggle` props. Alternative:
keep `<details>` and `preventDefault` on the buttons — rejected for the nested-interactive accessibility problem.

**One `PromptField` for every prompt.** Each prompt becomes one block: a label (the action's name), the prompt input
(single-line for starters, textarea for Ship / Resolve conflicts / Integrate with the default as placeholder) and,
indented directly under it, "+ additional instructions" bound to `promptSuffixes[key]`. The shared rules move to one
line under each `h4`: Change starters — "Empty: the starter is not offered. `{change}` may be used."; Action prompts —
"Empty uses the default shown. `{change}` may be used, except in Integrate, which takes no placeholder." The
Integrate block keeps its own short "no placeholder" note because that rule differs. A small table-free helper keeps
the starter/action loops declarative (`[key, label, multiline, placeholder]`). Alternative: a two-column grid with
prompt and instructions side by side — rejected; the prompts are long and the narrow layout would stack them anyway.

**Command group first.** Name, command (textarea, one argument per line, with the `{prompt}` note shortened to one
line) and resume command sit together, since all three describe how the program is started.

**Drop the worktree list and the session state.** `AgentSettings` keeps calling `api.sessions()` for `agents` and
`presets` but no longer stores `sessions`; the `Session` import and the `worktrees` filter go. Open work remains the
place for worktrees (spec scenario "No worktree list in Settings").

**Copy edits stay faithful.** Shortened hints keep every fact the specs require the section to state (the risk
statement, worktree/in-place exception, per-project note); only repetition is removed.

## Risks / Trade-offs

- [Tests or the tour target the old markup, e.g. `details.agent-card` or `h2` text] → grep `test/`, `src/ui/tour*`
  and `src/ui/helpContent.tsx` for `agent-card`, `Session worktrees` and the demoted headings, and update them with
  the markup.
- [Collapsed profiles hide their fields from the browser's find in page] → unchanged from today (`<details>` hid them
  too in most browsers); the default profile is still expanded.
- [Brand-coloured headlines compete with primary buttons] → headlines are text only, no fill or border; the Save
  button remains the only filled brand element.
- [Conflict with in-flight changes touching `agentSettings.tsx`] → `add-validate-phase` is already on main; rebase
  before opening the pull request.
