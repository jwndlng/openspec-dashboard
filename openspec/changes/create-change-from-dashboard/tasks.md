# Tasks

## 1. Server: create-change module

- [x] 1.1 Add `src/server/createChange.ts` exporting `createChange(repoPath, name, prompt?)` that validates the name with `CHANGE_NAME` from `src/server/source.ts`, reads the repo's schema from `openspec/config.yaml` (fallback `spec-driven`), rejects when `openspec/changes/` is missing or when an active `openspec/changes/<name>` or archived `openspec/changes/archive/<YYYY-MM-DD>-<name>` exists, then `mkdir` (recursive: false) the new directory and writes `.openspec.yaml` (`schema:` + `created:` in `YYYY-MM-DD`) and, when a non-whitespace prompt is passed, `prompt.md` (`# Prompt\n\n<text>\n`). On a failed post-mkdir write, best-effort remove the directory. Return the discriminated result. Verify with a unit test that exercises every branch on a temp dir.
- [x] 1.2 Add a unit test asserting concurrent `createChange` calls for the same name produce exactly one success and one duplicate-name failure (fire ~10 in parallel on a temp dir). Verify the losing calls did not create any file.
- [x] 1.3 Add a unit test asserting `createChange` never spawns a subprocess: assert with a spy or by asserting the current implementation contains no `spawn`/`Bun.spawn`/`exec` import path (a static check is enough; the point is to lock the "no process" invariant).

## 2. Server: HTTP endpoint

- [x] 2.1 In `src/server/api.ts`, add a route matcher for `POST /api/repos/<id>/changes`, decode the id, read `{ name, prompt? }` via `readJson`, look up the repo in the config (404 for unknown, 409 for disabled), check the repo's snapshot `ok` (409 for failed scan), then call `createChange(repo.path, name, prompt)`. Map the result to `201 { name }`, `400` (invalid body/name), or `409` (duplicate, no openspec/, disabled). Verify with an endpoint test hitting every status.
- [x] 2.2 After a successful `createChange`, trigger a rescan of the repository (using the same code path that `POST /api/scan` uses, scoped to the one repo, or a full scan if a per-repo trigger doesn't exist) so a subsequent `GET /api/state` reflects the new change. Verify with an endpoint test that follows the `201` with a `GET /api/state` and finds the change.
- [x] 2.3 Add an endpoint test asserting that a `POST /api/repos/<id>/changes` from a foreign origin returns `403` and no directory is created. Same test also covers a non-JSON content type.
- [x] 2.4 Add an endpoint test asserting that every refused status (400 invalid name, 404 unknown repo, 409 disabled, 409 no openspec/, 409 duplicate active, 409 duplicate archived) leaves the repository byte-for-byte unchanged — snapshot the directory tree before and after.

## 3. Scanner: prompt.md field

- [x] 3.1 Extend `ChangeSnapshot` in `src/shared/types.ts` with an optional `prompt?: string`. Update anywhere the type is destructured/serialised.
- [x] 3.2 In `src/server/scanner.ts`, read `prompt.md` for each change directory (bounded to 8 KiB — on excess, truncate and add a warning). Missing file → field absent. Read error → field absent + per-change warning. Verify with a scanner unit test using fixtures that cover: no `prompt.md`, small `prompt.md`, oversized `prompt.md`, unreadable `prompt.md`.
- [x] 3.3 Add a scanner test asserting that a change with only `.openspec.yaml` and `prompt.md` is still reported with `proposal` not done — `prompt.md` does not shift artifact status. Verify by asserting the change is in `New` in the derived column.

## 4. UI: New change action + form

- [x] 4.1 In `src/ui/kanban.tsx`, add a "New change" action to the repository board header, shown only when the repo is enabled, `ok: true`, and has an `openspec/` directory (the last of these can be inferred from the snapshot: if the repo scans, its `openspec/` exists). Verify manually in `bun run dev`, and add a UI test if the existing test suite has UI coverage — otherwise, cover via the API tests above.
- [x] 4.2 Add the form (inline or a small dialog): name input with live validation against `CHANGE_NAME` and a prompt textarea; the submit button disabled while invalid or empty. On submit, `POST /api/repos/<id>/changes` via `src/ui/api.ts`; on `201`, close the form and refetch state; on error, render the server's message next to the form. Verify manually and by mocking the endpoint in a UI unit test.
- [x] 4.3 In `src/ui/api.ts`, add `createChange(repoId, name, prompt?)` that posts JSON with the right content-type and returns the parsed body (or throws with the error message on non-201). Verify by exercising it from the form test.

## 5. UI: prompt badge + start command

- [x] 5.1 In `src/ui/kanban.tsx` cards, render a `prompt` badge (text plus colour) when `change.prompt` is set. Tooltip and accessible name carry the prompt text. Verify by adding a UI test with a card that has a prompt and one without.
- [x] 5.2 In `src/ui/format.ts`, generalise the current copy-command builder so it accepts the change's column and produces either an apply command (columns `Ready`, `Implementing`, `Done`, `Synced`, `Archived`) or a start command (`/opsx:continue`), appending ` — see openspec/changes/<name>/prompt.md` when the change has a prompt. Verify with unit tests that assert each column mapping and the extension with/without a prompt.
- [x] 5.3 Swap the card's copy-action label between "Copy apply command" and "Copy start command" to match what the button copies. Verify manually and via the format unit tests via the label mapping.

## 6. Invariant text + docs

- [x] 6.1 Update `CLAUDE.md` invariant 1: reword "Read-only towards tracked repositories" to include the create-change directory as an enumerated exception, in one clause consistent with the existing three. Verify by reading the diff against `openspec/specs/dashboard-api/spec.md` MODIFIED delta to make sure both list the same enumerated exceptions.
- [x] 6.2 Update the "never writes to a tracked repository" statement in `README.md` to the narrower guarantee (the dashboard writes only to create a new change directory). Verify by grepping `README.md` for old wording and asserting it is gone.

## 7. End-to-end + no-side-effects

- [x] 7.1 Extend the existing no-side-effects test (which asserts a full scan writes nothing to any tracked repository) so it also asserts that no code path except an explicit `POST /api/repos/<id>/changes` writes into a repository — e.g. after config PUT, discover, scan, shared-config preview/apply, pull, session opening, and a refused create-change, the repository trees are byte-for-byte unchanged.
- [x] 7.2 Add a happy-path test that: creates a repo fixture, calls `POST /api/repos/<id>/changes` with `{ name: "add-audit-trail", prompt: "Log every mutation" }`, asserts `201`, asserts the directory contains `.openspec.yaml` and `prompt.md`, and asserts a following `GET /api/state` shows the change in `New` with a `prompt` field. Runs both under `bun run` and against the compiled binary (or, at minimum, a marker-format test that reads `.openspec.yaml` back through the OpenSpec adapter to confirm the change is recognised).
- [x] 7.3 Run `bun run check` and confirm lint, typecheck and every test suite (including the new endpoint, scanner, format, and no-side-effects tests) pass.
