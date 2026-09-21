# Spec Delta

## ADDED Requirements

### Requirement: Cards show a prompt badge for changes with a prompt.md
A card SHALL show a `prompt` badge — text plus colour — when the change has a `prompt.md`. The badge's tooltip and accessible name SHALL contain the prompt's text as written. The badge MUST NOT affect artifact status, column placement, progress or session actions. When the change has no `prompt.md`, no such badge SHALL be shown.

#### Scenario: Change with prompt
- **WHEN** a change `add-audit-trail` has a `prompt.md` containing "Log every mutation"
- **THEN** the card shows a `prompt` badge whose tooltip contains "Log every mutation"

#### Scenario: Change without prompt
- **WHEN** a change has no `prompt.md`
- **THEN** the card shows no prompt badge

## MODIFIED Requirements

### Requirement: Copy apply command
Each card SHALL offer a copy action. For a change whose column is `Ready`, `Implementing`, `Done`, `Synced` or `Archived`, the action SHALL copy `cd <checkoutPath> && claude "/opsx:apply <changeName>"` to the clipboard. For a change in any earlier column (`New`, or any artifact column such as `Proposal`, `Design`, `Specs`, `Brief`, `Plan` — anything that is not yet `Ready`), the action SHALL instead copy a **start command** that continues drafting the change:

- Base: `cd <checkoutPath> && claude "/opsx:continue <changeName>"`.
- When the change has a `prompt.md`, the command SHALL be extended to point the agent at it: the start command SHALL be `cd <checkoutPath> && claude "/opsx:continue <changeName> — see openspec/changes/<changeName>/prompt.md"`.

`<checkoutPath>` is the path of the checkout the change's data comes from — the linked worktree of its leading copy, or the repository path when that is the main checkout. The action's label SHALL make clear which command it copies (an apply command or a start command). The dashboard MUST NOT execute the copied command.

#### Scenario: Copy
- **WHEN** the user clicks "Copy apply command" on change `multi-tenant-sync` in `/Users/x/Workspace/acme/forum-admin`, which lives in the main checkout and is in `Ready`
- **THEN** the clipboard contains `cd /Users/x/Workspace/acme/forum-admin && claude "/opsx:apply multi-tenant-sync"`

#### Scenario: Change lives in a worktree
- **WHEN** the user clicks "Copy apply command" on change `audit-trail` in `Ready` whose leading copy is in the worktree `/Users/x/Workspace/acme/forum-admin/.claude/worktrees/audit-trail`
- **THEN** the clipboard contains `cd /Users/x/Workspace/acme/forum-admin/.claude/worktrees/audit-trail && claude "/opsx:apply audit-trail"`

#### Scenario: Copy start command for a new change
- **WHEN** the user activates the copy action on change `add-audit-trail` in `New` in repository `/Users/x/Workspace/acme/forum-admin`, and the change has no `prompt.md`
- **THEN** the clipboard contains `cd /Users/x/Workspace/acme/forum-admin && claude "/opsx:continue add-audit-trail"`

#### Scenario: Start command points at prompt.md
- **WHEN** the same change also has a `prompt.md`
- **THEN** the clipboard contains `cd /Users/x/Workspace/acme/forum-admin && claude "/opsx:continue add-audit-trail — see openspec/changes/add-audit-trail/prompt.md"`

#### Scenario: Artifact column before Ready copies the start command
- **WHEN** the user activates the copy action on a change in `Proposal` (any column that is not `Ready` or later)
- **THEN** the clipboard contains a start command, not an apply command
