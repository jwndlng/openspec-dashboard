# openspec-dashboard

A local Kanban board for every [OpenSpec](https://github.com/Fission-AI/OpenSpec) repository on your machine.
It reads your repositories and shows where each change stands. It ships as a single binary and runs on `127.0.0.1` only.

**[Live demo →](https://blog.wndlng.ch/openspec-dashboard/)** — the real UI on sample data, nothing to install.

<a href="https://blog.wndlng.ch/openspec-dashboard/#/board">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://blog.wndlng.ch/openspec-dashboard/screenshots/board-dark.png">
    <img alt="The combined Kanban board: one column per lifecycle step from New to Archived, cards grouped and coloured by repository, with task progress, last activity, branch badges and warnings." src="https://blog.wndlng.ch/openspec-dashboard/screenshots/board-light.png">
  </picture>
</a>

## Run

Download a binary for macOS (arm64, x64) or Linux (x64, arm64) from the
[releases page](https://github.com/jwndlng/openspec-dashboard/releases). It needs nothing else. Check it with
`shasum -a 256 -c --ignore-missing SHA256SUMS` and `gh attestation verify <file> --repo jwndlng/openspec-dashboard`,
then `chmod +x` it. The macOS binaries are not notarised: if macOS refuses to open one, run
`xattr -d com.apple.quarantine <file>`.
What's new in your version is in the dashboard itself: the **What's new** button in the top corner, offline.

Building from source needs [Bun](https://bun.sh) ≥ 1.4. The compiled binary needs nothing else.

```sh
bun install
bun run build                  # → dist/openspec-dashboard
./dist/openspec-dashboard      # opens the browser; options: --port N, --no-open, --version
bun run dev                    # or run from source on http://127.0.0.1:4711
```

On first run, open **Settings** and add a workspace root such as `~/Workspace`. Then go back to **Projects**: the
repositories found under it are listed below your tracked ones, and **Enable** starts tracking one right away.
A short tour points out the main controls on your first visit, and the **Help** tab explains each part of the
dashboard; both are built in and work offline.

## Features

- **Projects**: one row per repository, showing open changes per stage, changes ready to archive, work in progress
  and when it was last updated, as a table or as tiles (`view=tiles`). Click a row or tile to open that repository's
  board. Below these **Managed projects**, **Unmanaged projects** lists in one list what you could bring in —
  disabled repositories, OpenSpec repositories found under your workspace roots, and git repositories without
  OpenSpec, each labelled — with the actions that fit it (**Enable**, **Ignore**, **Integrate**, **Forget** for a
  disabled one), each saved at once; **Disable** on a row or tile moves a repository down there. Each managed project
  also carries its own settings on its row or tile, saved at once: **Rename** (the pencil beside its name), **Labels**,
  and an **Agent sessions** switch — Enabled unless you turn it off — with an agent picker when you configured more
  than one agent.
  ([project-overview](openspec/specs/project-overview/spec.md))
- **Work in progress**: for the main checkout and every git worktree of a repository, whether it holds uncommitted
  changes or unpushed commits, or is stale, e.g. `2 worktrees · 1 uncommitted · 1 unpushed`. Sort by it or filter to
  it. Chips on tiles and on a repository's header show each checkout's branch with `●N` uncommitted items, `↑N`
  unpushed commits (ahead of the upstream, or never pushed), `↓N` behind, `stale`, `locked` or `?` (unknown), each with
  a tooltip. Ahead, behind and unpushed reflect your last `git fetch`: the dashboard never fetches. Only counts are
  recorded, never file names. ([change-scanner](openspec/specs/change-scanner/spec.md))
- **Labels**: give a repository your own labels (`client`, `platform`, …) with **Labels** on its row or tile, and
  the scan adds technology labels from marker files in the project folder and its immediate subfolders: `terraform`
  (`.tf` files), `go` (`go.mod`), `rust` (`Cargo.toml`), `javascript` (`package.json`), `typescript`
  (`tsconfig.json`), `python` (`pyproject.toml`, `requirements.txt`, `setup.py`, `Pipfile`), `ruby` (`Gemfile`),
  `java` (`pom.xml`, `build.gradle`, `build.gradle.kts`), `dotnet` (`.csproj`, `.sln`), `php` (`composer.json`),
  `swift` (`Package.swift`), `docker` (`Dockerfile`, `compose.yaml`, `docker-compose.yml`), `helm` (`Chart.yaml`) and
  `ansible` (`ansible.cfg`). Detection only lists file names — it opens no file and runs no git. Hide a wrong guess per
  repository in the same dialog. Labels show on rows, tiles and a repository's header; activate one to filter Projects by it
  (`?label=terraform&label=client` lists repositories carrying both). Your labels live in
  `~/.openspec-dashboard/config.json`, never in the repository. ([project-labels](openspec/specs/project-labels/spec.md))
- **Boards**: one board per repository, plus one across all of them. Columns follow the lifecycle: Backlog → Drafts
  (with a bar of written artifacts) → Ready → Implementing → Done → Archived. Changes in git worktrees are included, so work shows
  up before it is merged. ([kanban-board](openspec/specs/kanban-board/spec.md),
  [change-scanner](openspec/specs/change-scanner/spec.md))
- **Awaiting validation**: a task written `- [~]` in `tasks.md` means the agent finished it but a person still has to
  confirm it — "check it in the browser", "try the packaged build". It counts towards the change being finished but
  never towards `done`, so a change whose tasks are all `- [x]` or `- [~]` sits in **Done** with a **Validate** badge
  and a bar like `13 + 2 awaiting / 15 Tasks`, and offers **Validate** instead of **Implement**. **Archive** is
  offered for the whole `Done` column, so you can archive straight away; `openspec archive` will ask about the
  leftovers, and that question is the validation. The dashboard only reads the marker: it never writes, ticks or
  clears a checkbox in any repository — your agent does that, in its own session.
  ([change-scanner](openspec/specs/change-scanner/spec.md), [kanban-board](openspec/specs/kanban-board/spec.md))
- **Change details**: **Show details** on a card opens the change's proposal, design, specs and tasks in an overlay
  over the board; close it with `Escape` to get back to the board as you left it. Apply and start commands are run
  by hand or through an agent session. ([change-detail](openspec/specs/change-detail/spec.md))
- **Activity**: a feed of changes created, moved, archived and tasks ticked, including what happened while the
  dashboard was not running. ([activity-feed](openspec/specs/activity-feed/spec.md))
- **Pull requests**: every open pull request of your tracked GitHub repositories, plus those merged or closed in the
  last 7 days, with state, review decision, checks and a "review requested from you" marker; filter by repository,
  state or what awaits your review. Each repository's open count also shows on Projects, and its board header opens
  that repository's list. A card whose change's branch is exactly a pull request's head branch shows `PR #<number>`
  with its state, linking to it on GitHub, and the change's detail header shows its title, state, review decision and
  checks; a change on an off-convention branch simply shows none. It reads them with your own
  [GitHub CLI](https://cli.github.com) (`gh pr list`, `gh api user` — nothing else, and nothing is ever changed on
  GitHub), and only when you open the view, a repository's dialog or a board with a list older than five minutes, or
  activate **Refresh** — never on a timer, during a scan or from Projects. Without `gh`, without being signed in, or for a
  repository that is not on `github.com`, it simply says so. ([pull-requests](openspec/specs/pull-requests/spec.md))
- **New change**: create and stage `openspec/changes/<name>/` from a repository's board, or from the combined
  board with a project dropdown, optionally with a prompt.
  Nothing is committed.
  ([change-creation](openspec/specs/change-creation/spec.md))
- **Dismiss change**: drop a change you are not going ahead with from its detail view. The confirmation lists every file
  and says which ones git can restore and which are lost for good; confirming deletes `openspec/changes/<name>/` from
  the main checkout and stages that removal. Nothing is committed, and worktrees and branches are left alone.
  ([change-dismissal](openspec/specs/change-dismissal/spec.md))
- **Pull**: fetch and fast-forward a repository's main checkout. Never merges, rebases, stashes or switches branches.
  ([repository-pull](openspec/specs/repository-pull/spec.md))
- **Clean up**: remove a repository's leftover worktrees and delete local branches whose work is merged, including
  squash merges. Only what provably holds no work of its own is offered, and nothing goes before you confirm.
  Remote branches are never touched. ([repository-cleanup](openspec/specs/repository-cleanup/spec.md))
- **Shared config**: keep `context` and `rules` for `openspec/config.yaml` as profiles and apply them to selected
  repositories, with a diff preview first. ([shared-config](openspec/specs/shared-config/spec.md))
- **Agent sessions** (off by default): start your agent CLI, such as Claude Code, for a change in its own git worktree.
  Its terminal is the **Console** tab of that change's detail view, next to the change's artifacts, so one change is
  one place, and every card carries a link to it in the same top-right corner. While an agent works, the card's start
  button becomes its status — activate it to open the terminal, where the next step and **End session** are.
  **Open work** in the top bar lists every running agent and every worktree that still holds something
  (uncommitted, unpushed, pushed, merged) across all repositories.
  A branch that no longer merges into the default branch says so, with the files that clash — worked out locally, so it
  is as fresh as your last fetch — and **Resolve conflicts** hands your agent the job. The dashboard merges, rebases
  and pushes nothing itself; it only asks, exactly as **Ship** does.
  A tracked folder that is not a git repository works too — there the agent runs in the folder itself, so it edits your
  files directly, with no branch and no undo, and the session says so. The same goes for an **Integrate** session and
  a project's console.
  Claude Code is configured by default; **Codex** and **Antigravity** are presets one click away in Settings, each
  marked with whether its executable was found on this machine — nothing is added just because an agent is installed.
  Each preset's prompts expect the OpenSpec commands or skills that `openspec init --tools <tool>` installs for that
  agent (`/opsx:*` for Claude Code, `/opsx-*` for Antigravity, the `openspec-*` skills for Codex). Any other agent CLI
  that runs in a terminal can be added with its own command line and prompts.
  ([agent-sessions](openspec/specs/agent-sessions/spec.md))
- **Integrate a repository**: Projects lists the git repositories under your workspace roots that do not use OpenSpec
  yet, next to the discovered ones that already do. **Integrate** starts your agent in that repository to run
  `openspec init` there and answer its questions. The dashboard writes nothing itself, and starts tracking the
  repository only once `openspec/config.yaml` is actually on disk — never on the agent's word. That one session runs
  in the checkout itself, with no branch and no undo, because that is where the marker has to land.
  ([repo-integration](openspec/specs/repo-integration/spec.md))
- **New project**: from the projects overview, pick one of your workspace roots and type a folder name. The dashboard
  creates that one empty folder, runs `git init` in it — no commit, no remote — and starts your agent there exactly as
  **Integrate** does, to run `openspec init`; the project is tracked once `openspec/config.yaml` exists, and you carry
  on in the same terminal — the project's console button reopens it after you closed it.
  ([project-creation](openspec/specs/project-creation/spec.md))
- **Console**: the terminal button next to the theme control opens your default agent outside every change, with no
  prompt — for drafting a new change, looking across repositories or any chore. It runs in a console folder
  (`~/.openspec-dashboard/console/` unless you pick another one in Settings, never inside a tracked repository), one at
  a time, and keeps running when you close it. ([main-console](openspec/specs/main-console/spec.md))
- **Project console**: each managed project has its own console button — on its overview row and tile and on its
  board — that opens the project's agent with no prompt, for anything about the project that is not a change. It runs
  in the project's own folder (the main checkout), with no branch and no undo, and the console says so; one per
  project, kept running when you close it. The session that set a new project up is its console until you start
  another. ([project-console](openspec/specs/project-console/spec.md))
- Light and dark themes.

## What it touches

- It listens only on `127.0.0.1`. Mutating API calls must come from the same origin, so a script calling them has to
  send `Content-Type: application/json`.
- It reads repositories with read-only git commands. Scanning, polling and discovery never write anything or contact
  a remote.
- It reaches the network in two places, both on something you do: **Pull**, using git's own credentials, and the
  **Pull requests** query, using your `gh` sign-in — when you click Refresh, or open a view that shows pull requests
  (including a board) with a list older than five minutes. Neither ever sees, stores or asks for a credential, and the
  pull-request query runs `gh` outside every repository, writes nothing and changes nothing on GitHub.
- It writes to a repository only when you click something: **Pull** (using git's own credentials) and, when you confirm **Resolve and pull**, removing the change files it created here that the incoming
  commits already contain — a copy of anything that differs is kept under `~/.openspec-dashboard/` first; **New
  change**, **Dismiss change** (deleting that change's directory), **applying shared config**, creating or removing an
  **agent session's worktree**, and **Clean up** (removing worktrees and deleting merged local branches you selected).
  The full list is in the [dashboard-api spec](openspec/specs/dashboard-api/spec.md).
- Outside repositories, it creates a folder only for **New project**: one empty folder directly inside a workspace root
  you picked, never inside a tracked repository, with `git init` run in it.
- Its own state lives in `~/.openspec-dashboard/`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Run `bun run check` (lint, typecheck, tests) before you push. Agents should
start with [CLAUDE.md](CLAUDE.md). Requirements live in [`openspec/specs/`](openspec/specs/).

## License

[MIT](LICENSE) © 2026 Jan Wendling
