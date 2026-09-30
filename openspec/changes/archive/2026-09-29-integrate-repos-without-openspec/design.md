# Design

## Context

`walk` in `src/server/discover.ts` already visits every directory this feature cares about. It returns early when a
directory holds `openspec/config.yaml`, skips `node_modules`, `.git`, `.venv`, `target`, `dist` and anything at or
below an ignore path, never follows symlinks, and is bounded by `maxDepth`. What is missing is not a new walk but a
second thing to notice on the way.

Sessions come in two kinds today (`src/shared/types.ts`): `ChangeSession`, which belongs to a repository and a change
and runs in a worktree the dashboard created, and `ConsoleSession`, which belongs to neither and runs in the console
folder. `consoleFolder.ts` already proves a session can be a plain agent in a plain directory with no git at all.

The constraint that shapes everything else is invariant 1. Four in-flight changes already extend its enumerated list
of writes, each with a module of its own and a preview/confirm/re-check ritual. This change adds none: OpenSpec is
installed by the user's agent, which invariant 1 explicitly excludes ("what the agent changes is decided by its own
permission prompts"), so the dashboard's contract with a repository is untouched.

## Goals / Non-Goals

**Goals:**
- A repository under a scan root that has no OpenSpec is visible, and can be set up, without leaving the dashboard.
- Today's candidate list and today's config are unchanged for every user who never uses this.
- A repository becomes tracked because the marker is on disk, never because an agent said it finished.

**Non-Goals:**
- The dashboard running `openspec init`. See the proposal's non-goals.
- Integration for non-git folders, or anything outside the scan roots.
- Undo, or a record of who integrated what.

## Decisions

### D1. Integratable = own `.git`, no marker, no OpenSpec project below it

`walk` gains one branch and keeps its existing shape exactly:

```
if (await isOpenSpecRepo(dir)) { …unchanged: report, do not descend… }
if (await hasOwnGitDir(dir) && !(await isLinkedWorktree(dir))) integratable.add(dir);
…unchanged: descend…
```

Note that the walk **keeps descending** into an integratable repository. That is deliberate: stopping there would
change which OpenSpec projects today's discovery finds (a project nested inside a plain git repository), and this
change must not touch that list. Instead, after the walk, any integratable directory that is a prefix of a reported
OpenSpec project is dropped — it is a container, not a project waiting to be set up. A monorepo with one OpenSpec
package inside it therefore offers the package, not the monorepo.

`hasOwnGitDir` and `isLinkedWorktree` already exist in the module; a linked worktree is excluded for the same reason
it is excluded today — it would offer the same repository twice.

*Alternative:* offering every directory, or matching project markers like `package.json`. Rejected: a git repository
is what "repo" means to the user, it keeps the list short, and everything the dashboard does afterwards (pull,
worktrees, work status, cleanup) assumes git anyway.

### D2. `IntegrationSession` is a third session kind

```ts
export interface IntegrationSession extends SessionBase {
  integration: true;
  folder: string;     // canonical path of the repository being integrated
  repoId?: undefined; // it is not a tracked repository yet
  change?: undefined;
  action?: undefined;
  branch?: undefined;
  inPlace: true;
}
export type Session = ChangeSession | ConsoleSession | IntegrationSession;
```

Modelled on `ConsoleSession`, which is already a session with no repository, no change and no branch. `changeSessions()`
keeps filtering it out, so Open work, the activity log, work status, Ship, pull and worktree cleanup are unaffected
without any of them being changed — the same protection `ConsoleSession` gets today.

*Alternative:* a `ChangeSession` with a synthetic change name, or enabling the repository first and starting a normal
session in it. Both rejected: the second would put a repository the scanner cannot read into the config and onto the
board in a failed state, which is worse than not showing it.

### D3. The integration session runs in place, in the main checkout

This is the one place where an existing rule is widened, so it is stated precisely.

Today's rule: in a git repository a session MUST NOT run in the main checkout; only a tracked folder *without* git
runs in place. An integration session runs in place in a git repository.

The reason a worktree is wrong here is not convenience. `openspec init` writes `openspec/config.yaml` and the tool
files; in a worktree on a new branch, the main checkout keeps no marker, so discovery keeps reporting the repository
as integratable, and the user has a branch to merge before anything they did is visible. The action would not do what
it says.

What keeps it honest is what the existing in-place rule already does: the decision is made from the discovery result
(a git repository, not tracked, no marker), never by attempting a git command and reacting to a failure; the session
is recorded `inPlace` with no branch; and the panel states, in the same words the non-git in-place panel uses, that
the agent edits that folder directly, with no branch, no commit and no undo. The dashboard runs no git command for
the session and does not stage, commit or switch a branch — the agent does whatever the user approves.

### D4. The marker decides when integration succeeded

`integration.ts` re-checks the folder for `openspec/config.yaml` when the integration session ends, and every
discovery run re-checks it as a matter of course. On the first check that finds it:

1. the repository is added to the config with `enabled: true` and its default name, disambiguated by the existing
   `<basename> (<parent>)` rule;
2. the config is written with the existing atomic write;
3. a scan starts, so the board shows it.

Nothing is read from the agent's output — invariant: the only thing the dashboard may read from an agent's terminal
is the echo check in `submit.ts`. If the agent exits without the marker, the folder stays integratable and the
session's exit code and reason are shown where **Integrate** was activated, like any refused starter.

Adding a repository here does not contradict "a repository SHALL be added only when the user enables that individual
candidate": starting **Integrate** *is* that act, made once, for that one repository. The requirement is reworded to
say so rather than being quietly broken.

*Alternative:* watching the folder with a file watcher, or polling it. Rejected: the dashboard polls repositories it
tracks, and this one is not tracked; the two natural moments are enough and cost nothing.

### D5. The Integrate prompt carries no placeholder

Every other prompt template must contain `{change}`; `ship` already relaxes that to "optional". `integrate` goes
further and takes **no** placeholder, because the folder is the agent's working directory. The consequence is worth
stating: no text from the browser — not even a validated name — becomes part of the command line for an integration
session, which is a stronger guarantee than any existing starter can make.

The preconfigured Claude Code prompt is one line, so it can be typed into a terminal:

> Set this project up for OpenSpec: run `openspec init` in this folder, ask me which tools to install it for, and tell
> me what it created when you are done.

Validation rejects the `{change}` placeholder in it, and the existing permission-bypass check applies unchanged.

### D6. Presentation

Settings gains a third list under **Discovered candidates**, headed so that the difference is stated, not implied:
candidates *have* OpenSpec and are waiting to be tracked; integratable repositories do not have it yet. Each row shows
the path, the existing same-name hint, **Integrate** and **Ignore**.

**Integrate** is disabled with the reason when agent sessions are off, when the repository's agent has no Integrate
prompt, or while an integration session for that folder is running. The rows are shown in all three cases: knowing the
repository is there is useful before deciding to turn sessions on.

## Risks

- **The agent edits the user's main checkout.** Stated in the panel and on the action, and bounded by the agent's own
  permission prompts. It is the deliberate cost of D3 and the thing to look hardest at in review.
- **A large scan root now lists more rows.** Bounded by `maxDepth`, the ignore paths and the container rule of D1, and
  the Ignore action works on these rows as it does on candidates.
- **A half-finished init.** `openspec/config.yaml` exists but the tool files do not, so the repository is tracked and
  the `/opsx:*` starters fail. Mitigated only in that the failure is visible and re-running the agent fixes it; the
  dashboard deliberately does not inspect init's output to judge it (D4).
