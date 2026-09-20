## 1. Spike: observe the real CLI before building (uses a little subscription quota)

- [x] 1.1 In a scratch git repository outside this project, with `ANTHROPIC_API_KEY` unset, run one short `claude -p --verbose --output-format stream-json` turn; confirm it runs on the subscription login and record the event types and the shape of `system/init`, assistant, tool and `result` events (assumptions A1, A2)
- [x] 1.2 Run with `--input-format stream-json --replay-user-messages`: send two user messages on stdin, confirm the process stays alive between turns, each turn ends with `result`, and record the exact input line format (A2); try SIGINT mid-turn and record what is emitted and whether the process survives
- [x] 1.3 Run with `--permission-mode dontAsk --allowedTools Read` and ask for a Bash command; record how the denial appears in the stream and that nothing prompts or hangs (A3)
- [x] 1.4 Send a project slash command as message text in a repository that has one; confirm it executes (A4)
- [x] 1.5 Run with `--worktree spike-a --session-id <uuid>`; record where the worktree is created, the branch name, what `cwd` the init event reports, whether an existing worktree of that name is reused, and how `--resume <uuid>` must be invoked (from which directory, with or without `--worktree`) to continue there (A5)
- [x] 1.6 Provoke and record an authentication failure (temporary empty config dir) and look up how a usage-limit error is reported (A6)
- [x] 1.7 Write the observations into `design.md` (replace the "assumed" list with facts; switch D2 to the per-message fallback if streaming input does not hold) and save trimmed real event lines as fixtures for the fake runner; remove the scratch repository and its worktrees

> Spike done 2026-09-20: streaming input, slash commands, worktrees and resume behave as assumed; three corrections went
> into design.md — user-level settings must be excluded (`--setting-sources project`) or the allow-list bounds nothing,
> Stop is an in-band interrupt (SIGINT ends the process), and CLI worktrees are locked and on a `worktree-<name>` branch.

## 2. Configuration and types

- [x] 2.1 Add `AgentSessionsConfig`, per-repository `agent` settings, `Session`, `SessionState`, `SessionEvent` and failure-reason types to `src/shared/types.ts`
- [x] 2.2 Extend the zod schema in `src/server/config.ts` with defaults (`enabled: false`, `maxRunning: 2`, `idleMinutes: 30`, `claudePath: "claude"`, `passApiKeyEnv: false`, command templates), optional-on-input so older configs load
- [x] 2.3 Validation: `maxRunning >= 1`; templates may only contain `{change}`; reject allowed-tools entries or templates matching a permission-bypass mode/flag
- [x] 2.4 Tests: old config loads with defaults; invalid template, `maxRunning: 0` and bypass entries are rejected with the offending path

## 3. Cross-site request protection

- [x] 3.1 Reuse the guard for mutating routes: `shared-openspec-config` landed `crossSiteRefusal` in `src/server/api.ts` first, so session routes go behind it and no second mechanism or custom header is added
- [x] 3.2 Session calls in `src/ui/api.ts` go through the shared `call()` helper (JSON content type), in the typed `Api` interface with a demo implementation that rejects them
- [x] 3.3 Tests: foreign `Origin`, cross-site `Sec-Fetch-Site` and a non-JSON content type are `403` for the session routes and the existing mutating routes; the UI's own requests pass

## 4. Runner

- [x] 4.1 Define `Runner`/`RunnerProcess`/`RunnerEvent` in `src/server/sessions/runner.ts` per design D1
- [x] 4.2 Implement `fake-claude` test executable (`test/fixtures/fake-claude.ts`) speaking the observed protocol, scripted via environment variables: echo turns, denied tool call, auth failure exit, usage-limit error, hang until interrupted, crash
- [x] 4.3 Implement `claudeRunner.ts`: resolve binary, `available()` via `--version`, build the argument array (D2, D5, D6: `--setting-sources project`, variadic flags as single `--flag=value`) without a shell, strip `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` unless `passApiKeyEnv`, parse newline-delimited JSON into normalised events, write user messages to stdin, in-band interrupt control request with SIGINT fallback, kill with timeout escalation; warn when `apiKeySource` is not `none`
- [x] 4.4 Build the appended system prompt with the worktree rules (owned worktree/branch, never touch the main checkout, copy-and-commit the change directory when missing) and `--add-dir` for the change directory
- [x] 4.5 Tests with the fake: argument array contains no bypass flag and no shell is involved; environment stripping; event normalisation from the recorded fixtures; message with shell metacharacters arrives verbatim; interrupt and kill

## 5. Session manager and storage

- [x] 5.1 Implement `src/server/sessions/store.ts`: `~/.openspec-dashboard/sessions/<id>/meta.json` (atomic, `0600`) and append-only `events.ndjson` with monotonically increasing `seq`; retention of the newest 50 ended sessions; transcript size cap eliding oldest tool-result bodies
- [x] 5.2 Implement `src/server/sessions/manager.ts`: state machine (D8), one open session per repository+change, FIFO queue against `maxRunning`, queued follow-ups, stop/close/cancel, failure classification, idle shutdown after `idleMinutes`, lazy restart with `--resume`
- [x] 5.3 Start-up reconciliation (`running` without process → `interrupted`) and shutdown handling in `src/server/index.ts` (stop children, mark `interrupted`)
- [x] 5.4 Starter availability from the snapshot (draft while an artifact is not done; implement in `Ready`/`Implementing`; never archived) and command templating over the validated change name
- [x] 5.5 Safe worktree removal: read-only checks (`git status --porcelain` in the worktree, nothing ahead of upstream/base via `rev-list`) and, only when clean and confirmed, `git worktree unlock` then `git worktree remove` without `--force`
- [x] 5.6 Tests with the fake: full lifecycle, multi-turn follow-up keeps one CLI session id, running limit and queue order, duplicate open returns the existing session, stop keeps the conversation, cancel, crash → `failed/crashed`, auth and usage-limit reasons, idle stop then resume, reopen after simulated restart, retention, removal refused with dirty or unpushed worktree (temp git repositories)

## 6. API

- [x] 6.1 Add the session routes to `src/server/api.ts` (open, list, get, events as Server-Sent Events honouring `Last-Event-ID` and `after`, messages, stop, close with `removeWorktree`, cancel, delete) with the refusal status codes from the `dashboard-api` spec
- [x] 6.2 Tests: every refusal case (feature off, repo not opted in, repo disabled or failed scan, unknown repo/change, invalid name, unavailable action, CLI unavailable, message to ended session); stream order and reconnect without loss; `GET /api/state` unchanged; no process starts while the feature is disabled

## 7. UI

- [x] 7.1 `src/ui/api.ts`: session calls and an `EventSource` wrapper with reconnect using the last `seq`
- [x] 7.2 Card starters and session badge (`working` / `waiting for you` / `failed` with reason) in `src/ui/kanban.tsx`, joined to cards by repository id and change name; unchanged cards when the feature is off or the repository not opted in
- [x] 7.3 Session panel (drawer, `?session=<id>` deep link): header with worktree path, branch, state and cost; transcript with escaped text, collapsible tool calls/results and highlighted denials; input box (Enter sends; disabled when no message can be accepted); Stop, Close with the remove-worktree confirmation, Cancel, Copy resume command, Copy cd (worktree)
- [x] 7.4 Settings section: global switch (blocked while the CLI is missing), CLI availability and version, `maxRunning`, idle limit, command templates, per-repository opt-in and additional allowed tools beside the default list, plain-language risk statement, list of session worktrees
- [x] 7.5 Styles for both themes using existing tokens; status conveyed by text plus colour

## 8. Invariants and documentation

- [x] 8.1 Reword `CLAUDE.md` invariant 1 and the README's "never writes to a tracked repository" statement to the new boundary (dashboard code does not write except confirmed safe worktree removal; it may start the user's agent in a dedicated worktree on request, off by default)
- [x] 8.2 README: how to enable agent sessions, what the default allow-list permits, that the CLI's own login is used and no credentials are handled, how to resume a session in a terminal
- [x] 8.3 `CONTRIBUTING.md`: tests must use the fake runner; never invoke the real CLI or the network from tests

## 9. Verification

- [x] 9.1 `bun run check` and `bun run build` pass; the compiled binary starts a session against the fake runner (process spawning and Server-Sent Events work inside the single binary)
- [x] 9.2 Manual run with the real CLI on a scratch repository: open **Implement**, watch the transcript, send a follow-up, Stop, send another message, copy the resume command and continue in a terminal, close with worktree removal; confirm the main checkout's `git status` and branch never changed
- [x] 9.3 Confirm with agent sessions disabled that no route can start a process and that a scan still leaves repositories byte-identical
- [x] 9.4 Confirm a request from another origin cannot open a session (browser test page on a different port)

> Verified 2026-09-20 with the compiled binary. Fake runner: feature off → 403 and no process; foreign Origin, missing
> header and form content type → 403; a two-turn session streamed in order over one event stream; child environment
> without API key, `dontAsk`, isolated settings; records `0600`; no stray processes after shutdown. Real CLI on a scratch
> repository: Implement created and committed the file in its own worktree on `feat/<change>`, follow-up and in-band
> Stop worked, `claude --resume` from a terminal continued the same conversation, the main checkout's branch, status and
> HEAD never changed, and worktree removal was refused because of unpushed commits. 9.4 used forged `Origin` headers, not
> a real browser page. Four small turns cost about $0.54 on the CLI's default model — a per-repository model setting
> (design Open Questions) is worth doing soon.

## 10. Follow-up from first use: default-on repositories and an Archive starter

- [x] 10.1 Repositories are included by default: `repoAgentEnabled()` in `src/shared/types.ts` (tracked and `agent.enabled !== false`), used by the session manager, the card controls and Settings; refusal message and status for an excluded repository unchanged (`403`)
- [x] 10.2 Settings: the per-repository toggle defaults to on, the risk text says the switch covers every tracked repository, and the additional-allowed-tools editor folds away so a long repository list stays readable
- [x] 10.3 `archive` session action: `SessionAction`, `availableActions()` (stage `done`), `commands.archive` with default `/opsx:archive {change}` (older configs load with the default), label and hint on the card
- [x] 10.4 Archive sessions use worktree `archive-<change>` and branch `chore/archive-<change>`; default allow-list gains `git mv`/`mv`/`mkdir -p` confined to `openspec/`
- [x] 10.5 Tests: default-included repository, excluded repository refused, archive only for `Done`, archive template/worktree/branch/allow-list, older config gets the archive default; specs, design (D14) and docs updated

## 11. Revision: the agent's own terminal, and agents as profiles

- [x] 11.1 Spike: `Bun.spawn` with a pseudo-terminal (write, resize, data callback) and the real interactive `claude` inside it; noted that it asks its folder-trust question once per new worktree, to be answered in the terminal
- [x] 11.2 Shared model: `AgentProfile`, `agentSessions.{agents, defaultAgent}`, per-repository `agentId`; `Session` becomes `running | exited | failed` with `worktreePath`, `branch`, `lastOutputAt`, `resumable`; zod schema with placeholder and bypass validation; configs of the transcript-based version load (unknown keys dropped)
- [x] 11.3 Remove the stream-JSON runner, parser, fake CLI, recorded fixtures, allow-list, queue/idle logic and their tests
- [x] 11.4 `agents.ts` (profile per repository, availability via `Bun.which`, opening prompt, argument-list launch with typed-prompt fallback, environment), `terminal.ts` (pseudo-terminal process with hang-up then forced kill)
- [x] 11.5 Worktrees created by the dashboard under `~/.openspec-dashboard/worktrees/`: reuse, existing branch, new branch from `origin/HEAD` else `HEAD`, no fetch; uncommitted change directory copied in; removal checks unchanged
- [x] 11.6 Session manager: open/resume/close/remove, one running session per change, bounded scrollback with replay for late viewers, output tail stored at the end, `lastOutputAt`, shutdown and restart reconciliation
- [x] 11.7 API: session routes, and the terminal WebSocket with its own same-origin guard (`webSocketRefusal`) and wire format; event stream removed
- [x] 11.8 UI: xterm.js panel (theme tokens, fit to panel, reattach), card badges `running` / `quiet Nm` / ended / failed, starters limited to the agent's prompts, Settings with agent profiles and per-repository agent; terminal stylesheet inlined by the build; demo API updated
- [x] 11.9 Tests with a fake interactive agent in real pseudo-terminals and temp git repositories: profiles and validation, launch arguments, worktree create/reuse/copy/remove, session lifecycle, typed prompt, resume, refusals create nothing, crash/shutdown/restart, socket guard, scrollback replay, input/resize round-trip, exit frame, ended-session output
- [x] 11.10 Verified in the compiled binary: pseudo-terminal and WebSocket work in the single executable with the fake agent and with the real `claude`; foreign origin refused; main checkout's branch and status unchanged; worktree removed when clean; no stray processes
- [x] 11.11 Specs (all four deltas), design D15–D19, README, `CLAUDE.md` and `CONTRIBUTING.md` updated
