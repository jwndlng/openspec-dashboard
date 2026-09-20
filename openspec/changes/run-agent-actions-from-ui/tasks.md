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

- [x] 3.1 If `create-change-from-dashboard` has already landed a guard for mutating routes, reuse it; otherwise implement one guard in `src/server/api.ts` (JSON content type, `X-OpenSpec-Dashboard: 1`, matching `Origin`/`Host`) applied to every non-GET/HEAD route
- [x] 3.2 Send the header from every mutating call in `src/ui/api.ts`
- [x] 3.3 Tests: foreign `Origin`, missing header and wrong content type are `403` for `PUT /api/config`, `POST /api/scan`, `POST /api/discover` and the new routes; the UI's own requests pass

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
