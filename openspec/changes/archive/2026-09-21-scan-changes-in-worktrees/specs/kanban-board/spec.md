## MODIFIED Requirements

### Requirement: Copy apply command
Each card SHALL offer a "Copy apply command" action that copies `cd <checkoutPath> && claude "/opsx:apply <changeName>"` to the clipboard, where `<checkoutPath>` is the path of the checkout the change's data comes from — the linked worktree of its leading copy, or the repository path when that is the main checkout. The dashboard MUST NOT execute the command.

#### Scenario: Copy
- **WHEN** the user clicks "Copy apply command" on change `multi-tenant-sync` in `/Users/x/Workspace/acme/forum-admin`, which lives in the main checkout
- **THEN** the clipboard contains `cd /Users/x/Workspace/acme/forum-admin && claude "/opsx:apply multi-tenant-sync"`

#### Scenario: Change lives in a worktree
- **WHEN** the user clicks "Copy apply command" on change `audit-trail` whose leading copy is in the worktree `/Users/x/Workspace/acme/forum-admin/.claude/worktrees/audit-trail`
- **THEN** the clipboard contains `cd /Users/x/Workspace/acme/forum-admin/.claude/worktrees/audit-trail && claude "/opsx:apply audit-trail"`

## ADDED Requirements

### Requirement: Cards say which checkout a change lives in
The board SHALL show a change once per repository regardless of how many checkouts hold a copy of it. When a change's data comes from a linked worktree, its card SHALL show that worktree's branch in the branch badge, and the badge's tooltip SHALL state the worktree's path. When other checkouts hold a copy, the tooltip SHALL list them with their branch (or "main checkout", or "detached") and column. The card MUST NOT require the change to exist in the main checkout.

#### Scenario: Worktree-only change
- **WHEN** change `audit-trail` exists only in a worktree on `feat/audit-trail`
- **THEN** the board shows one `audit-trail` card with the badge `feat/audit-trail` whose tooltip names the worktree path

#### Scenario: Copies in several checkouts
- **WHEN** `audit-trail` is `Implementing` in a worktree and `Proposal` in the main checkout
- **THEN** one card is shown in `Implementing`, and its badge tooltip lists the main checkout with `Proposal`
