## Context

`rename-to-spec-control` (merged, not yet archived) renamed everything visible and left group 3 of its design — the
local identifiers — for this change. They sit in four places with different owners:

- **The home** `~/.openspec-dashboard/`, resolved in one function (`dashboardHome()` in `src/server/paths.ts`), which
  every other path helper builds on. It holds `config.json`, `shared-config.json`, `activity.jsonl`, `cache/`,
  `pull-requests.json`, `sessions/<id>/meta.json`, `pull-backups/`, `merge-scratch/`, `console/` and
  `worktrees/<repoId>/<name>/`. Absolute paths into the home are stored in two places: each session record's
  `worktreePath`, and `config.json` where a user may have typed a path under the home (a console folder, say). Git
  stores the absolute path of every session worktree in the tracked repository (`.git/worktrees/<name>/gitdir`), and
  the worktree's own `.git` file points back at that admin directory, which does not move.
- **Environment variables** `OPENSPEC_DASHBOARD_HOME` (tests, users' scripts) and `OPENSPEC_DASHBOARD_VERSION` (build
  time only, set by `release.yml`, compiled in through the `OPENSPEC_DASHBOARD_BUILD_VERSION` define).
- **Browser storage** — six `openspec-dashboard.*` keys across `theme.ts`, `tourState.ts`, `groupState.ts`,
  `autoRefresh.ts`, `whatsNewState.ts` and `activityState.ts`, all on the unchanged origin
  `127.0.0.1:<port>`.
- **Tracked repositories' files** — the `openspec-dashboard:shared` markers in `openspec/config.yaml`, and the
  `(openspec-dashboard)` suffix of the `depends-on.yaml` header comment written by `createChange.ts`.

Today the server reads its config, initialises sessions (ending any record still marked running, because session
processes never outlive the server), starts the scanner, and only then calls `Bun.serve` to bind the port.

## Goals / Non-Goals

**Goals:**
- After one start of the new binary, nothing the dashboard writes uses the old name, and nothing is lost: settings,
  history, session records (with resume), work statuses and worktrees all carry over.
- A failed or partial migration never leaves the user worse off than before: the old paths still resolve, and nothing
  is deleted.
- No write to a tracked repository beyond `git worktree repair` of the dashboard's own worktrees, which the spec
  enumerates.

**Non-Goals:**
- Rewriting markers in repositories nobody applies to again, or old `depends-on.yaml` headers. Both are inert text;
  touching them would be a write without a user action.
- Merging two homes when both exist as real directories (someone ran both binaries side by side with an explicit
  home). The dashboard uses the new one and names the leftover; the user decides.
- Migrating an explicit home (`SPEC_CONTROL_HOME`/`OPENSPEC_DASHBOARD_HOME`). The user chose that path; it is not the
  old name.
- Agents' own per-directory state (some agents key their conversation history by working directory). The dashboard
  stays vendor-neutral; see Risks.

## Decisions

### Resolve the home in one place, with the migration's outcome as input
`dashboardHome()` keeps being the only resolver, with the order the spec gives: `SPEC_CONTROL_HOME`, then
`OPENSPEC_DASHBOARD_HOME` (deprecated, a one-line notice on start), then `~/.spec-control`. The one exception is a
migration that could not rename: then this run uses `~/.openspec-dashboard`. That fallback is set once by the
migration module before anything else reads the home (a module-level override in `paths.ts`, never an environment
variable we write ourselves, so children such as agents do not inherit it). Tests keep pointing the home at a temp
directory; `test/helpers.ts` switches to `SPEC_CONTROL_HOME`, and one test covers the deprecated variable.

### Move with one rename, then leave a symbolic link
The whole home moves with a single `rename(~/.openspec-dashboard, ~/.spec-control)`. Both live in the same parent
directory, so it is atomic and needs no copy: either nothing moved or everything did, and no file is half-copied. A
`symlink(~/.spec-control, ~/.openspec-dashboard)` follows.
- *Alternative:* move file by file, as the proposal first sketched. Rejected: dozens of entries, worktrees with their
  own `node_modules`, and every partial state needs its own recovery.
- *Alternative:* no link. Rejected: shells, editors and terminals opened in a worktree, users' scripts, and any git
  record the repair could not fix would point at a missing directory. With the link, an unrepaired record still
  resolves, so a failed repair loses nothing and stays retryable. `cleanup.ts` already compares `realpath`s, so a
  worktree that git still lists under the old spelling is still recognised as the dashboard's own.
- If the old home is itself a symbolic link (a user who relocated it), the rename moves the link and keeps its target,
  so the same steps apply.

### Migrate after the port is bound, before anything else
Starting the new binary while the old one is still serving must not pull its home away. The port is the dashboard's
single-instance lock, so `main()` changes order: parse arguments; resolve the port from `--port` or, read-only, from
the old or new `config.json`; `Bun.serve` with a handler that answers `503` "starting"; then migrate; then the
existing start-up (config, sessions, scanner); then `server.reload()` with the real handlers. A failed bind exits
before anything is touched. `--help` and `--version` return before all of this, as they do today.
- *Alternative:* look for running processes with a working directory in the old home (`lsof`). Rejected: not portable,
  and it would only find processes, not a second dashboard.

### Rewrite our own stored paths; derive the rest
After the rename, every `sessions/*/meta.json` whose `worktreePath` lies under the old home gets that prefix replaced,
written atomically with the session store's own writer, and `config.json` is loaded, its paths under the old home
rewritten, and saved through the existing atomic `saveConfig`. `cache/snapshot.json` is deleted rather than rewritten:
it is a cache, and the first scan replaces it. Nothing else in the home stores absolute paths into the home (activity
entries hold no paths by spec; pull-request lists hold none).

### Repair from the main checkout the worktree names
For each `worktrees/<repoId>/<name>/` the migration reads the worktree's `.git` file (`gitdir: <repo>/.git/worktrees/<x>`),
derives the repository's common directory from it, and runs `git -C <main checkout> worktree repair <new path>` there,
with the same environment as every other git call (`GIT_OPTIONAL_LOCKS=0`, no prompts). Deriving the repository from
the worktree, not from `config.json`, covers worktrees of repositories that were since removed from the config. Every
worktree is repaired independently; one failure does not stop the others. Directories that are not linked worktrees
(the `missing` work status) are left alone.
- `git worktree repair` needs git 2.29 or later. On an older git the step fails like any other and the link keeps the
  worktree usable; the environment check already reports the git version.

### Record the migration in the home and retry what failed
The migration writes `~/.spec-control/migration.json` (atomically): when it ran, from where, and the steps still
pending with their last error — a session record or config rewrite, a worktree to repair, the link to create. On every
start without an explicit home, pending steps are retried and dropped once they succeed or their worktree directory is
gone. The environment check gains a `home-migration` item that is shown only while something is pending or both homes
exist as real directories, and it names what is left and why. This is outcome reporting, not history, so it stays out of
`activity.jsonl`.

### Markers: read both, write one
`sharedConfig.ts` gets a marker pattern that accepts both prefixes and records which one a section used; begin and end
of one block must use the same prefix. The in-sync comparison already compares content, not marker lines, so a
former-prefix section with equal content is `in-sync`. `render` only ever writes `spec-control:shared`, so an apply
that writes a file moves all its kept sections to the new prefix, and the preview diff shows it. Profile validation
rejects both strings in a context. The demo's copy in `demoApi.ts` follows.

### Storage keys: one copy per browser
A small `src/ui/storage.ts` module owns the prefix and the one-time copy: before the first read, if
`spec-control.migrated` is absent, it copies every `openspec-dashboard.*` key with a value to its `spec-control.*`
name unless that already has one, then sets the marker. All six key constants move to the new prefix and read
through it. Copying once, rather than falling back on every read, is what keeps a removed preference (the theme's
`system`) from being resurrected; leaving the former keys in place makes it reversible with the old binary. Every
access stays inside the existing try/catch, so an unavailable storage behaves as before.

### Build version
`scripts/build.ts` reads `SPEC_CONTROL_VERSION`, else `OPENSPEC_DASHBOARD_VERSION`, else `dev`, and defines
`SPEC_CONTROL_BUILD_VERSION`; `release.yml` sets `SPEC_CONTROL_VERSION`. Only the build reads these, so the fallback
costs nothing and can be dropped with the home variable.

### Tell the user once
A What's new entry says the state moved to `~/.spec-control/`, that a link remains at the old path, and that
`OPENSPEC_DASHBOARD_HOME` is deprecated. The start-up line prints the migration's outcome once.

## Risks / Trade-offs

- **[An agent that keys its history by directory may not find a moved worktree's conversation on Resume]** →
  Resume still starts the agent's own resume command in the worktree, and the agent decides what it finds. The What's
  new entry says that sessions ended before the upgrade may resume without their earlier conversation. The dashboard
  adds nothing agent-specific to work around it.
- **[A process outside the dashboard still has its working directory in the old home]** (a shell, an editor, an agent
  the user started by hand) → the rename keeps its working directory valid (same inode), and the link keeps paths that
  name the old home resolving.
- **[The link keeps the old name visible in `~`]** → it is one entry the user may delete; the dashboard never needs it.
  Removing it automatically is left for a later release (see Open Questions).
- **[A write to tracked repositories without a click]** → it is limited to `git worktree repair` of worktrees the
  dashboard created, only after the user started the new binary, and is enumerated as entry (8) in the "never writes"
  requirement. A test proves the main checkout's index, working tree and refs, and other worktrees' records, are byte
  for byte unchanged.
- **[Archive order against `rename-to-spec-control`]** → this change's deltas for `dashboard-api` ("Single binary…")
  and `release-publishing` are written against that change's versions of those requirements. Archive
  `rename-to-spec-control` first.
- **[Both homes exist]** (an explicit home was used, then removed, or an aborted manual move) → no merge; the new home
  wins and the environment check names the old one.

## Migration Plan

1. Ship in one release. On the user's first start of that binary, the home moves as above; there is nothing to do by
   hand.
2. Rollback: an older binary started afterwards finds `~/.openspec-dashboard` as a link to the new home and keeps
   working with the same state; browser keys under the old prefix are still there. The worktree records point at the
   new paths, which also resolve. Only state written afterwards by the new binary under new keys would not be seen by
   the old one.
3. In a later release: stop reading `OPENSPEC_DASHBOARD_HOME` and `OPENSPEC_DASHBOARD_VERSION`.

## Open Questions

- Whether, and in which release, the dashboard removes the compatibility link at `~/.openspec-dashboard` (only when it
  still points at the new home and no git record names a path through it). Deferrable: keeping it costs one directory
  entry.
