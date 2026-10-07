## MODIFIED Requirements

### Requirement: Every session works in its own git worktree, created by the dashboard
In a git repository a session MUST NOT run in the repository's main checkout, except for the in-place cases below. Before starting the agent, the dashboard SHALL ensure a git worktree for the session under `~/.spec-control/worktrees/<repository id>/`, outside the repository's working tree, on branch `feat/<change>` — or, for **Archive**, in a worktree and branch of its own (`archive-<change>`, `chore/archive-<change>`). An existing worktree for that name SHALL be reused; an existing branch SHALL be checked out; otherwise the branch SHALL be created from the repository's default branch as currently known locally (`origin/HEAD`, else `HEAD`). A git repository whose scan reports that it has **no commit to branch from** — `HEAD` names no commit and there is no `origin/HEAD`, as **New project** leaves it — has no default branch to create a session's branch from; its change sessions SHALL run in place, as the paragraph on repositories with no commit below specifies, and MUST NOT be refused for lacking a commit. Should the scan be out of date and the branch still have to be created from a `HEAD` that names no commit, starting the session SHALL be refused before any worktree or branch is created and before any agent is started, with a reason that says the repository has no commit yet, rather than git's own error; that check SHALL be read-only. As the one exception, when a Draft or Implement session's branch `feat/<change>` is already checked out in another linked worktree of the repository, the session SHALL adopt that worktree — run the agent there instead of creating one — and SHALL record and show that the worktree was adopted. The dashboard MUST NOT contact a remote for this. If the change's directory is missing from the session's worktree, the dashboard SHALL copy it from the checkout the change's data comes from (the main checkout or a linked worktree), including when it exists there only uncommitted. The main checkout's branch, index and working tree MUST NOT be changed. The session record and panel SHALL show the worktree path and branch.

A tracked folder that holds an `openspec/` tree but is **not a git repository** is a supported repository, and its sessions SHALL run **in place**: the agent's working directory SHALL be the repository folder itself, no worktree SHALL be created, no branch SHALL be made, and no git command SHALL be run for the session. Whether a session runs in place SHALL be decided from the repository's own scan result, never by attempting a git command and reacting to its failure. An in-place session SHALL be recorded as such and MUST NOT carry a branch. The panel SHALL name the folder the agent runs in and SHALL state plainly that the agent edits the tracked folder directly, with no branch, no commit and no undo. Session starters MUST NOT be hidden or disabled because a repository is not a git repository.

An **integration session** — the session started by **Integrate** for a repository that is not tracked and has no `openspec/` tree — is the second in-place case and the first one in a git repository. It SHALL run in place under exactly the rules of the paragraph above: the repository folder is the working directory, no worktree, no branch, no git command for the session, recorded as in place, with the same panel wording. The reason it does not get a worktree is that its whole purpose is to leave `openspec/config.yaml` in the checkout the user works in; on a branch in a worktree the marker would never appear where discovery looks. Whether a session runs in place SHALL still be decided from what the dashboard already knows about the folder, never by attempting a git command and reacting to its failure.

A **project console** — the one session per tracked project for general project tasks, specified in the `project-console` capability — is the third in-place case and the second one in a git repository's main checkout. It SHALL run in place under the same rules: the tracked folder is the working directory, no worktree, no branch, no git command for the session, recorded as in place, with the same panel wording. It runs there because it belongs to no change and so to no branch, and because work on the project as the user sees it — including a project with no commit yet, where no worktree can be made — happens in that checkout. Apart from the case in the next paragraph, these two kinds are the only sessions that MAY run in a git repository's main checkout.

A **change session in a git repository with no commit yet** is the fourth in-place case and the only one in which a change session runs in a git repository's main checkout. When the repository's scan reports that it has no commit to branch from, a change session of any action SHALL run in place under the same rules as in a folder without git: the main checkout is the working directory, no worktree SHALL be created, no branch made and no git command run for the session, the session SHALL be recorded as in place and MUST NOT carry a branch. Whether it runs in place SHALL be decided from the scan result, never by attempting a git command and reacting to its failure. A session started in place SHALL stay in place for its whole life, including when it is resumed or started again after the repository got its first commit; a session started once the scan reports a commit SHALL get its own worktree and branch as usual. The panel SHALL name the folder and SHALL state that the agent works in the repository's checkout because there is no commit to branch from yet, with no branch of its own and no undo; it MUST NOT claim that the folder is not a git repository. Such a session has no work status, no Ship, no worktree to remove and no pull offer, exactly as an in-place session in a folder without git. At most one agent SHALL run in that checkout at a time: a change session SHALL be refused while another in-place session — a change session or the project console — runs there, with a reason naming the change or saying that the project console is running in that folder. In every git repository that has a commit to branch from, a change session never runs in the main checkout.

#### Scenario: Two sessions in one repository
- **WHEN** sessions are open for changes `audit-trail` and `upgrade-runtime` of the same repository
- **THEN** they run in two different worktrees on two different branches and the main checkout's branch and `git status` are unchanged

#### Scenario: Uncommitted change directory
- **WHEN** a session is opened for a change whose directory exists only uncommitted in the main checkout
- **THEN** the worktree contains a copy of that directory before the agent starts

#### Scenario: Change lives only in another worktree on another branch
- **WHEN** a session is opened for change `audit-trail`, which exists only in a worktree on branch `wip/compliance`
- **THEN** a session worktree on `feat/audit-trail` is created and contains a copy of the change directory from that worktree before the agent starts

#### Scenario: The change's branch is already checked out
- **WHEN** an Implement session is opened for change `audit-trail` and branch `feat/audit-trail` is checked out in a linked worktree that the user created
- **THEN** the agent runs in that worktree, no new worktree is created, and the panel shows the worktree as adopted

#### Scenario: Archiving does not reuse the implementation worktree
- **WHEN** a change was implemented in a session whose worktree still exists, and the user later starts **Archive** for it
- **THEN** the archive session runs in a separate worktree on a `chore/archive-<change>` branch

#### Scenario: Worktree cannot be created
- **WHEN** git refuses to create the worktree in a git repository
- **THEN** the request fails with git's reason and no agent is started

#### Scenario: Repository without a commit
- **WHEN** the user starts **Draft artifacts** for change `first-feature` in the tracked git repository `/w/acme/fresh-app`, which was initialised but has no commit, and has no `origin/HEAD`
- **THEN** the agent starts with `/w/acme/fresh-app` as its working directory, the session is recorded as in place without a branch, no worktree or branch is created, and the dashboard runs no git command for the session

#### Scenario: The panel of a session in a repository without a commit
- **WHEN** the panel of the in-place `first-feature` session in `/w/acme/fresh-app` is open
- **THEN** it names `/w/acme/fresh-app`, shows no branch, says the agent works in the checkout because there is no commit to branch from yet and that there is no undo, and does not say the folder is not a git repository

#### Scenario: A second agent in a repository without a commit
- **WHEN** the in-place `first-feature` session runs in `/w/acme/fresh-app` and the user starts Implement for change `second-feature` of the same repository
- **THEN** the request is refused with a reason naming `first-feature`, and no second agent is started

#### Scenario: After the first commit
- **WHEN** the agent of the in-place `first-feature` session has made the first commit in `/w/acme/fresh-app`, a scan has run, and the user starts **Draft artifacts** for change `second-feature`
- **THEN** the `second-feature` session runs in its own worktree on branch `feat/second-feature`, and a resumed `first-feature` session still runs in place

#### Scenario: Out-of-date scan
- **WHEN** a session's branch would be created from a `HEAD` that names no commit although the last scan reported a commit
- **THEN** the request is refused with a reason saying the repository has no commit yet, no worktree, branch or file is created, and no agent is started

#### Scenario: Archiving a change in a folder that is not a git repository
- **WHEN** the user starts **Archive** for a completed change in a tracked folder that has an `openspec/` tree but no `.git`
- **THEN** the agent starts with the tracked folder as its working directory, no worktree and no branch are created, and no git command is run for the session

#### Scenario: The panel names the folder for an in-place session
- **WHEN** the panel of an in-place session is open
- **THEN** it names the repository folder the agent runs in, shows no branch, and states that the agent edits that folder directly with no branch, no commit and no undo

#### Scenario: An integration session runs in the checkout
- **WHEN** the user activates **Integrate** for a git repository that has no `openspec/config.yaml`
- **THEN** the agent starts with that repository folder as its working directory, no worktree and no branch are created, and the dashboard runs no git command for the session

#### Scenario: The integration panel states the risk
- **WHEN** the panel of an integration session is open
- **THEN** it names the repository folder, shows no branch, and states that the agent edits that folder directly with no branch, no commit and no undo

#### Scenario: A project console runs in the checkout
- **WHEN** the user opens the project console of the tracked git repository `/w/acme/demo-ops`
- **THEN** the agent starts with `/w/acme/demo-ops` as its working directory, no worktree and no branch are created, and the dashboard runs no git command for the session

#### Scenario: Change sessions still never run in the main checkout
- **WHEN** a project console runs in `/w/acme/demo-ops`, which has commits, and the user starts Implement for a change of `demo-ops`
- **THEN** the Implement session runs in its own worktree on its own branch, not in the main checkout

### Requirement: Session records live outside repositories
Session metadata SHALL be stored only under `~/.spec-control/sessions/<session-id>/`, written atomically and readable by the user only; when a session ends, the bounded tail of its terminal output SHALL be stored there too, so that an ended session still shows what happened. The dashboard SHALL keep the newest 50 ended sessions, and a session's record SHALL be deletable from the UI once it has ended.

#### Scenario: Looking at an ended session
- **WHEN** the user opens the panel of a session that ended before the dashboard was restarted
- **THEN** the stored terminal output is shown and no input is accepted

### Requirement: Every session worktree has a work status
For every directory under `~/.spec-control/worktrees/<repoId>/` of a configured repository the dashboard SHALL derive a work status from local git, using read-only commands and without contacting a remote. The base is the repository's default branch as locally known (`origin/HEAD`), or the main checkout's `HEAD` when there is none. The status SHALL be the first that applies: `missing` when the directory is not a git worktree; `uncommitted` with the number of changed or untracked files; `merged` when the branch has no commit that the base lacks and a remote-tracking branch of the same name exists, or when every file the branch changed has the same content in the base (which also recognises squash and rebase merges); `clean` when the branch has no commit that the base lacks; `unpushed` with the number of commits ahead of its upstream, or all commits the base lacks when it has no upstream; otherwise `pushed`. Statuses MAY be cached for up to 15 seconds and MUST be recomputed after a session ends, a Ship action or a worktree removal. Because nothing is fetched, `merged` reflects the user's last fetch; the UI MUST say so.

For a status of `uncommitted`, `unpushed` or `pushed` the dashboard SHALL additionally determine whether merging the worktree's branch into that same base would conflict, and report the conflicting paths with it, capped at a bounded number. The check SHALL be made by merging the two commits in memory only: it MUST NOT change the worktree's or the main checkout's working tree, index, `HEAD` or any ref, MUST NOT contact a remote, and any objects git writes for it MUST be directed into a scratch object store under `~/.spec-control/`, so that nothing is created inside the tracked repository. When the check cannot be made — there is no base, git is too old for it, or it fails for any other reason — the work status SHALL simply carry no conflict information, and the dashboard MUST NOT treat that as an error or fall back to a check that writes. Because nothing is fetched, a conflict is a statement about the base as of the user's last fetch, and the UI MUST say so and MUST point at the pull action as the way to refresh the base.

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
