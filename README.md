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

Building from source needs [Bun](https://bun.sh) ≥ 1.4. The compiled binary needs nothing else.

```sh
bun install
bun run build                  # → dist/openspec-dashboard
./dist/openspec-dashboard      # opens the browser; options: --port N, --no-open, --version
bun run dev                    # or run from source on http://127.0.0.1:4711
```

On first run, open **Settings**, add a workspace root such as `~/Workspace`, and enable the repositories you want to
track.

## Features

- **Projects**: one row per repository, showing open changes per stage, changes ready to archive, work in progress
  and when it was last updated, as a table or as tiles (`view=tiles`). Click a row or tile to open that repository's
  board. ([project-overview](openspec/specs/project-overview/spec.md))
- **Work in progress**: for the main checkout and every git worktree of a repository, whether it holds uncommitted
  changes or unpushed commits, or is stale, e.g. `2 worktrees · 1 uncommitted · 1 unpushed`. Sort by it or filter to
  it. Chips on tiles and on a repository's header show each checkout's branch with `●N` uncommitted items, `↑N`
  unpushed commits (ahead of the upstream, or never pushed), `↓N` behind, `stale`, `locked` or `?` (unknown), each with
  a tooltip. Ahead, behind and unpushed reflect your last `git fetch`: the dashboard never fetches. Only counts are
  recorded, never file names. ([change-scanner](openspec/specs/change-scanner/spec.md))
- **Boards**: one board per repository, plus one across all of them. Columns follow the lifecycle: New → one column
  per artifact → Ready → Implementing → Done → Synced → Archived. Changes in git worktrees are included, so work shows
  up before it is merged. ([kanban-board](openspec/specs/kanban-board/spec.md),
  [change-scanner](openspec/specs/change-scanner/spec.md))
- **Change details**: **Show details** on a card opens the change's proposal, design, specs and tasks in an overlay
  over the board; close it with `Escape` to get back to the board as you left it. Apply and start commands are run
  by hand or through an agent session. ([change-detail](openspec/specs/change-detail/spec.md))
- **Activity**: a feed of changes created, moved, archived and tasks ticked, including what happened while the
  dashboard was not running. ([activity-feed](openspec/specs/activity-feed/spec.md))
- **New change**: create and stage `openspec/changes/<name>/` from a repository's board, or from the combined
  board with a project dropdown, optionally with a prompt.
  Nothing is committed.
  ([change-creation](openspec/specs/change-creation/spec.md))
- **Pull**: fetch and fast-forward a repository's main checkout. Never merges, rebases, stashes or switches branches.
  ([repository-pull](openspec/specs/repository-pull/spec.md))
- **Shared config**: keep `context` and `rules` for `openspec/config.yaml` as profiles and apply them to selected
  repositories, with a diff preview first. ([shared-config](openspec/specs/shared-config/spec.md))
- **Agent sessions** (off by default): start your agent CLI, such as Claude Code, for a change in its own git worktree.
  Its terminal is the **Console** tab of that change's detail view, next to the change's artifacts, so one change is
  one place. **Open work** in the top bar lists every running agent and every worktree that still holds something
  (uncommitted, unpushed, pushed, merged) across all repositories.
  A tracked folder that is not a git repository works too — there the agent runs in the folder itself, so it edits your
  files directly, with no branch and no undo, and the session says so.
  ([agent-sessions](openspec/specs/agent-sessions/spec.md))
- Light and dark themes.

## What it touches

- It listens only on `127.0.0.1`. Mutating API calls must come from the same origin, so a script calling them has to
  send `Content-Type: application/json`.
- It reads repositories with read-only git commands. Scanning, polling and discovery never write anything or contact
  a remote.
- It writes to a repository only when you click something: **Pull** (the only network access, using git's own
  credentials), **New change**, **applying shared config**, and creating or removing an **agent session's worktree**.
  The full list is in the [dashboard-api spec](openspec/specs/dashboard-api/spec.md).
- Its own state lives in `~/.openspec-dashboard/`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Run `bun run check` (lint, typecheck, tests) before you push. Agents should
start with [CLAUDE.md](CLAUDE.md). Requirements live in [`openspec/specs/`](openspec/specs/).

## License

[MIT](LICENSE) © 2026 Jan Wendling
