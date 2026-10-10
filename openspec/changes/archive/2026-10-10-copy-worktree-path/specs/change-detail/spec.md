## ADDED Requirements

### Requirement: The detail header shows and copies the change's worktree path
The detail header's facts row SHALL show, when the change has a worktree, a worktree badge: a folder glyph and the
worktree's absolute path in monospace. The worktree SHALL be, in this order: the linked worktree the change's data comes
from (the snapshot's `checkout`, when it is not the main checkout); otherwise the change's session worktree under the
dashboard home, and of several the one with the most recent activity. A change whose data comes from the main checkout
and that has no session worktree, a change of a repository that is not a git repository, and a change gone from the
snapshot SHALL show no worktree badge. The badge MUST NOT extend beyond its container: a path that does not fit SHALL
be shortened before its last segment with an ellipsis so that its end — the worktree directory's own name — stays readable,
and the full path SHALL be its tooltip.

Activating the badge SHALL write the worktree's absolute path to the clipboard, and nothing else: no `cd`, no quoting,
no whitespace. It SHALL then show for a short while that the path was copied, announced as `Copied`; when the clipboard
refuses the write, it SHALL NOT claim success. Its accessible name SHALL say what it copies (`Copy worktree path
<path>`). The badge SHALL be reachable with the keyboard, SHALL NOT open the Console tab, start a session or otherwise
act on the change, and is drawn as quietly as the branch badge. It is derived from the snapshot and the session
worktree list the view already has: showing or copying it writes nothing to any repository, runs no git command and
contacts no other host.

#### Scenario: A change in a linked worktree
- **WHEN** `audit-trail` of `demo-ops` is `Implementing` in a linked worktree at `/w/acme/demo-ops-audit-trail` on `feat/audit-trail`
- **THEN** its detail header shows a worktree badge reading `/w/acme/demo-ops-audit-trail`, and activating it puts exactly `/w/acme/demo-ops-audit-trail` on the clipboard and briefly announces `Copied`

#### Scenario: A change with a session worktree
- **WHEN** a change's data comes from the main checkout and an agent session worktree exists for it under the dashboard home
- **THEN** its detail header shows that session worktree's path as the worktree badge

#### Scenario: Several session worktrees
- **WHEN** a change has two session worktrees, one last active yesterday and one an hour ago
- **THEN** the worktree badge shows the one active an hour ago

#### Scenario: No worktree
- **WHEN** a change lives only in the main checkout and has no session worktree
- **THEN** its detail header shows no worktree badge

#### Scenario: Long path
- **WHEN** the worktree path is longer than the facts row leaves room for
- **THEN** the badge shows the path's beginning, an ellipsis and the worktree directory's name, stays inside the header, and presents the full path on hover and to a screen reader

#### Scenario: Clipboard refused
- **WHEN** the browser refuses the clipboard write
- **THEN** the badge does not announce `Copied`
