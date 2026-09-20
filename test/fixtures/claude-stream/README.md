# Recorded `claude` stream-JSON fixtures

Event streams observed from the real `claude` CLI (2.1.x, print mode, `--output-format stream-json`) during the
`run-agent-actions-from-ui` spike, then **reduced and sanitised**: only the fields the dashboard reads are kept;
session ids, tool-use ids, working directories and rate-limit numbers are replaced with fixed placeholder values;
thinking blocks and token-progress events are dropped. Prompts were trivial ("reply with one word"). Nothing here
comes from a real project.

- `two-turns-then-interrupt.ndjson` — streamed input: two successful turns in one process, then a third turn ended early.
- `denied-tool.ndjson` — `--permission-mode dontAsk` with a tool outside the allow-list: the denial as tool result and in `result.permission_denials`.
- `slash-command.ndjson` — a project slash command sent as message text.
- `auth-failure.json` — the final result object when the CLI is not logged in (process exit code 1).

The fake runner used by tests replays these shapes; update them together with `src/server/sessions/` when the CLI's format changes.
