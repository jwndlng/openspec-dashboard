# openspec-dashboard — agent guide

Local-first, read-only Kanban across OpenSpec repositories, shipped as a single Bun binary.
See `README.md` for what it does and `CONTRIBUTING.md` for the branch, commit and PR conventions.

## Commands

```sh
bun install
bun run dev        # build the UI, serve http://127.0.0.1:4711 from source
bun run check      # lint + typecheck + tests — run before every push; CI runs exactly this
bun run build      # dist/openspec-dashboard (UI and fonts embedded)
bun test test/scanner.test.ts   # a single test file
```

## Layout

- `src/server/` — config, discovery, scanner, HTTP API, CLI entry. `src/shared/` — types and column derivation used by
  both sides. `src/ui/` — Preact SPA built into one self-contained `dist/ui/index.html` by `scripts/build-ui.ts`.
- `test/fixtures/` — synthetic `openspec/` trees written for the tests (see `test/fixtures/README.md`). Tests assert on
  their structure: change them together with the tests, and never reformat or lint them.
- `openspec/` — this project's own specs (`openspec/specs/`) and changes. Requirements live there; read the relevant
  spec before changing behaviour.

## Invariants — do not break these

1. **Read-only towards tracked repositories, with enumerated exceptions.** The dashboard writes to a tracked
   repository only in response to an explicit user action, only to the paths enumerated in the "never writes"
   requirement of `openspec/specs/dashboard-api/spec.md`, never deletes or moves anything there, and never runs a git
   command that writes (the enumerated exceptions below). Today that list has three entries: the managed sections of `openspec/config.yaml` (applying shared config profiles,
   `src/server/sharedConfig.ts`), and — for agent sessions, off by default — a session's git worktree: created with
   `git worktree add` (directory under `~/.openspec-dashboard/worktrees/`, never inside the repository's working tree)
   and removed with a non-forcing `git worktree remove` after the user confirmed and read-only checks proved nothing
   would be lost (`src/server/sessions/worktree.ts`); and the **pull action** — `git fetch` of the repository's own
   remote, then a fast-forward-only `git merge` of the main checkout's upstream, with hooks disabled, never a merge
   commit, rebase, stash, reset, force or branch switch, and only fetching when the checkout is off its default branch,
   has no upstream, has diverged or has overlapping local edits (`src/server/pull.ts`, the only place that contacts a
   remote or changes a main checkout). Those two modules are the only places that run a git command that writes. Apart
   from the pull action the main checkout's index and files are never touched and no remote is ever contacted; the main
   checkout's branch is never changed by anything; and the pull action runs only on the user's explicit request — never
   on a timer, during a scan, on page load or as a side effect (`test/pull.test.ts` proves scans leave a recording
   remote untouched). Starting the user's
   agent in that worktree on the user's click is not a write by the dashboard: what the agent changes is decided by its
   own permission prompts. With agent sessions disabled no process that can modify a repository is ever started. Scanning, polling, discovery, previews and saving settings
   write nothing to a repository. All other writes stay under `~/.openspec-dashboard/` (or `OPENSPEC_DASHBOARD_HOME`
   in tests). Git is invoked only with the read-only subcommands listed in that spec. Adding a path or a subcommand
   means changing that spec first.
2. **Loopback only.** The server binds `127.0.0.1`; there is no auth because nothing else can reach it.
2a. **Mutating API routes are same-origin only.** Every non-GET `/api/` request passes `crossSiteRefusal` in
   `src/server/api.ts` (JSON content type, loopback host, own origin); the terminal WebSocket has `webSocketRefusal`. Loopback binding alone does not stop a web page
   in the same browser; do not add a mutating route that bypasses the guard.
3. **`@fission-ai/openspec` internals only through `src/server/openspecAdapter.ts`.** Do not call the library's
   `resolveSchema`/`loadChangeContext`: they locate files via `import.meta.url`, which does not exist inside the
   compiled binary. The adapter embeds the schema at build time. Anything that works under `bun run` but reads files
   relative to a module path must also be verified in `dist/openspec-dashboard`.
4. **No network at runtime, except the pull action.** The UI is one HTML file with inlined JS, CSS and fonts; do not
   add CDN links, remote fonts or fetches to other hosts. The server reaches a network only when git does, inside the
   pull action of invariant 1, on the user's click, using git's own credentials — the dashboard never sees, stores or
   asks for them, never prompts, and masks credentials in any error text it passes on.
5. **The repository is the source of truth.** The dashboard indexes; it never stores facts about changes that are not
   derivable from the repositories.
6. **Change names reaching git or the file system are validated** (`CHANGE_NAME` in `src/server/source.ts`).
7. **Nothing from a real repository goes into this one.** No copied `openspec/` trees, repo names, paths, hostnames or
   people from other projects — not in fixtures, tests, specs, proposals or commit messages. Use made-up names
   (`demo-ops`, `alpha-infra`, `/w/acme/...`). Fixtures are generated, never copied. This repository may be public.

## Agent sessions (`src/server/sessions/`)

- A session is an agent CLI in a **pseudo-terminal**, relayed byte for byte to an xterm.js view. Do not parse, filter or
  summarise its output, and do not add anything vendor-specific: an agent is a profile (`agents.ts` — argument list,
  prompts, resume command). Agents are started without a shell; the prompt is one whole argument or typed input.
- `GET /api/sessions/<id>/terminal` is the most sensitive endpoint in the project: whoever holds that WebSocket types
  into an agent on this machine. It has its own guard, `webSocketRefusal` (loopback Host, the dashboard's own `Origin`,
  missing `Origin` refused) because the JSON guard cannot cover a WebSocket handshake. Never loosen it, and never bind
  anything but loopback.
- Text the dashboard types into a *running* agent for the user (next-step prompts, default responses) never includes
  Enter: a terminal cannot tell us whether the agent shows a prompt or a selection menu, and in a menu Enter confirms
  whatever is highlighted — possibly a permission. One running session per worktree; archiving has its own.
- **Work status** (`workStatus.ts`) is read per worktree *directory* — directories outlive session records — with
  read-only git and no network, so `merged` means "as of the user's last fetch"; squash merges are recognised by
  comparing the content of the files the branch touched. The dashboard never commits, pushes or calls `gh`: **Ship** only
  hands the agent a prompt (`prompts.ship`, else `DEFAULT_SHIP_PROMPT`).
- Tests never start a real agent or use the network: `test/fixtures/fake-agent.ts` is a tiny interactive program run in
  real pseudo-terminals and temp git repositories.
- Anything here must also work in the compiled binary (`bun run build`), not just under `bun run`.

## One agent, one worktree

Several agent sessions work on this repository at the same time. **Every agent session that changes files works in its
own git worktree on its own branch — never in the main checkout, and never in another session's worktree.**

1. Before your first edit, create a worktree from the latest `origin/main`, on a branch named after your OpenSpec change:
   ```sh
   git fetch origin
   git worktree add .claude/worktrees/<change-name> -b feat/<change-name> origin/main   # or fix/…, chore/…, docs/…
   cd .claude/worktrees/<change-name> && bun install
   ```
   With the Claude Code CLI, `claude --worktree <change-name>` does the same. `.claude/worktrees/` is git-ignored.
2. Do all edits, `bun run check`, commits and the push from inside that worktree. One change = one worktree = one
   branch = one pull request (see `CONTRIBUTING.md`).
3. If your change's `openspec/changes/<change-name>/` directory exists only uncommitted in the main checkout, copy it
   into your worktree first and commit it there; do not edit it in the main checkout.
4. When the pull request is merged, remove your worktree: `git worktree remove .claude/worktrees/<change-name>`.

In the main checkout you may read, run the dashboard and run read-only commands. Do not edit files there, do not switch
its branch, do not stage or commit in it, and never commit, revert or "tidy up" work that belongs to another session
without the user's confirmation. Stay inside the files listed under **Impact** in your change's proposal; if you must
touch a file another in-flight change owns, say so in your proposal first.
