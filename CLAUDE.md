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
   command that writes (one enumerated exception below). Today that list has two entries: the managed sections of `openspec/config.yaml` (applying
   shared config profiles, `src/server/sharedConfig.ts`), and — for agent sessions, which are off by default (one global switch;
   repositories can be excluded individually) — removing a session's own worktree after the user confirmed and read-only checks proved
   nothing would be lost (`git worktree unlock` + a non-forcing `git worktree remove`, the only git writes, in
   `src/server/sessions/worktree.ts`). Starting the user's agent CLI in a dedicated worktree on the user's click is
   not a write by the dashboard: what that agent changes is bounded by its allow-list and is the agent's doing. With
   agent sessions disabled no process that can modify a repository is ever started. Scanning, polling, discovery, previews and saving settings
   write nothing to a repository. All other writes stay under `~/.openspec-dashboard/` (or `OPENSPEC_DASHBOARD_HOME`
   in tests). Git is invoked only with the read-only subcommands listed in that spec. Adding a path or a subcommand
   means changing that spec first.
2. **Loopback only.** The server binds `127.0.0.1`; there is no auth because nothing else can reach it.
2a. **Mutating API routes are same-origin only.** Every non-GET `/api/` request passes `crossSiteRefusal` in
   `src/server/api.ts` (JSON content type, loopback host, own origin). Loopback binding alone does not stop a web page
   in the same browser; do not add a mutating route that bypasses the guard.
3. **`@fission-ai/openspec` internals only through `src/server/openspecAdapter.ts`.** Do not call the library's
   `resolveSchema`/`loadChangeContext`: they locate files via `import.meta.url`, which does not exist inside the
   compiled binary. The adapter embeds the schema at build time. Anything that works under `bun run` but reads files
   relative to a module path must also be verified in `dist/openspec-dashboard`.
4. **No network at runtime.** The UI is one HTML file with inlined JS, CSS and fonts; do not add CDN links, remote
   fonts or fetches to other hosts.
5. **The repository is the source of truth.** The dashboard indexes; it never stores facts about changes that are not
   derivable from the repositories.
6. **Change names reaching git or the file system are validated** (`CHANGE_NAME` in `src/server/source.ts`).
7. **Nothing from a real repository goes into this one.** No copied `openspec/` trees, repo names, paths, hostnames or
   people from other projects — not in fixtures, tests, specs, proposals or commit messages. Use made-up names
   (`demo-ops`, `alpha-infra`, `/w/acme/...`). Fixtures are generated, never copied. This repository may be public.

## Agent sessions (`src/server/sessions/`)

- The agent is only ever reached through the `Runner` interface; `claudeRunner.ts` is the one implementation and the
  one place that knows CLI flags. It never reads or forwards credentials, never uses a shell, fixes the permission
  mode to `dontAsk`, and starts with `--setting-sources project` so the user's personal allow rules cannot widen a
  session's allow-list. Do not add a way to pass free-form CLI arguments or a permission-bypass mode.
- Tests never start the real CLI or touch the network: they use `test/fixtures/fake-claude.ts`, which replays the
  shapes recorded in `test/fixtures/claude-stream/`. When the CLI's format changes, update both together.
- Session records live under `~/.openspec-dashboard/sessions/`; all writes for one session go through the store's
  per-session queue.

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
