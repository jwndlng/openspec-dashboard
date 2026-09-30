# Design

## Context

See proposal.md — Why. What shapes the approach:

- The only prerequisite check that exists today is `availability()` in `src/server/sessions/agents.ts`: one
  `Bun.which(agent.command[0])` per configured agent, returned by `GET /api/sessions` and used to disable starters.
  Nothing checks `git`, the committer identity, the `openspec` CLI or `gh`.
- Invariant 4 (no network at runtime except the pull action) and invariant 1 (read-only towards tracked repositories,
  with an enumerated git subcommand allowlist) bound what a check may do. `config --get` is already on that allowlist;
  `--version` is not, and three in-flight changes already modify the requirement that holds the list, so this change
  introduces no new git subcommand.
- The hero's status corner (`src/ui/app.tsx`) already carries per-repository scan-failure badges — the precedent for an
  indicator that appears only when something is wrong.
- `src/ui/api.ts` declares the `Api` interface both the HTTP client and the demo implement, and the demo-site spec makes
  a missing demo implementation a type error. Adding one method therefore forces the demo report.

## Goals / Non-Goals

**Goals:**
- One report, computed in one module, that is a pure function of the machine plus the current configuration and last
  scan — so severity is derived and no "is this needed?" rule is duplicated in the UI.
- Never make the check itself a source of the problems it reports: no network, no repository access, no process beyond
  the one already-allowed git read, no credential value anywhere.

**Non-Goals:**
- A CLI flag or `doctor` subcommand. The report is reachable from the UI only; the module is written so a flag could use
  it later without change.
- Per-repository checks (missing path, no `openspec/config.yaml`, no remote, diverged checkout). Scan failures, the pull
  panel and cleanup already own those, and mixing them in would make the report grow with the repository count.
- Proving anything works: no `gh auth status`, no `git --version` parsing, no agent invocation. The report says what it
  found, not what will succeed.
- Fixing anything. No install, no `gh auth login`, no `git config` write — every remedy is a line of text for the user.

## Decisions

### D1. One module, `src/server/environment.ts`, is the only place that inspects the machine
It exports `environmentReport(config, snapshot): Promise<EnvironmentReport>` and nothing else. Every check is a small
local function returning `{ id, label, status, found, remedy? }`; the module assembles them in a fixed order and folds
the overall status. Keeping it a function of its arguments rather than of module state means the report is testable
without a server and reusable by a future CLI flag.
*Alternative:* extending `GET /api/sessions`, which already reports agent availability — rejected: that endpoint runs
git per worktree, is polled by the session UI, and would then compute the machine checks on every poll, which
`environment-check` forbids. The per-agent checks call `availability()` so the PATH lookup rule stays in one place.

### D2. Severity is derived from `(config, snapshot)`, never stored
A single `relevance` helper decides, per check, whether it is needed: agent sessions off ⇒ the agent, identity and `gh`
checks are `not-needed`; the default agent and any agent an enabled repository selects ⇒ `problem` when missing, any
other configured agent ⇒ `warning`; `git` ⇒ `problem` when some enabled repository's `RepoSnapshot.isGit` is true, else
`warning`. `isGit` comes from the scan, exactly as in-place sessions decide it — never from letting a git command fail.
*Alternative:* fixed severities per check — rejected: it would warn about `gh` on a machine where agent sessions are off
and nothing will ever call it, which is the noise that makes people stop reading a report.

### D3. `git config --get` runs in a directory that is provably not a tracked repository
The identity check spawns `git config --get user.name` and `user.email` with `cwd` = `dashboardHome()`, falling back to
`os.tmpdir()` if that path is inside any configured repository path, and with the same `GIT_OPTIONAL_LOCKS=0` and
`GIT_TERMINAL_PROMPT=0` environment as `git.ts`. Run outside a repository, `git config --get` reports the system, XDG
and global scopes — "configured for this user", which is what the check claims. The `dashboard-home` check runs first so
the directory exists by then.
*Alternative A:* running it in each repository, which would also see a repository-local identity — rejected: it turns a
machine check into per-repository work and makes the report read tracked repositories for no proportionate gain.
*Alternative B:* `--global` only — rejected: it would miss a system or XDG identity and report a false problem.

### D4. `gh` credentials are detected without reading a secret
A PATH lookup for the executable; then `GH_TOKEN` or `GITHUB_TOKEN` non-empty in `process.env` (its length, never its
content, and it is never retained), else `stat` of `hosts.yml` — size greater than zero, contents never opened — in
`gh`'s own order of precedence: `$GH_CONFIG_DIR` alone if set, else `$XDG_CONFIG_HOME/gh` alone, else `~/.config/gh` and,
on Windows, `%AppData%/GitHub CLI`. Following `gh`'s precedence rather than searching every location matters: searching
all of them would report the user's real `~/.config/gh` as the answer while `gh` itself would use the directory the
environment names. That covers `gh auth login` whether the token went to the file or to the OS keyring, since either way
`gh` writes the host entry.
*Alternative:* `gh auth status` — rejected: it contacts GitHub, so it would need a second enumerated exception to
invariant 4 (the user chose not to add one), and it prints account information the dashboard has no reason to hold.

### D5. The write probe is the only write, and it cleans up after itself
`dashboard-home` does `mkdir -p` on `dashboardHome()`, writes a uniquely named file (`.env-check-<random>`) and deletes
it. A unique name means two dashboards, or a probe racing a previous one, never collide; deleting it keeps the promise
that a check leaves nothing behind. A failure at any step is `problem` with the directory named and the OS error
message.
*Alternative:* `fs.access(W_OK)` — rejected: it answers the permission bits, not "can a file be created here", which is
what fails on a read-only or full volume.

### D6. Caching in the module, requesting in the app shell
`environmentReport` memoises its last result for 10 seconds, keyed on everything it was computed from (the agent-session
config, the enabled repositories and their `isGit`), so a saved configuration is always reflected by the next report.
**Re-check** passes `force`, because the user has just changed something on the machine that no cache key can see; the
route reads it from `?force=1`, which keeps the endpoint a plain `GET`. `src/ui/app.tsx` owns the report state and fetches it on mount, after `onSaved` (the config
changed, so relevance and the agent list may have), and on **Re-check**; the auto-refresh timer and `loadState()` do
**not** fetch it. It is passed down to `Settings` and read by the hero, rather than put in a new context — there is one
consumer on each side and the shell already passes `config` and `snapshot` this way.
*Alternative:* folding the report into `GET /api/state` — rejected: the snapshot is derived from repositories
(invariant 5) and is polled; the report is neither.

### D7. Section last, and the section list gains one entry
`environment` is appended to `SECTION_IDS`. It goes last because it configures nothing and because `serializeSection`
treats the first section as the default that is not written to the URL — appending keeps every existing deep link,
including `?section=` being absent for Workspace roots. Note the spec's section list does not mention the existing
`integratable` section (it arrived with `repo-integration` without a `settings-page` delta); this change copies the list
as it stands and appends to it rather than fixing that gap, which belongs to whoever owns that section's spec.

### D8. Nothing in the demo may look real
`test/demoSynthetic.test.ts` rejects anything in the demo that reads as a real e-mail address, URL, host or home
directory. The report joins what that test covers, which is why the demo's committer identity reads `Demo User,
configured for this user` rather than carrying an address: the detector would flag one, rightly.

### D9. Types and the demo
`src/shared/types.ts` gains `EnvironmentStatus = "ok" | "warning" | "problem" | "not-needed"`, `EnvironmentCheck` and
`EnvironmentReport`; `Api` gains `environment(): Promise<EnvironmentReport>`. The demo implements it in `demoApi.ts` with
a constant defined next to the rest of the sample data in `sampleData.ts`, with made-up paths (`/opt/demo/bin/git`), and
derives the `not-needed` entries from the demo config's `agentSessions.enabled` so switching agent sessions off in the
demo behaves as in the dashboard.

### D10. One PATH lookup rule, in `paths.ts`
`Bun.which(cmd)` resolves against the PATH captured when the process started, not against `process.env.PATH`, so it
cannot see a PATH the process changed — which is what a test does, and what a check must be able to observe. A helper
`whichOnPath(command)` in `src/server/paths.ts` passes `PATH` explicitly; `availability()` in `sessions/agents.ts` uses
it too, so the per-agent checks and the report's own lookups follow one rule. The launch-time `Bun.which` guards in
`sessions/manager.ts` are left as they are: they run in the server process, where the two PATHs are the same, and
rewriting them belongs to no requirement of this change.

### D11. Tests
`test/environment.test.ts` sets `OPENSPEC_DASHBOARD_HOME` to a temp directory and `process.env.PATH` to a temp `bin`
holding stub executables, which is how a missing tool is simulated without touching the machine's real PATH — the same
spirit as `test/fixtures/fake-agent.ts`. Cases: every check `ok`; each tool missing in turn; `not-needed` with agent
sessions off; `problem` vs `warning` for the default and an unused agent; `git` severity following `isGit`; a token in
the environment never appearing in the report; a read-only home; and that no file under a fixture repository changes and
the probe file is gone. The API test asserts `GET /api/environment` and that `POST` to it is not a route.

## Risks / Trade-offs

- **A repository-local `user.name`/`user.email` reads as missing** → the check says "configured for this user" and its
  remedy notes that a repository may set its own, so the text is true either way; the status is `warning`, never
  `problem`, so nothing is blocked by it.
- **A `gh` token held only in an OS keyring with no `hosts.yml`** → reads as no credentials found. The wording says the
  report looked and did not find them, not that there are none, and the status is `warning`.
- **An expired or revoked credential reads as configured** → stated in the report itself, as its own requirement; this
  is the price of the local-only choice and the report must not pretend otherwise.
- **A report that becomes noise** → nothing is `problem` unless the configuration says the dashboard needs it, the hero
  indicator is shown only for non-`ok`, non-`not-needed` checks, and a failed *request* for the report shows no
  indicator at all.
- **Two more spawned processes per report** → memoised for 10 seconds and never on a timer, so the steady-state cost of
  a dashboard nobody is looking at is zero.
- **Spec overlap with in-flight changes** (`dashboard-api` "never writes", `kanban-board` hero header,
  `demo-site` session requirements) → this change adds requirements to those three specs and modifies only
  `settings-page`, which no in-flight change touches.

## Migration Plan

Additive: no config field, no stored data and no endpoint behaviour changes, so nothing to migrate and nothing to roll
back beyond reverting the commit. The report is computed on demand, so an older dashboard binary and a newer one differ
only in whether the section and the indicator exist.
