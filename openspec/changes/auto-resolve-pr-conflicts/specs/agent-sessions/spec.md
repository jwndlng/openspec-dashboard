# Spec Delta

## MODIFIED Requirements

### Requirement: Every session worktree has a work status
For every directory under `~/.openspec-dashboard/worktrees/<repoId>/` of a configured repository the dashboard SHALL derive a work status from local git, using read-only commands and without contacting a remote. The base is the repository's default branch as locally known (`origin/HEAD`), or the main checkout's `HEAD` when there is none. The status SHALL be the first that applies: `missing` when the directory is not a git worktree; `uncommitted` with the number of changed or untracked files; `merged` when the branch has no commit that the base lacks and a remote-tracking branch of the same name exists, or when every file the branch changed has the same content in the base (which also recognises squash and rebase merges); `clean` when the branch has no commit that the base lacks; `unpushed` with the number of commits ahead of its upstream, or all commits the base lacks when it has no upstream; otherwise `pushed`. Statuses MAY be cached for up to 15 seconds and MUST be recomputed after a session ends, a Ship action or a worktree removal. Because nothing is fetched, `merged` reflects the user's last fetch; the UI MUST say so.

For a status of `uncommitted`, `unpushed` or `pushed` the dashboard SHALL additionally determine whether merging the worktree's branch into that same base would conflict, and report the conflicting paths with it, capped at a bounded number. The check SHALL be made by merging the two commits in memory only: it MUST NOT change the worktree's or the main checkout's working tree, index, `HEAD` or any ref, MUST NOT contact a remote, and any objects git writes for it MUST be directed into a scratch object store under `~/.openspec-dashboard/`, so that nothing is created inside the tracked repository. When the check cannot be made — there is no base, git is too old for it, or it fails for any other reason — the work status SHALL simply carry no conflict information, and the dashboard MUST NOT treat that as an error or fall back to a check that writes. Because nothing is fetched, a conflict is a statement about the base as of the user's last fetch, and the UI MUST say so and MUST point at the pull action as the way to refresh the base.

#### Scenario: Uncommitted files
- **WHEN** a session's worktree contains two modified files and one untracked file
- **THEN** its work status is `uncommitted` with a count of 3

#### Scenario: Committed but not pushed
- **WHEN** the worktree is clean and its branch has two commits and no upstream
- **THEN** its work status is `unpushed` with a count of 2

#### Scenario: Pushed
- **WHEN** the worktree is clean and its branch equals its upstream but the base lacks its commits and content
- **THEN** its work status is `pushed`

#### Scenario: Squash-merged
- **WHEN** the base contains one commit with the same file content as the branch's three commits
- **THEN** its work status is `merged`

#### Scenario: Worktree without a session record
- **WHEN** a session's record is deleted while its worktree holds uncommitted files
- **THEN** the worktree is still listed with status `uncommitted`

#### Scenario: No network
- **WHEN** work statuses are computed
- **THEN** no git command that contacts a remote is run

#### Scenario: Branch that no longer merges
- **WHEN** the base and the worktree's pushed branch have both changed the same lines of two files
- **THEN** the work status is `pushed` and reports a conflict naming those two files

#### Scenario: Branch that still merges
- **WHEN** the base has moved ahead with commits that touch other files than the worktree's branch
- **THEN** the work status reports no conflict

#### Scenario: The check leaves the repository untouched
- **WHEN** work statuses including the conflict check are computed for a repository whose branch conflicts
- **THEN** no file in the repository's working tree, index, refs or object database is created, modified or deleted, and the worktree's `HEAD` and `git status` are unchanged

#### Scenario: The check is unavailable
- **WHEN** the installed git cannot merge two commits without touching the working tree
- **THEN** every work status is still reported, none carries conflict information, and no error is shown

## ADDED Requirements

### Requirement: Resolve conflicts asks the agent to make the branch mergeable again
For a session whose worktree reports a conflict the dashboard SHALL offer a Resolve conflicts action. It uses the agent profile's resolve-conflicts prompt, or an agent-neutral default asking the agent to bring the branch up to date with the base, resolve the conflicts while keeping what the branch set out to do, run the project's checks and push the result. When the session is running the prompt SHALL be submitted to its terminal under the rules for text sent on the user's behalf, so that one activation sends it; otherwise the agent SHALL be started in the session's worktree — with its resume command and the prompt submitted after start-up when it has one, else with its command and the prompt as opening prompt — in the same session record, under the same checks as Ship. The result SHALL state whether the prompt was submitted, and when it was only typed the panel SHALL say so.

The dashboard itself MUST NOT resolve anything: it MUST NOT merge, rebase, cherry-pick, check out, commit, push, or write any file in the repository for this action. Everything beyond handing over the prompt is the agent's doing under its own permission prompts.

The resolve-conflicts prompt SHALL be a configurable prompt of the profile like any other: it MAY use `{change}` and no other placeholder, MUST NOT carry a permission-bypass mode or flag, SHALL be offered in Settings beside the other prompts, and SHALL take that key's additional instructions — appended to the profile's prompt, or to the agent-neutral default when the profile has none, exactly as Ship does. Additional instructions for another action MUST NOT reach it.

The action SHALL NOT be offered, and a request for it SHALL be refused with the reason, when the worktree reports no conflict, when its status is `missing`, `clean` or `merged`, when the conflict check was unavailable, or for an in-place session, which has no worktree and no branch. The offered action SHALL name the base it conflicts with and SHALL say that this is as of the user's last fetch.

#### Scenario: Resolving in a running session
- **WHEN** Resolve conflicts is used on a running session whose worktree conflicts and whose agent waits at its text prompt
- **THEN** the prompt is typed, shown by the agent, submitted with a separate Enter, and no git command that changes the repository is run by the dashboard

#### Scenario: The agent shows a menu
- **WHEN** Resolve conflicts is used on a running session whose agent shows a selection menu
- **THEN** no Enter is pressed, nothing is confirmed, and the panel says the prompt was typed but not sent

#### Scenario: Resolving after the session ended
- **WHEN** Resolve conflicts is used on an ended session of an agent with a resume command
- **THEN** the agent is started again in the same worktree and session record, and the prompt is submitted after start-up

#### Scenario: Nothing to resolve
- **WHEN** Resolve conflicts is requested for a session whose worktree reports no conflict
- **THEN** the request is refused with the reason and no process is started

#### Scenario: Not offered without git
- **WHEN** a session runs in place in a tracked folder that is not a git repository
- **THEN** no conflict is reported for it, no Resolve conflicts control is shown, and a request for it is refused

#### Scenario: A configured prompt and its additional instructions are used
- **WHEN** a profile has no resolve-conflicts prompt of its own but additional resolve-conflicts instructions `We rebase here, never merge.`, and Resolve conflicts is used on a conflicting session
- **THEN** the text handed to the agent is the agent-neutral default followed by one space and that sentence, and a configuration carrying either of them survives being saved and loaded

#### Scenario: The user is told how fresh it is
- **WHEN** a worktree's branch is reported as conflicting with `origin/main`
- **THEN** the dashboard names `origin/main`, says that this is as of the user's last fetch, and points at the pull action
