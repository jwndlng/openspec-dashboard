# Proposal

## Why

The Settings page is hard to scan. Every heading, whether it opens a whole section ("Agent sessions") or a small
group inside one ("Shortcuts"), is the same small, grey, upper-case label as every hint around it, so nothing tells
the reader where a section starts. The Agent sessions section is the worst case: one agent profile is a column of
fourteen fields with long hints in between, its Draft/Implement/Validate/Archive prompts and their additional
instructions come one after the other, and Ship, Resolve conflicts and Integrate follow in the same flat pattern. At
its end the section also lists "Session worktrees", which repeats less well what **Open work** in the top bar and the
change detail already show, and which cannot be acted on in Settings.

## What Changes

- Settings section headings become coloured headlines: each section opens with one heading in the brand accent colour,
  set apart from the hints by size and weight as well as colour; groups inside a section get a subordinate heading.
  Scoped to the Settings page, so the board, the overview and dialogs keep their headings.
- The Agent sessions section is restructured into fixed, headed groups in this order: the switch with its risk
  statement, **Agents**, **Shortcuts**, **Console**, **Projects**.
- Each agent profile card is split into headed groups: **Command** (name, command, resume command), **Change
  starters** (Draft artifacts, Implement, Validate, Archive) and **Action prompts** (Ship, Resolve conflicts,
  Integrate). Each prompt is shown with its additional instructions directly attached to it, and the long per-field
  hints are shortened to one line, with the rules that apply to every field (placeholders, "empty uses the default")
  stated once per group. The card's header carries its badges and the **Make default** / **Remove agent** controls.
- **Removed:** the "Session worktrees" list at the end of the Agent sessions section. Session worktrees stay visible
  and actionable in **Open work** and the change detail; nothing about them is configured in Settings.
- No configuration field, stored value, API route or behaviour of a session changes; every existing control stays,
  with the same meaning and the same draft/save-bar semantics.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `settings-page`: a new requirement that every Settings section opens with a coloured headline and groups within a
  section have a subordinate heading, distinguishable by more than colour and within the theme's contrast rules.
- `repo-discovery`: "Settings expose agent sessions with their risks stated" no longer lists session worktrees, now
  fixes the section's grouped structure (switch, Agents, Shortcuts, Console, Projects) and the grouping of a profile's
  fields; its stale wording about per-repository toggles in Settings is brought in line with Projects owning them.

## Impact

- `src/ui/agentSettings.tsx` — restructured section and `AgentEditor`; the session fetch keeps only what the
  availability badges and preset picker need (no `sessions` state); the worktree list is removed.
- `src/ui/settings.tsx`, `src/ui/sharedConfig.tsx`, `src/ui/environment.tsx` — section headings use the new headline
  markup/classes (text unchanged).
- `src/ui/styles.css` — Settings headline and subheading styles, agent card group layout; tokens only.
- `test/agentSettingsUi.test.ts` — grouping, prompt/instruction pairing, no worktree list.
- No server, config schema, API or demo data changes. `add-validate-phase` (in flight, already merged) also touched
  `agentSettings.tsx`; this change builds on main after it.
