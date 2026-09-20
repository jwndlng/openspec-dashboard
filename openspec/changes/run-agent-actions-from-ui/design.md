## Context

The dashboard is a single Bun binary serving a Preact UI on `127.0.0.1`. Until now it only reads tracked repositories. This change lets the user open an **interactive agent session** for a change from its card: the server starts the user's locally installed `claude` CLI (Claude Code) on the user's existing login, streams the conversation into the UI, and lets the user keep sending instructions. Each session works in its own git worktree.

Verified locally against `claude` 2.1.x `--help` (no model usage): `-p/--print`, `--output-format stream-json`, `--input-format stream-json` ("realtime streaming input"), `--replay-user-messages`, `--include-partial-messages`, `--verbose`, `--session-id <uuid>`, `-r/--resume`, `--fork-session`, `-w/--worktree [name]`, `--add-dir`, `--append-system-prompt`, `--allowedTools`, `--disallowedTools`, and `--permission-mode` with choices `acceptEdits | auto | bypassPermissions | manual | dontAsk | plan`.

**Assumed from documentation, not yet observed** (task group 1 is a spike that confirms or corrects these before anything else is built):
- A1. In print mode the CLI uses the subscription login when `ANTHROPIC_API_KEY` is absent from the environment.
- A2. With streamed JSON input the process stays alive between turns; each turn ends with a `result` event; user messages are newline-delimited JSON on stdin.
- A3. `--permission-mode dontAsk` plus `--allowedTools` denies everything not allowed *without prompting*, and the denial is visible in the event stream.
- A4. A project slash command (`/opsx:apply <name>`) works as the text of a user message in print mode.
- A5. `--worktree <name>` works together with `-p`, creates `.claude/worktrees/<name>` on a new branch, and a later `--resume <session-id>` can continue the session there.
- A6. Authentication and usage-limit failures are distinguishable in the `result`/error events.

Constraints: no credentials handled by the dashboard; Anthropic's Agent SDK is not used (it requires an API key and third-party tools may not offer claude.ai login); loopback-only server without auth; several changes in flight modify the same spec blocks.

## Goals / Non-Goals

**Goals:**
- Open, conduct, stop, close and reopen a per-change conversation with the agent from the dashboard, on the user's Claude subscription.
- Every session isolated in its own worktree and branch; nothing runs in the main checkout.
- Off by default; explicit double opt-in; bounded tool permissions; never a permission bypass.
- Testable without the real CLI or network.

**Non-Goals:**
- Autonomous pickup/scheduling, other agent CLIs, approving individual tool requests from the UI, sessions not bound to a change, committing/pushing/PR creation by the dashboard, remote execution.

## Decisions

### D1 — A `Runner` interface with one implementation: the `claude` CLI
`src/server/sessions/runner.ts` defines `Runner { available(): Promise<Availability>; start(opts): RunnerProcess }` and `RunnerProcess { events: AsyncIterable<RunnerEvent>; send(text): void; interrupt(): void; kill(): void; exited: Promise<ExitInfo> }`. `claudeRunner.ts` is the only implementation. The binary is resolved from config `agentSessions.claudePath` (default `claude` on `PATH`); tests point it at a fake executable. *Why an interface*: tests, and later runners, without touching the session manager. *Not the Agent SDK*: needs an API key (see Context).

### D2 — One long-lived process per session, fed over streamed JSON
Spawn (argument array, no shell), `cwd` = repository path:
```
claude -p --verbose --output-format stream-json --input-format stream-json --replay-user-messages
       --session-id <uuid> --worktree <change-name> --permission-mode dontAsk
       --allowedTools <list…> --add-dir <repo>/openspec/changes/<change-name>
       --append-system-prompt <worktree rules>
```
User turns are written to stdin as one JSON line each (`{"type":"user","message":{"role":"user","content":[{"type":"text","text":…}]}}`). A `result` event ends a turn → state `waiting`. *Alternative*: one `claude -p --resume <id> "<message>"` invocation per message — simpler supervision but pays start-up cost per turn and cannot interrupt mid-turn cleanly; it is the documented fallback if A2 fails in the spike, and the `RunnerProcess` interface hides the difference.
Idle processes are not kept forever: a `waiting` session's process is stopped after `idleMinutes` (default 30) and transparently restarted with `--resume <uuid>` on the next message or on reopen after a dashboard restart.

### D3 — The dashboard chooses the CLI session id
A UUID generated at open time is passed as `--session-id`, stored in the session record and shown as `claude --resume <uuid>` ("Copy resume command", run from the worktree directory). No parsing is needed to learn it, and it survives crashes.

### D4 — Credentials: inherit the login, strip API keys
The child inherits the user's environment **minus** `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN`, so the CLI falls back to its stored subscription login (A1). Config `agentSessions.passApiKeyEnv: true` keeps them for users who want API billing. The dashboard never reads the CLI's credential store, never logs environment values, and offers no login flow; "not logged in" is reported from the CLI's own error (A6) with the hint to run `claude` once in a terminal.

### D5 — Worktree per session, created by the CLI
`--worktree <change-name>` makes the CLI create `.claude/worktrees/<change-name>` on a branch for that change; the dashboard itself runs no git write for this. The appended system prompt states: the worktree path and branch the agent owns; never edit, stage, commit or switch branches in the main checkout; if `openspec/changes/<change-name>/` is missing in the worktree, copy it from the main checkout (readable through `--add-dir`) and commit it first. If a worktree of that name already exists (earlier session for the same change), it is reused. The session record stores the worktree path (from the CLI's init event, falling back to the conventional path).
**Clean-up** is the one git write the dashboard performs, and only on explicit confirmation when closing: after read-only checks (`git status --porcelain` empty in the worktree, no commits ahead of its upstream or no upstream with zero commits ahead of the base) it runs `git worktree remove <path>` without `--force`. Otherwise the worktree is kept and the panel says why.

### D6 — Permissions: `dontAsk` + allow-list, no escape hatch
Default allow-list: `Read`, `Glob`, `Grep`, `Edit`, `Write`, `Bash(openspec *)`, `Bash(git status*)`, `Bash(git diff*)`, `Bash(git log*)`, `Bash(git add *)`, `Bash(git commit *)`. Per repository the user can add entries (e.g. `Bash(bun run check*)`). The repository's own `.claude/settings.json` still applies. Config validation rejects entries containing `bypassPermissions`/`dangerously`, and there is no free-form "extra arguments" setting, so the bypass flags cannot be reached from the UI. Denied calls appear in the transcript (A3); the user answers in the session or widens the allow-list (takes effect on the next process start).

### D7 — Session starters are command templates over a validated name
Config `agentSessions.commands` defaults: `draft: "/opsx:ff {change}"`, `implement: "/opsx:apply {change}"`. `{change}` is the only placeholder and is replaced with a name that passed `CHANGE_NAME`. `draft` is offered while any artifact is not done; `implement` in `Ready`/`Implementing`. Follow-ups are free text but only ever travel as JSON message content on stdin — never argv, never a shell.

### D8 — Session manager and state machine
`queued → running ⇄ waiting → closed | failed | cancelled | interrupted`. One *open* session per (repo, change); a global cap on `running` sessions (default 2) — excess opens and follow-ups queue FIFO. `stop` sends SIGINT to interrupt the current turn (→ `waiting`); `close` ends the process gracefully (→ `closed`); `cancel` kills (→ `cancelled`). Non-zero exit without close → `failed` with the classified reason (`auth`, `usage-limit`, `cli-missing`, `crashed`). Dashboard shutdown stops children and marks `running`/`queued` sessions `interrupted`; they can be reopened (D2 resume).

### D9 — Storage under `~/.openspec-dashboard/sessions/<id>/`
`meta.json` (id, repoId, change, action, cliSessionId, worktree path, branch, state, timestamps, last error, per-turn cost/usage totals) written atomically; `events.ndjson` append-only normalised events with a monotonically increasing `seq`. Retention: newest 50 closed sessions; a transcript is capped at 20 MB (oldest tool-result bodies are elided first). Nothing is written to repositories; the source of truth for *what changed* stays the repository.

### D10 — API
`POST /api/sessions` `{repoId, change, action}` · `GET /api/sessions` · `GET /api/sessions/:id` · `GET /api/sessions/:id/events?after=<seq>` as Server-Sent Events (honours `Last-Event-ID`) · `POST /api/sessions/:id/messages` `{text}` · `POST …/stop` · `POST …/close` `{removeWorktree?: boolean}` · `POST …/cancel`. `/api/state` is unchanged; the UI joins sessions to cards by `(repoId, change)`. Refusals: feature disabled, repo not opted in / not enabled / last scan failed, invalid or unknown change, open session exists (returns it), CLI unavailable.

### D11 — Cross-site request protection for all mutating routes
Any local web page can reach `127.0.0.1`. Mutating requests (`POST`/`PUT`/`DELETE`) MUST carry `Content-Type: application/json`, a custom header `X-OpenSpec-Dashboard: 1`, and an `Origin`/`Host` that matches the server's own; otherwise `403`. This is the same protection `create-change-from-dashboard` proposes; whichever change lands first implements it in one shared guard in `api.ts`, the other reuses it.

### D12 — UI
Card: session starter button(s) when allowed, and a badge `working` / `waiting for you` / `failed`. Session panel (drawer, deep-linkable `?session=<id>`): header with change, worktree path, branch, state and cost; transcript (user and assistant text, collapsible tool calls/results, denied calls highlighted); input box (Enter sends, disabled while `queued`); Stop, Close (with the remove-worktree confirmation), Copy resume command, Copy cd (worktree). Transcript text is rendered escaped; if `add-change-detail-view`'s sanitising Markdown renderer exists it is reused for assistant text.

### D13 — Testing without the real agent
`test/fixtures/fake-claude.ts` is a small executable that speaks the same stream-JSON protocol and is scripted through environment variables (echo turns, emit a denied tool call, exit with auth error, hang until interrupted). All automated tests use it; the spike's observations are turned into fixtures so the fake stays faithful. No test touches the network or the user's login.

## Risks / Trade-offs

- [Assumptions A1–A6 wrong] → spike first; D2's fallback and the `Runner` interface localise the impact; design.md is updated with the observed behaviour before implementation continues.
- [A browser click leads to code edits and command execution] → double opt-in, loopback + D11, allow-list with `dontAsk`, no bypass reachable, worktree isolation, visible transcript, Stop/Cancel.
- [Runaway usage of the subscription] → running-session cap, idle shutdown, per-session cost/usage shown, usage-limit errors surfaced distinctly.
- [Zombie processes] → children are tracked, stopped on shutdown and on `cancel`; on start-up any `running` record without a live process becomes `interrupted`.
- [Worktrees pile up] → close offers removal when safe; Settings lists worktrees created by sessions with their state.
- [Spec conflicts with `dedupe-discovery` and `create-change-from-dashboard`, which modify the same requirement blocks] → this change only ADDs requirements, except the unavoidable rewrite of "never writes to tracked repositories"; whoever archives second re-applies their one-line edit on top.
- [Transcripts may contain secrets the agent read] → stored only under the user's home with user-only permissions (`0600`), never sent anywhere, deletable per session.

## Migration Plan

Feature ships disabled: existing configs load with `agentSessions.enabled: false` and no per-repository opt-ins. Rollback = disable the switch; session records can be deleted from `~/.openspec-dashboard/sessions/`. The invariant wording in `CLAUDE.md`/README changes in the same pull request as the code.

## Open Questions

- Should a session be allowed to push and open a pull request when the user asks for it in the conversation? v1: not in the default allow-list; the user can add `Bash(git push*)`/`Bash(gh pr create*)` per repository.
- Model choice per session (`--model`)? v1 uses the CLI's default; a per-repository setting is cheap to add later.
