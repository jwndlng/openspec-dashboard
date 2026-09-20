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

- **Settings** — workspace roots, discovery of repos containing `openspec/config.yaml` (4 levels deep; skips
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

State lives in `~/.openspec-dashboard/` (`config.json`, `shared-config.json`, `cache/snapshot.json`, `sessions/`). The dashboard
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

Open an interactive agent session for a change straight from its card: **Draft artifacts** while artifacts are missing,
**Implement** once a change is ready. The dashboard starts your locally installed [`claude`](https://claude.com/claude-code)
CLI on **its own existing login** — so a Claude subscription keeps being used; the dashboard never sees credentials and
removes `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` from the agent's environment unless you opt in to passing them.

- **Enable it twice**: Settings → *Agent sessions* → turn it on, then opt in each repository. Until then no card shows a
  starter and the API refuses to open sessions.
- **It is a conversation**: the panel shows the live transcript; type follow-ups, press **Stop** to interrupt a turn
  without losing the conversation, **Close** when done. "Copy resume command" continues the same conversation in your
  terminal (`cd <worktree> && claude --resume <id>`). Sessions survive a dashboard restart.
- **One agent, one worktree**: every session works in `.claude/worktrees/<change>` of the repository, never in your main
  checkout. Closing offers to remove the worktree only when it is clean and fully pushed.
- **Bounded permissions**: sessions run with `--permission-mode dontAsk` and an allow-list — file read/search/edit, the
  `openspec` command and local `git status/diff/log/add/commit/branch -m` — plus what you add per repository (for example
  `Bash(bun run check*)`). Anything else is denied without a prompt and shown in the transcript. Your personal Claude
  settings and allow rules are *not* inherited (`--setting-sources project`); a repository's own `.claude/settings.json`
  is. The CLI still runs its small built-in set of read-only commands. There is no way to pass a permission-bypass flag.
- Limits: one open session per change, two agents working at once by default (more queue up), idle agent processes are
  stopped after 30 minutes and resumed on your next message. Records live in `~/.openspec-dashboard/sessions/`.

## How it reads OpenSpec

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
