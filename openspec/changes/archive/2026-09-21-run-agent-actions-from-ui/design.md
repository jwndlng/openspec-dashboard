## Context

The dashboard is a single Bun binary serving a Preact UI on `127.0.0.1`. Until now it only reads tracked repositories. This change lets the user open an **interactive agent session** for a change from its card: the server starts the user's locally installed `claude` CLI (Claude Code) on the user's existing login, streams the conversation into the UI, and lets the user keep sending instructions. Each session works in its own git worktree.

Verified locally against `claude` 2.1.x `--help` (no model usage): `-p/--print`, `--output-format stream-json`, `--input-format stream-json` ("realtime streaming input"), `--replay-user-messages`, `--include-partial-messages`, `--verbose`, `--session-id <uuid>`, `-r/--resume`, `--fork-session`, `-w/--worktree [name]`, `--add-dir`, `--append-system-prompt`, `--allowedTools`, `--disallowedTools`, and `--permission-mode` with choices `acceptEdits | auto | bypassPermissions | manual | dontAsk | plan`.

**Observed in the spike** (2026-09-20, `claude` 2.1.x, real subscription login, trivial prompts; sanitised event samples are in `test/fixtures/claude-stream/`):
- O1 (was A1) ✓ With `ANTHROPIC_API_KEY` absent, print mode runs on the subscription login; `system/init` reports `apiKeySource: "none"`.
- O2 (was A2) ✓ With `--input-format stream-json` the process stays alive between turns. Input is one JSON line per message: `{"type":"user","message":{"role":"user","content":[{"type":"text","text":"…"}]}}`. Every turn emits `system/init` again, the replayed user message (`isReplay`), `assistant` events (content blocks `text`, `tool_use`; `thinking` blocks are ignored), tool results as `user` events, and ends with `result` (`subtype`, `is_error`, `result`, `total_cost_usd`, `usage`, `permission_denials`, `terminal_reason`). `system/thinking_tokens` and `rate_limit_event` also occur. Closing stdin ends the process with exit 0. In one-shot mode stdin must be redirected or the CLI waits.
- O3 (A3 **corrected**) `dontAsk` + `--allowedTools` denies without prompting and reports the denial both as an error tool result and in `result.permission_denials` (tool name and input) — **but only bounds the session if user-level settings are excluded**: by default the user's own `permissions.allow` rules (real-world configs hold dozens, including network commands) are merged into the session. `--setting-sources project` excludes them; login and project slash commands keep working. A small built-in set of read-only commands (e.g. `echo`) runs regardless of the allow-list.
- O4 (was A4) ✓ A project slash command sent as message text executes, also under `--setting-sources project`.
- O5 (A5, with details) ✓ `--worktree <name>` creates `.claude/worktrees/<name>`, reports it as `cwd` in `system/init`, and reuses an existing worktree of that name. The branch is named **`worktree-<name>`**, and the worktree is left **locked** after the process exits. `--resume <session-id>` continues the conversation from the repository root or from inside the worktree.
- O6 (A6, partly) Not logged in: process exit 1, final `result` with `is_error: true`, `result: "Not logged in · Please run /login"`, `terminal_reason: "api_error"`. A usage-limit failure could not be provoked; `rate_limit_event.rate_limit_info` carries `status` and per-window `utilization`/`resetsAt` (`five_hour`, `seven_day`), which the UI can show. Treating `status != "allowed"` as `usage-limit` remains an assumption.
- O7 (new) **Interrupt**: SIGINT ends the *process* (`result/error_during_execution`, `terminal_reason: "aborted_streaming"`, exit 0). An in-band `{"type":"control_request","request_id":…,"request":{"subtype":"interrupt"}}` is answered by a `control_response`, ends only the *turn* with the same result, and the process accepts the next message.
- O8 (new) Variadic flags (`--allowedTools <tools...>`) swallow a following positional argument; pass them as a single `--flag=a,b` value.

Constraints: no credentials handled by the dashboard; Anthropic's Agent SDK is not used (it requires an API key and third-party tools may not offer claude.ai login); loopback-only server without auth; several changes in flight modify the same spec blocks.

## Goals / Non-Goals

**Goals:**
- Open, conduct, stop, close and reopen a per-change conversation with the agent from the dashboard, on the user's Claude subscription.
- Every session isolated in its own worktree and branch; nothing runs in the main checkout.
- Off by default behind one explicit switch, with per-repository exclusion; bounded tool permissions; never a permission bypass.
- Testable without the real CLI or network.

**Non-Goals:**
- Autonomous pickup/scheduling, other agent CLIs, approving individual tool requests from the UI, sessions not bound to a change, committing/pushing/PR creation by the dashboard, remote execution.

## Decisions

> **Revised 2026-09-21 — read D15–D19 first.** The first implementation (D1–D13) drove Claude Code through its
> machine-readable stream and rendered a transcript of its own. In use that was the wrong product: it exposed the agent's
> internals (every tool call and result) instead of the agent's interface, could never show the agent's own prompts, and
> tied the feature to one vendor's protocol. D15–D19 replace it with the agent's own terminal and configurable agent
> profiles. **Superseded:** D1 (runner interface), D2 (stream-JSON process), D3, D6 (allow-list and isolated settings),
> D7's command templates (now per agent), D8 (queueing, idle shutdown, in-band stop), D9's transcript storage, D10's
> event stream, D12 and D13. **Still valid:** D4's idea of removing API-key variables (now a profile field), D5's
> "one worktree per session" (now created by the dashboard, D17), D11 (same-origin guard), D14 (one switch).
> Observations O1–O8 remain true of the CLI but no longer shape the design.

### D15 — A session is the agent's own terminal
The server starts the agent attached to a pseudo-terminal (`Bun.spawn` with `terminal`, verified inside the compiled binary) in the session's worktree and relays bytes: output to every attached viewer, keystrokes and resizes back. The panel renders it with xterm.js, bundled and inlined like the rest of the UI (no network at runtime; the bundle grows from ~160 KB to ~500 KB). The dashboard does not parse, filter or summarise anything. Consequences that are the point: the user sees exactly the program they know; the agent's own questions — permission prompts, the folder-trust question Claude Code asks once per new directory, `/opsx:*` choices — work because a human answers them; slash commands, models and logins are the agent's business. A bounded scrollback (1 MiB) is kept per session so a viewer that attaches later, a second tab, or a reload first gets what was shown; its tail is stored when the session ends. *Alternative kept in mind*: a friendlier transcript (collapse tool calls, render Markdown) — cheaper, but still a worse copy of an interface that already exists, and still one vendor.

### D16 — Agents are profiles
`agentSessions.agents[]`: `id`, `name`, `command` (argument list; `{prompt}` is the only placeholder and is substituted as one whole argument), `prompts` per starter (`{change}` only), optional `resumeCommand` and `unsetEnv`; `defaultAgent`, and an optional `agentId` per repository. Claude Code ships as the preset (`claude {prompt}`, the `/opsx:*` prompts, `claude --continue`, API-key variables removed so its own login is used). Any other CLI is a profile the user adds; slash commands are agent-specific, so a plain-language prompt pointing at `openspec instructions …` is the portable default offered for new profiles. A command without `{prompt}` gets the prompt typed into its terminal after a short delay. A starter is offered only if the repository's agent has a prompt for it, and disabled when `Bun.which(command[0])` finds nothing. No shell is ever involved. Commands, resume commands and prompts containing a known permission-bypass flag are still rejected: the dashboard does not help switching an agent's checks off.

### D17 — The dashboard creates the worktree, outside the repository
`--worktree` was Claude-specific, so the dashboard now runs `git worktree add` itself — the second enumerated write next to worktree removal. The worktree lives at `~/.openspec-dashboard/worktrees/<repoId>/<name>`, not inside the repository: the repository's working tree never shows an untracked directory and nothing needs a `.gitignore` entry; only git's own worktree metadata and the branch are written in the repository. Existing worktree → reused; existing branch → checked out; otherwise `-b <branch>` from `origin/HEAD` as known locally, else `HEAD`. **No `git fetch`**: the dashboard does not talk to the network, and remotes behind a hardware key would block the request — the base is as fresh as the user's last fetch, and the agent can be asked to rebase. A change directory that exists only uncommitted in the main checkout is copied into the worktree (a write under the dashboard home). Removal keeps its read-only safety checks and the confirmation.

### D18 — The terminal WebSocket has its own guard
Whoever holds this socket types into an agent on this machine, so it is the most sensitive endpoint in the project. The JSON-content-type guard (D11) cannot protect it: a WebSocket handshake is a `GET`, allowed cross-origin, with no preflight. `webSocketRefusal` therefore requires a loopback `Host` (DNS rebinding) and an `Origin` that is the dashboard's own — browsers always send `Origin` on a handshake and pages cannot forge it; a missing `Origin` is refused, so non-browser clients must state one deliberately. Loopback-only binding (invariant 2) stays a precondition. Wire format: binary frames = terminal bytes, text frames = small JSON control messages.

### D19 — Status is what a terminal can honestly tell
`running`, `exited` (with code) and `failed` (could not start). "Waiting for you", cost and usage are not knowable from a byte stream and are no longer claimed; instead the server stamps `lastOutputAt` and the UI shows `quiet <n>m` after a minute of silence, which in practice is the same hint. Dropped with the transcript: the running-session cap and queue (interactive terminals are not batch jobs), idle shutdown, and sessions surviving a dashboard restart — a terminal cannot outlive its owner, so shutdown ends agents and **Resume** (the profile's resume command, in the same worktree) is the way back into the conversation.

### D1 — A `Runner` interface with one implementation: the `claude` CLI
`src/server/sessions/runner.ts` defines `Runner { available(): Promise<Availability>; start(opts): RunnerProcess }` and `RunnerProcess { events: AsyncIterable<RunnerEvent>; send(text): void; interrupt(): void; kill(): void; exited: Promise<ExitInfo> }`. `claudeRunner.ts` is the only implementation. The binary is resolved from config `agentSessions.claudePath` (default `claude` on `PATH`); tests point it at a fake executable. *Why an interface*: tests, and later runners, without touching the session manager. *Not the Agent SDK*: needs an API key (see Context).

### D2 — One long-lived process per session, fed over streamed JSON
Spawn (argument array, no shell), `cwd` = repository path:
```
claude -p --verbose --output-format stream-json --input-format stream-json --replay-user-messages
       --session-id <uuid> --worktree <change-name> --setting-sources project
       --permission-mode dontAsk --allowedTools=<comma-separated list>
       --add-dir <repo>/openspec/changes/<change-name> --append-system-prompt <worktree rules>
```
User turns are written to stdin as one JSON line each (`{"type":"user","message":{"role":"user","content":[{"type":"text","text":…}]}}`). A `result` event ends a turn → state `waiting`. *Alternative*: one `claude -p --resume <id> "<message>"` invocation per message — simpler supervision but pays start-up cost per turn and cannot interrupt mid-turn cleanly; the spike confirmed streaming input (O2), so this stays only as a fallback behind the `RunnerProcess` interface. Restarting a stopped process uses `--resume <uuid>` with `cwd` set to the session's worktree instead of `--session-id`/`--worktree` (O5).
Idle processes are not kept forever: a `waiting` session's process is stopped after `idleMinutes` (default 30) and transparently restarted with `--resume <uuid>` on the next message or on reopen after a dashboard restart.

### D3 — The dashboard chooses the CLI session id
A UUID generated at open time is passed as `--session-id`, stored in the session record and shown as `claude --resume <uuid>` ("Copy resume command", run from the worktree directory). No parsing is needed to learn it, and it survives crashes.

### D4 — Credentials: inherit the login, strip API keys
The child inherits the user's environment **minus** `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN`, so the CLI uses its stored subscription login (O1; the dashboard checks `apiKeySource` in `system/init` and warns if it is not `none` while `passApiKeyEnv` is off). Config `agentSessions.passApiKeyEnv: true` keeps them for users who want API billing. The dashboard never reads the CLI's credential store, never logs environment values, and offers no login flow; "not logged in" is reported from the CLI's own error (O6) with the hint to run `claude` once in a terminal.

### D5 — Worktree per session, created by the CLI
`--worktree <change-name>` makes the CLI create `.claude/worktrees/<change-name>`; the dashboard itself runs no git write for this. The CLI names the branch `worktree-<change-name>` (O5) — the dashboard's branch matching still finds it because the name contains the change name — and the appended system prompt tells the agent to rename it to `feat/<change-name>` (`git branch -m`) before its first commit, following `CONTRIBUTING.md`. The appended system prompt states: the worktree path and branch the agent owns; never edit, stage, commit or switch branches in the main checkout; if `openspec/changes/<change-name>/` is missing in the worktree, copy it from the main checkout (readable through `--add-dir`) and commit it first. If a worktree of that name already exists (earlier session for the same change), it is reused. The session record stores the worktree path (from the CLI's init event, falling back to the conventional path).
**Clean-up** is the one git write the dashboard performs, and only on explicit confirmation when closing: after read-only checks (`git status --porcelain` empty in the worktree, no commits ahead of its upstream or no upstream with zero commits ahead of the base) it runs `git worktree unlock <path>` (the CLI leaves its worktrees locked, O5) followed by `git worktree remove <path>` without `--force`. Otherwise the worktree is kept and the panel says why.

### D6 — Permissions: isolated settings + `dontAsk` + allow-list, no escape hatch
Sessions start with `--setting-sources project`: the user's global Claude settings — in particular their accumulated `permissions.allow` rules — are **not** inherited (O3). Without this the allow-list below would be decorative. The repository's own `.claude/settings.json` still applies, which is the repository owner's decision.
Default allow-list: `Read`, `Glob`, `Grep`, `Edit`, `Write`, `Bash(openspec *)`, `Bash(git status*)`, `Bash(git diff*)`, `Bash(git log*)`, `Bash(git add *)`, `Bash(git commit *)`, `Bash(git branch -m *)`. All entries are passed as one `--allowedTools=<a,b,…>` value (O8). Per repository the user can add entries (e.g. `Bash(bun run check*)`). Config validation rejects entries containing `bypassPermissions`/`dangerously`, and there is no free-form "extra arguments" setting, so the bypass flags cannot be reached from the UI. Denied calls appear in the transcript and in the turn's `permission_denials` (O3); the CLI's built-in read-only commands run regardless and are documented as such; the user answers in the session or widens the allow-list (takes effect on the next process start).

### D7 — Session starters are command templates over a validated name
Config `agentSessions.commands` defaults: `draft: "/opsx:ff {change}"`, `implement: "/opsx:apply {change}"`, `archive: "/opsx:archive {change}"`. `{change}` is the only placeholder and is replaced with a name that passed `CHANGE_NAME`. `draft` is offered while any artifact is not done; `implement` in `Ready`/`Implementing`; `archive` in `Done`. An archive session gets its own worktree (`archive-<change>`) and branch (`chore/archive-<change>`): the implementation worktree of the same change may still exist on an old base, and the archive is a separate pull request by this project's conventions. The archive command asks questions (incomplete tasks, whether to sync delta specs); in a session those simply arrive as the agent's turn ending, and the user answers in the panel. Follow-ups are free text but only ever travel as JSON message content on stdin — never argv, never a shell.

### D8 — Session manager and state machine
`queued → running ⇄ waiting → closed | failed | cancelled | interrupted`. One *open* session per (repo, change); a global cap on `running` sessions (default 2) — excess opens and follow-ups queue FIFO. `stop` sends an in-band interrupt control request, which ends the turn and keeps the process (O7) (→ `waiting`); if no `result` arrives within a few seconds it falls back to SIGINT, which ends the process, and the next message resumes the conversation; `close` ends the process gracefully (→ `closed`); `cancel` kills (→ `cancelled`). Non-zero exit without close → `failed` with the classified reason (`auth`, `usage-limit`, `cli-missing`, `crashed`). Dashboard shutdown stops children and marks `running`/`queued` sessions `interrupted`; they can be reopened (D2 resume).

### D9 — Storage under `~/.openspec-dashboard/sessions/<id>/`
`meta.json` (id, repoId, change, action, cliSessionId, worktree path, branch, state, timestamps, last error, per-turn cost/usage totals) written atomically; `events.ndjson` append-only normalised events with a monotonically increasing `seq`. Retention: newest 50 closed sessions; a transcript is capped at 20 MB (oldest tool-result bodies are elided first). Nothing is written to repositories; the source of truth for *what changed* stays the repository.

### D10 — API
`POST /api/sessions` `{repoId, change, action}` · `GET /api/sessions` · `GET /api/sessions/:id` · `GET /api/sessions/:id/events?after=<seq>` as Server-Sent Events (honours `Last-Event-ID`) · `POST /api/sessions/:id/messages` `{text}` · `POST …/stop` · `POST …/close` `{removeWorktree?: boolean}` · `POST …/cancel`. `/api/state` is unchanged; the UI joins sessions to cards by `(repoId, change)`. Refusals: feature disabled, repo excluded / not tracked / last scan failed, invalid or unknown change, open session exists (returns it), CLI unavailable.

### D11 — Cross-site request protection: reuse the existing guard
Any local web page can reach `127.0.0.1`, and session routes lead to code execution, so they must not be callable cross-site. By the time this change was implemented, `shared-openspec-config` had already landed `crossSiteRefusal` in `src/server/api.ts` for every non-GET `/api/` request (JSON content type — which forces a CORS preflight that is never approved —, a loopback `Host` against DNS rebinding, no cross-site `Sec-Fetch-Site`, and an `Origin` that is the dashboard's own). Session routes sit behind that same check; this change adds no second mechanism and no custom header. The requirement itself is specified by `shared-openspec-config`; this change only adds a scenario that session routes are covered. Reads, including the event stream, stay plain `GET`s and never have side effects.

### D12 — UI
Card: session starter button(s) when allowed, and a badge `working` / `waiting for you` / `failed`. Session panel (drawer, deep-linkable `?session=<id>`): header with change, worktree path, branch, state and cost; transcript (user and assistant text, collapsible tool calls/results, denied calls highlighted); input box (Enter sends, disabled while `queued`); Stop, Close (with the remove-worktree confirmation), Copy resume command, Copy cd (worktree). Transcript text is rendered escaped; if `add-change-detail-view`'s sanitising Markdown renderer exists it is reused for assistant text.

### D13 — Testing without the real agent
`test/fixtures/fake-claude.ts` is a small executable that speaks the same stream-JSON protocol and is scripted through environment variables (echo turns, emit a denied tool call, exit with auth error, hang until interrupted). All automated tests use it; the spike's observations are turned into fixtures so the fake stays faithful. No test touches the network or the user's login.

### D14 — One switch; repositories are included by default (revised after first use)
The first version required two opt-ins: the global switch *and* one per repository. In use that was friction without much protection: with the switch on and nothing opted in, the board looked unchanged and the feature seemed missing, and someone who deliberately enables agent sessions wants them on the repositories they track. Now `agentSessions.enabled` is the one deliberate step; a repository is included unless its `agent.enabled` is `false` (absent means included, so existing configs need no migration). What still bounds a session is unchanged: off by default, tracked repositories only, a worktree per session, the allow-list, `dontAsk`, isolated settings, same-origin mutating routes. The trade-off is that turning the switch on now exposes every tracked repository at once, including work repositories — Settings says so next to the switch.

## Risks / Trade-offs

- [Revision] A browser tab now carries a terminal on this machine → D18's origin check, loopback binding, feature off by default, and the agent's own permission prompts are what stand between a web page and code execution; Settings says so.
- [Revision] Terminal status is coarse (D19) → stated in the UI rather than faked.
- [CLI behaviour changes between versions] → observations O1–O8 are pinned as fixtures and exercised by the fake runner; the `Runner` interface localises changes; the detected CLI version is shown in Settings. The usage-limit classification (O6) is still an assumption.
- [A browser click leads to code edits and command execution] → explicit global switch with per-repository exclusion (D14), loopback + D11, allow-list with `dontAsk`, no bypass reachable, worktree isolation, visible transcript, Stop/Cancel.
- [Runaway usage of the subscription] → running-session cap, idle shutdown, per-session cost/usage shown, usage-limit errors surfaced distinctly.
- [Zombie processes] → children are tracked, stopped on shutdown and on `cancel`; on start-up any `running` record without a live process becomes `interrupted`.
- [Worktrees pile up] → close offers removal when safe; Settings lists worktrees created by sessions with their state.
- [Three active changes rewrite "The dashboard never writes to tracked repositories": this one, `shared-openspec-config` and `dedupe-discovery`] → everything else here is ADDED to avoid conflicts; for that one block, whichever change is archived later must merge the wording so the final requirement enumerates every exception (managed `openspec/config.yaml` sections; session worktree removal; the read-only git allow-list including `rev-list` and `config --get`).
- [Transcripts may contain secrets the agent read] → stored only under the user's home with user-only permissions (`0600`), never sent anywhere, deletable per session.

## Migration Plan

Feature ships disabled: existing configs load with `agentSessions.enabled: false` and no repository excluded. Rollback = disable the switch; session records can be deleted from `~/.openspec-dashboard/sessions/`. The invariant wording in `CLAUDE.md`/README changes in the same pull request as the code.

## Open Questions

- Should a session be allowed to push and open a pull request when the user asks for it in the conversation? v1: not in the default allow-list; the user can add `Bash(git push*)`/`Bash(gh pr create*)` per repository.
- Model choice per session (`--model`)? v1 uses the CLI's default; a per-repository setting is cheap to add later.
