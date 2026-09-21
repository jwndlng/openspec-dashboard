# openspec-dashboard

Local-first Kanban across every [OpenSpec](https://github.com/Fission-AI/OpenSpec) repository on this machine.
Ships as a single Bun binary. Repositories stay the source of truth; the dashboard indexes them and is read-only
towards them, with two explicit exceptions: applying [shared config profiles](#shared-openspec-config) (previewed), and the
optional, off-by-default [agent sessions](#agent-sessions-optional-off-by-default).

**[Live demo →](https://blog.wndlng.ch/openspec-dashboard/)** — the real UI on made-up sample data, nothing to install.

<a href="https://blog.wndlng.ch/openspec-dashboard/#/board">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://blog.wndlng.ch/openspec-dashboard/screenshots/board-dark.png">
    <img alt="The combined Kanban board: one column per lifecycle step from New to Archived, cards grouped and coloured by repository, with task progress, last activity, branch badges and warnings." src="https://blog.wndlng.ch/openspec-dashboard/screenshots/board-light.png">
  </picture>
</a>

## Run

Requires [Bun](https://bun.sh) ≥ 1.4 to build; the compiled binary needs nothing else.

```sh
bun install
bun run dev                     # builds the UI, serves http://127.0.0.1:4711 from source
bun run build                   # dist/openspec-dashboard (single binary, UI + fonts embedded)
./dist/openspec-dashboard       # opens the browser; --port N and --no-open are available
bun test                        # unit + API tests against the fixture repos in test/fixtures
bun run check                   # lint + typecheck + tests — what CI runs
bun run build:demo              # dist/demo/index.html — the demo: same UI, in-memory API, sample data (open it from disk)
bun run screenshots             # dist/demo/screenshots/*.png from the demo build (needs Chrome; CHROME_BIN overrides)
```

First run: open **Settings** and add a workspace root such as `~/Workspace`. Discovery runs immediately and lists
what it found under **Discovered**; click **Enable** on the repos to track, then save.

## What it does

- **Settings** — one page with a section navigation on the left (jump to a section, see which one is in view,
  link to one with `?section=discovered`; it shows how many discovered repositories are waiting). Workspace roots, discovery of repos containing `openspec/config.yaml` (4 levels deep; skips
  `node_modules`, nested copies and linked git worktrees), opt-in tracking per repo, display names, poll interval.
  Discovery is a read-only preview: it re-runs whenever the roots change (even unsaved), when Settings opens and on
  **Rediscover**, and never writes to the config. Only repos you enable are stored; forgetting (×) a tracked repo
  returns it to the discovered list. Configs from earlier versions may still hold disabled entries for every repo
  that was discovered back then — they stay under **Tracked** and can be forgotten individually.
- **Projects** (`/`, the landing page) — one row per tracked repository: open changes per stage, open total, how many
  are complete but not archived, scan errors, and when the repository was last updated. Sorted newest-updated first;
  click a column header to sort by name, open or to-archive (again to reverse), search by name — kept in the URL.
  Click a repository to drill down to **its own board** (`/repo/<id>`): the same Kanban scoped to that repository, with
  columns from its own schema and a header showing path (with "Copy cd"), branch, worktrees and warnings.
  Only enabled repositories are listed — disabling one in Settings removes it immediately, without waiting for the next
  scan. Repositories that share a display name stay separate rows and show the part of their parent path that tells
  them apart (`chat-groups acme/` vs `chat-groups repos/`).
- **Last updated** means *any file under the repository's `openspec/` folder changed*: the latest commit touching it, or
  the mtime of a file there that git reports as modified or untracked — so uncommitted work counts, while a fresh clone
  or checkout (which rewrites the mtimes of unchanged files) does not. Cards use the same rule per change.
- **All changes** (`/board`) — one Kanban across all tracked repos. A column names the **last step that is complete**:
  **New** (created, nothing written) → one column per schema artifact once it is written (**Proposal → Design → Specs**
  for `spec-driven`; other schemas keep their own order) → **Ready** (every artifact written, no task ticked — so the
  last artifact, `tasks`, has no column of its own) → **Implementing** (at least one task ticked) → **Done** (all tasks
  complete, delta specs not yet in `openspec/specs/`) → **Synced** (specs synced, only archiving left) → **Archived**
  (a regular column showing the 25 most recent; take it off the board with "hide archived"). An artifact written out of order does not count until the ones before it exist.
  **Synced** is derived, not recorded: the dashboard parses the change's delta specs and checks the main specs for the
  added, modified, removed and renamed requirements. A finished change without delta specs has nothing to sync and goes
  straight to Synced; `openspec archive` syncs and archives in one go, so cards often skip it. Done and Synced both count
  as "to archive".
  Cards show repo, change, task progress, last activity, a matching branch/worktree (long branch names are
  shortened in the middle so they stay inside the card; hover for the full name), and a
  "Copy apply command" action (`cd <repo> && claude "/opsx:apply <change>"`).
  Within each column, cards are **grouped by repository** (same order in every column), and every repository gets its
  own automatic, stable colour — on the group header, its cards and its filter chip — in both themes.
  Click a group header to minimize the group to its name and count; groups in **Archived** start minimized. Choices are
  remembered in the browser, and a text search always opens the groups that contain matches.
- Filters: repo, text, stale-for-N-days, hide archived — kept in the URL. Bookmarks of the old combined board move from
  `/?repos=…` to `/board?repos=…`.
- Theme: dark and light. Follows the OS appearance by default; the **Theme** button in the top bar cycles
  System → Light → Dark. The choice is stored in the browser (`localStorage`), not in the config file.

State lives in `~/.openspec-dashboard/` (`config.json`, `shared-config.json`, `cache/snapshot.json`, `sessions/`, `worktrees/`). The dashboard
only runs read-only `git` commands (`rev-parse`, `log`, `worktree list`, `status` — with optional locks disabled, so
not even `.git/index` is refreshed), and scanning, polling, discovery and saving settings never write to a tracked
repository. The things that do are described next: shared config, and the opt-in agent sessions further down.

## Shared OpenSpec config

Every OpenSpec project can give agents extra guidance in `openspec/config.yaml`: a `context` text injected into every
artifact instruction, and per-artifact `rules`. **Settings → Shared OpenSpec config** lets you keep that guidance once,
as named **profiles** (say `base` for conventions every project shares, `security`, `frontend`), and merge it into the
repositories you choose. A repository can carry several profiles; different repositories can carry different ones.

- **What is written.** Only `openspec/config.yaml`, and only *managed sections*: one marked block per profile at the
  start of `context`, and rule entries with a marker comment. `schema`, every other key, all comments, and the
  project's own context and rules are left exactly as they are.
  ```yaml
  context: |
    <!-- openspec-dashboard:shared:begin base — managed by openspec-dashboard, edits here are overwritten -->
    We use conventional commits.
    <!-- openspec-dashboard:shared:end base -->

    Tech stack: Go.                       # the project's own — never touched
  rules:
    proposal:
      - Always include Non-goals # openspec-dashboard:shared:base
      - Mention the on-call impact        # the project's own — never touched
  ```
- **When.** Only when you tick profiles in the repositories × profiles grid, open the preview (an exact diff per
  repository) and confirm. Saving profiles writes nothing to any repository. No git command is run: each repository
  ends up with an ordinary uncommitted change to review and commit — or discard with `git checkout`.
- **State comes from the files.** Which profiles a repository carries is read from the markers, not remembered by the
  dashboard: `in sync`, `outdated` (the profile changed since, or someone edited inside the block) or `orphaned` (the
  profile was deleted here). Projects and the repository header show it. Unticking a profile and applying removes its
  sections; unticking everything restores the file byte for byte (one exception: a project's own one-line quoted
  `context` comes back as a `|` block with the same value).
- **Refused, never half-done.** A `config.yaml` that is missing, not valid YAML or has damaged markers is left alone,
  as is a repository that is not enabled. Apply also refuses when shared plus own context would pass 50KB, because
  OpenSpec silently ignores the whole context above that size. Writes are atomic.
- **Scripted API calls.** Because the dashboard can now modify files in your repositories, every non-GET API request
  must be same-origin: `Content-Type: application/json`, a loopback host, and no foreign `Origin`. `curl` needs
  `-H 'content-type: application/json'`; a web page in your browser cannot call these routes.

## Agent sessions (optional, off by default)

Start an agent for a change straight from its card — **Draft artifacts** while artifacts are missing, **Implement** once
a change is ready, **Archive** once every task is done — and it opens **in a terminal inside the dashboard**. It is the
same program you would run in your own terminal, with its own login, settings, slash commands and permission prompts;
the dashboard shows it, passes your keystrokes on, and interprets nothing.

- **One switch, off by default**: Settings → *Agent sessions*. Once on it applies to every tracked repository; switch
  individual repositories off in the same section. While it is off, no card shows a starter and the API refuses.
- **Bring your own agent**: an agent is a *profile* — a command as an argument list (`{prompt}` is where the opening
  prompt goes), a prompt per starter (`{change}` is the change name), and optionally a resume command. **Claude Code**
  is preconfigured (`claude {prompt}`, the `/opsx:*` commands, `claude --continue`; API-key variables are removed from
  its environment so its own login — for example a subscription — is used). Add any other CLI that runs interactively
  in a terminal, pick a default, and choose a different agent per repository if you like. The dashboard never handles
  credentials.
- **One agent, one worktree**: before starting the agent the dashboard creates a git worktree for the session on
  `feat/<change>` (archiving: `chore/archive-<change>`) under `~/.openspec-dashboard/worktrees/` — outside the
  repository, so your main checkout's branch, index and files are never touched and no untracked directory appears in
  it. The branch starts from your local `origin/HEAD` (the dashboard does not fetch). A change that exists only
  uncommitted in your main checkout is copied into the worktree. Ending a session offers to remove the worktree only
  when it is clean and holds no commit that exists nowhere else.
- **It keeps running**: hide the panel and the agent carries on; open it again (or a second tab, or reload) and the
  terminal shows what happened meanwhile. Cards show `running`, `quiet 12m` (the terminal has been silent — the agent is
  probably waiting for you) or how the session ended. **Resume** starts the agent's resume command in the same worktree.
  Stopping the dashboard ends its agents; their output stays viewable.
- **Nothing is left behind**: every session worktree gets a work status, also after its session ended or its record
  was deleted — `3 uncommitted`, `2 not pushed`, `pushed` or `merged` — shown on the card and in **Open work** in the
  top bar, which lists all of them across repositories and highlights work nobody touched for a day (pushed: a week).
  It is read from local git only, so "pushed" and "merged" are as of your last `git fetch`; squash merges are
  recognised. **Ship** asks the agent to commit, push and open a pull request (the prompt is editable per agent) — the
  dashboard itself never commits or pushes. Once the work is merged, clean-up offers to remove the worktree; the branch
  is kept.
- **What protects you**: the feature is off until you enable it; the server only listens on `127.0.0.1`; the terminal
  WebSocket and every mutating route accept only the dashboard's own origin, so another web page cannot type into your
  agent; agents are started without a shell from the argument list you configured; and what an agent may do is decided
  by *its* permission prompts, which you answer in the terminal. The dashboard refuses profiles containing a
  permission-bypass flag.

## How it reads OpenSpec

**Changes are read from every checkout, not just the main one.** Work usually happens in git worktrees — one per change
— and a board that only looked at the main checkout would show a change only after it was merged *and* pulled. For a git
repository the scanner reads active changes from the main checkout and from every linked worktree `git worktree list`
reports, wherever it lives on disk (up to 12 per repository, most recently changed first; a worktree that is gone or
unreadable is skipped with a warning).

- **One card per change.** Copies of the same change are merged; the card shows the copy that is furthest along
  (then: more artifacts and tasks done, more recent, main checkout first). Its branch badge is the branch of the
  checkout it lives in, the tooltip names the worktree and any other checkout whose copy is at a different stage, and
  "Copy apply command" `cd`s into that checkout — not into the main one.
- **Archived on main wins.** Branches cut before an archive still carry the change as active; such leftovers are
  ignored (unless the copy was created after the archive, which makes it a new change reusing the name). Archives and
  main specs are always read from the main checkout.
- Progress, last activity (uncommitted edits in a worktree count) and Done-vs-Synced are evaluated in the checkout the
  change lives in. A repository's "last updated" covers its worktrees too.
- **Agent sessions** copy a change from wherever it lives. If the branch a session would use (`feat/<change>`) is
  already checked out in one of your worktrees — git allows a branch in one worktree only — the session *adopts* that
  worktree instead of failing; the panel says so, and the dashboard never removes a worktree it did not create.

Artifact status is computed in-process with `@fission-ai/openspec`'s artifact-graph primitives (no CLI shell-outs),
using the package's bundled `spec-driven` schema embedded at build time; a repo-local `openspec/schemas/<name>/`
takes precedence. Task progress comes from `tasks.md` checkboxes, dates from `.openspec.yaml` and the archive
directory name, activity from `git log -1` on the change directory (file mtime when not committed).

## Layout

```
src/server/   Bun server: config, discovery, scanner, openspec adapter, HTTP API, CLI entry
src/shared/   types and column derivation shared with the UI
src/ui/       Preact SPA (single-file build), design tokens, bundled fonts
scripts/      build-ui.ts → dist/ui/index.html
test/         bun tests; test/fixtures holds synthetic openspec/ trees
openspec/     this project's own OpenSpec changes and specs
```

## Contributing

One OpenSpec change per branch (`feat/<change-name>`) and pull request, Conventional Commit titles, and
`bun run check` green before pushing — see [CONTRIBUTING.md](CONTRIBUTING.md). Agents: start with [CLAUDE.md](CLAUDE.md).

## License

[MIT](LICENSE) © 2026 Jan Wendling
