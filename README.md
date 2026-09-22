# openspec-dashboard

Local-first Kanban across every [OpenSpec](https://github.com/Fission-AI/OpenSpec) repository on this machine.
Ships as a single Bun binary. Repositories stay the source of truth; the dashboard indexes them and is read-only
towards them, with three explicit exceptions: applying [shared config profiles](#shared-openspec-config) (previewed), the
optional, off-by-default [agent sessions](#agent-sessions-optional-off-by-default), and — on your click on the repository
board — creating a new `openspec/changes/<name>/` directory with its schema marker and, when you jotted one down, a
free-text `prompt.md`.

**[Live demo →](https://blog.wndlng.ch/openspec-dashboard/)** — the real UI on made-up sample data, nothing to install.

<a href="https://blog.wndlng.ch/openspec-dashboard/#/board">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://blog.wndlng.ch/openspec-dashboard/screenshots/board-dark.png">
    <img alt="The combined Kanban board: one column per lifecycle step from New to Archived, cards grouped and coloured by repository, with task progress, last activity, branch badges and warnings." src="https://blog.wndlng.ch/openspec-dashboard/screenshots/board-light.png">
  </picture>
</a>

## Run

**Download a binary** for macOS (arm64, x64) or Linux (x64, arm64) from the
[releases page](https://github.com/jwndlng/openspec-dashboard/releases) — it needs nothing else. Each release lists
its files with `SHA256SUMS` and build-provenance attestations; check a download with
`shasum -a 256 -c --ignore-missing SHA256SUMS` and `gh attestation verify <file> --repo jwndlng/openspec-dashboard`,
then `chmod +x` it. The macOS binaries are not notarised: if macOS refuses to open one, run
`xattr -d com.apple.quarantine <file>`. `--version` prints the release it was built from.

**From source**, [Bun](https://bun.sh) ≥ 1.4 is needed to build; the compiled binary needs nothing else.

```sh
bun install
bun run dev                     # builds the UI, serves http://127.0.0.1:4711 from source
bun run build                   # dist/openspec-dashboard (single binary, UI + fonts embedded)
./dist/openspec-dashboard       # opens the browser; --port N, --no-open and --version are available
bun test                        # unit + API tests against the fixture repos in test/fixtures
bun run check                   # lint + typecheck + tests — what CI runs
bun run build:demo              # dist/demo/index.html — the demo: same UI, in-memory API, sample data (open it from disk)
bun run screenshots             # dist/demo/screenshots/*.png from the demo build (needs Chrome; CHROME_BIN overrides)
```

**What the demo simulates.** The demo is the real UI on an in-memory API. Besides the sample board it starts with
agent sessions switched on and a made-up agent ("Demo Agent"): cards show running sessions and work status
(`3 uncommitted`, `2 unpushed`, `pushed`, `merged`), the top bar lists open work, and you can start, answer, Ship, close
and remove — all in memory, reset by a reload. A session's terminal plays a **hand-written recording** into the same
terminal view the dashboard uses; nothing runs on the page and what you type goes nowhere. Recordings live in
`src/ui/demo/transcripts.ts` and are *written*, never captured: `bun run check` fails if a recording or any demo
session data contains a real-looking home directory, an e-mail address, a URL or a host name, and the product build is
checked to contain none of the demo's data.

First run: open **Settings** and add a workspace root such as `~/Workspace`. Discovery runs immediately and lists
what it found under **Discovered**; click **Enable** on the repos to track, then save.

## What it does

- **Activity** (`/activity`) — what happened, newest first and grouped by day: changes created, moving to another
  column, archived or removed, tasks being ticked (shown collapsed, e.g. `3/12 → 7/12`), repositories being tracked or
  failing to scan, and agent sessions starting, ending and shipping. It is detected by comparing each scan with the
  previous one, so it also catches up on what happened while the dashboard was not running. Filter by repository and by
  kind; the navigation entry shows how many events are new since you last looked. A repository seen for the first time
  adds one line, not one per change.
- **Settings** — one page with a section navigation at the top-left that scrolls with the content, like a table of
  contents (jump to a section, see which one is in view,
  link to one with `?section=discovered`; it shows how many discovered repositories are waiting). Workspace roots, discovery of repos containing `openspec/config.yaml` (4 levels deep; skips
  `node_modules`, nested copies and linked git worktrees), opt-in tracking per repo, display names, poll interval.
  Discovery is a read-only preview: it re-runs whenever the roots change (even unsaved), when Settings opens and on
  **Rediscover**, and never writes to the config. Only repos you enable are stored; forgetting (×) a tracked repo
  returns it to the discovered list. Configs from earlier versions may still hold disabled entries for every repo
  that was discovered back then — they stay under **Tracked** and can be forgotten individually.
  - **One directory, one repository.** Roots, ignored paths and repository paths are stored canonically (`~` expanded,
    symlinks resolved, on-disk casing), so `~/Workspace/alpha` and `~/workspace/alpha` — or a symlinked root — never
    list a repository twice. A config from an earlier version is migrated on load: paths are canonicalised and entries
    that turn out to be the same directory are merged (the enabled one and its name win).
  - **Ignored paths** keep an area out of discovery, e.g. a directory of bulk checkouts: add it under *Workspace
    roots*, or click **Ignore** on a candidate. They only affect discovery — a repository that is already tracked
    stays tracked until you forget it.
  - **Second clones.** Repositories sharing a display name show the distinguishing part of their parent path, and a
    candidate whose name is taken is enabled as `<name> (<parent dir>)`. A candidate with the same `origin` remote as
    another known repository gets a *same remote as …* badge. That is information only: repositories are never merged
    or hidden by remote, because distinct projects can share one.
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

State lives in `~/.openspec-dashboard/` (`config.json`, `shared-config.json`, `cache/snapshot.json`, `activity.jsonl`, `sessions/`, `worktrees/`).
`activity.jsonl` is the history behind the Activity view: append-only, bounded, and the one thing here that cannot be
rebuilt from your repositories — deleting it loses that history and nothing else. The dashboard
only runs read-only `git` commands (`rev-parse`, `log`, `worktree list`, `status`, `config --get` — with optional locks disabled, so
not even `.git/index` is refreshed), and scanning, polling, discovery and saving settings never write to a tracked
repository, and none of them contacts a remote. Writes to a tracked repository only happen on your click, and only
through the enumerated exceptions: **Pull** (below), **applying shared config profiles**, opening or removing an
**agent session**'s worktree, and **New change** — creating a new `openspec/changes/<name>/` directory on the repository
board, with its schema marker `.openspec.yaml` and, when you typed one, a `prompt.md`. A change created that way sits in
the **New** column; on cards before **Ready** the copy action produces a `/opsx:continue` command that points an agent
at `prompt.md`.

## Pull, and the branch notice

Work gets merged on the remote; a main checkout only learns about it through `git pull`. Until then the dashboard is
right about an older state: archived changes and specs come from the main checkout, and `merged` / ahead-behind
figures are "as of your last fetch". **⇣ Pull** (per repository, in its board header and its Projects row, plus
**Pull all**) does that for you — and it is the only thing in the dashboard that ever contacts a remote, and only when
you click it.

- **What it runs.** `git fetch` of the repository's remote, then a **fast-forward-only** update of the main checkout.
  Never a merge commit, a rebase, a stash, a reset, a force or a branch switch; linked worktrees and submodules are not
  touched. Uncommitted edits to files the update does not touch stay as they are.
- **When it only fetches.** If the checkout is not on the default branch (or detached), has no upstream, has diverged,
  or has an uncommitted edit the update would overwrite, the checkout is left exactly as it is and the badge says why
  (`fetched only` / `refused`, with git's own message). The fetch still makes work statuses current.
- **Credentials, prompts, hooks.** It uses git's own credentials (SSH agent, credential helper); the dashboard never
  sees, stores or asks for them. Nothing can prompt — a remote that needs a login fails with a message — and a fetch is
  stopped after 60 s. Repository hooks are **not** run (a plain `git pull` would run `post-merge`); if the repository has
  one, the outcome says so, so you can run it yourself.
- **Branch notice.** If a main checkout is not on its default branch (what `origin/HEAD` points to, else `main`, else
  `master`), its Projects row and board header say so: archived changes, specs and progress for that repository come
  from whatever branch is checked out and may be outdated. Changes living in worktrees are read from their own
  checkouts and are unaffected. Nothing is hidden; it is a notice.

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
a change is ready, **Archive** once every task is done (columns **Done** and **Synced**) — and it opens **in a terminal
inside the dashboard**. It is the same program you would run in your own terminal, with its own login, settings, slash
commands and permission prompts; the dashboard shows it, passes your keystrokes on, and interprets nothing.

- **One switch, off by default**: Settings → *Agent sessions*. Once on it applies to every tracked repository; switch
  individual repositories off in the same section. While it is off, no card shows a starter and the API refuses.
- **Bring your own agent**: an agent is a *profile* — a command as an argument list (`{prompt}` is where the opening
  prompt goes), a prompt per starter (`{change}` is the change name), and optionally a resume command. **Claude Code**
  is preconfigured (`claude {prompt}`, the `/opsx:*` commands, `claude --continue`; API-key variables are removed from
  its environment so its own login — for example a subscription — is used). Add any other CLI that runs interactively
  in a terminal, pick a default, and choose a different agent per repository if you like. The dashboard never handles
  credentials.
- **Archive syncs first**: the preconfigured Archive prompt tells the agent to sync the change's delta specs into
  `openspec/specs/` and then archive, without asking whether to sync; with nothing left to sync it archives right away.
  The agent does both in the archive worktree under its own permission prompts — the dashboard writes no specs and moves
  no change. It is an ordinary prompt: to get the question back, or to archive without syncing, edit it in Settings
  (remove it and the starter disappears). A saved configuration that still has the former default,
  `/opsx:archive {change}`, verbatim on the `claude` profile is read as the new prompt — so word it differently if you
  want the old behaviour, e.g. `/opsx:archive {change} and ask me before syncing`. Edited prompts and other profiles are
  never changed.
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
- **Default responses**: while a session is running, the panel offers `Yes, go ahead`, `Yes, create a PR` and
  `No, stop here` under the terminal. One click sends it: the text is typed, and Enter follows as soon as the agent's
  terminal shows the text back — which a text prompt does and a selection menu does not. At a menu (a permission or
  trust question) nothing is confirmed: the text stays typed, and the panel tells you it was not sent. Ship and opening
  prompts that are typed after start-up are sent the same way, so an agent that opens with a dialog is never answered
  for you.
- **A dock, not a side panel**: terminals sit in a dock across the bottom of the window — wide and short, the shape
  terminal output has — with the board fully usable above it. Drag its top edge (or use the arrow keys on it) to
  resize; the height is remembered in the browser. **Maximise** gives it the window, **Collapse** leaves only the tabs.
  Up to **three sessions side by side**; the tab strip lists every running session (▣ marks the ones shown). A tab
  that is not shown opens in a free pane, or replaces the pane you are in once three are shown; a pane's ✕ closes the
  pane, never the session. The link in the address bar carries the shown sessions. On narrow windows one pane shows.
- **Several at once**: the dock has a tab per running session, so you switch between agents without hiding anything.
  A card keeps offering the step that fits the change's stage while its session runs: after *Draft artifacts* has
  finished, **↳ Implement** types the next prompt into the same terminal — you press Enter, because the dashboard cannot
  know whether the agent is showing a prompt or a menu. Archiving always gets its own session and worktree. The ✕ on a
  running badge ends a session from the card; the dialog warns — loudly when files or commits exist only in the
  worktree — and offers **Ship instead**.
- **Nothing is left behind**: every session worktree gets a work status, also after its session ended or its record
  was deleted — `3 uncommitted`, `2 not pushed`, `pushed` or `merged` — shown on the card and in **Open work** in the
  top bar, which lists all of them across repositories and highlights work nobody touched for a day (pushed: a week).
  It is read from local git only, so "pushed" and "merged" are as of your last `git fetch`; squash merges are
  recognised. **Ship** sends the agent a prompt to commit, push and open a pull request (editable per agent) with one click — the
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
  ignored (unless the copy was created after the archive, which makes it a new change reusing the name).
- **Archived in a worktree counts too.** Agents archive on a branch in a worktree, and the main checkout only catches up
  when that branch is merged *and* pulled. An archive that only a worktree has therefore leads like any other furthest
  stage: the card is in Archived with a badge `on <branch> · not in main checkout`, and its tooltip names the checkouts
  that still hold an active copy. Archives the main checkout has are read from there only; main specs always are.
- A project in a subdirectory of its git repository is read from that same subdirectory of every worktree.
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
