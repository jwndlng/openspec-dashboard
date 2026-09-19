## Why

Ideas for a change usually surface while looking at a project's board, but starting one means switching to a terminal, `cd`-ing into the right repository and running `openspec new change`. By the time an agent session is open, the context of the idea is half gone. Being able to create the change from the repository board — and to jot down what it is about in a `prompt.md` that a model can later turn into the proposal and design — captures the idea where and when it occurs, and the new `New` column gives such a change an obvious place to land.

## What Changes

- **BREAKING** (project invariant): the dashboard stops being strictly read-only towards tracked repositories. It gains exactly one, narrowly bounded write: **creating a new change directory**. Everything else stays read-only — it never modifies, overwrites, moves or deletes anything in a repository, and git stays limited to the read-only subcommands.
- A **"New change"** action in the repository board header opens a small form: a change name (kebab-case, validated live) and an optional free-text prompt describing the change.
- On submit the server creates `openspec/changes/<name>/` in that repository containing:
  - `.openspec.yaml` — the same marker `openspec new change` writes (`schema:` taken from the repository's `openspec/config.yaml`, falling back to `spec-driven`, and `created:` with today's date). The dashboard writes it itself; it does not invoke the `openspec` CLI.
  - `prompt.md` — only when a prompt was entered: the text as written, under a short fixed heading. It is not a schema artifact and does not affect artifact status.
- Creation is refused, without touching the disk, when: the name is not a valid change name; a change with that name already exists, active **or archived**; the repository is not an enabled, successfully scanned repository from the config; or the repository has no `openspec/changes/` parent to create into. Creation is atomic for the directory (exclusive create), so two concurrent requests cannot both succeed.
- After creation the repository is rescanned and the change appears in the `New` column without a page reload.
- The scanner reports whether a change has a `prompt.md`. Cards of changes that have one show a `prompt` badge (with the text as tooltip), and for changes that are not yet `Ready` the card's copy action copies a **start command** instead of the apply command: `cd <repo> && claude "/opsx:continue <name>"`, extended with a pointer to `prompt.md` when it exists. The dashboard still never executes anything.
- Because this is the first endpoint that writes outside the dashboard's own home, **all mutating API requests** (this one, `PUT /api/config`, `POST /api/scan`, `POST /api/discover`) are protected against cross-site requests: they must carry a JSON content type and, when the browser sends an `Origin` header, it must be the dashboard's own origin. Loopback binding alone does not stop a web page open in the same browser from posting to `127.0.0.1`.

## Capabilities

### New Capabilities
- `change-creation`: Creating a change from the dashboard — the form and its validation, what is written to the repository (`.openspec.yaml`, optional `prompt.md`), the refusal cases, atomicity, and the rescan afterwards.

### Modified Capabilities
- `dashboard-api`: "The dashboard never writes to tracked repositories" is narrowed to "writes only to create a new change directory" with the exact boundary; adds the create-change endpoint and the cross-site request protection for all mutating endpoints. Note: the in-flight `dedupe-discovery` change modifies the same never-writes requirement (adds `config --get` to the git allow-list); whichever archives second must merge both.
- `change-scanner`: adds that the scanner reports the presence (and text) of a change's `prompt.md`.
- `kanban-board`: "Copy apply command" changes so that cards of changes not yet `Ready` copy a start command (`/opsx:continue`, pointing at `prompt.md` when present), and cards show a `prompt` badge. Note: `truncate-branch-name` is expected to modify a different requirement ("Cards show repository, name, progress, activity and branch").
- `project-overview`: "Repository board header" gains the "New change" action.

## Impact

- `CLAUDE.md` invariant 1 and the README's "never writes to a tracked repository" statement must be reworded to the new, narrower guarantee — this is the project's headline promise, so the wording matters.
- `src/server/api.ts`: new `POST /api/repos/<id>/changes` endpoint; shared origin/content-type guard for mutating routes. New `src/server/createChange.ts` for validation and the exclusive-create write (reusing `CHANGE_NAME` from `src/server/source.ts`).
- `src/server/scanner.ts`, `src/server/source.ts`, `src/shared/types.ts`: `ChangeSnapshot.prompt` (optional).
- `src/ui/kanban.tsx` (header action, form, badge, copy command), `src/ui/api.ts`, `src/ui/format.ts` (start command), `src/ui/styles.css`.
- `test/`: endpoint tests (happy path, every refusal case, archived-name clash, concurrent create, cross-origin rejection), scanner test for `prompt.md`, and an extended no-side-effects test asserting that a scan still writes nothing and that creation writes only the new directory.
- No new dependencies; no git write commands; nothing is executed in the repository.
- User-visible risk: a new untracked directory appears in the repository's working tree. It is the same thing `openspec new change` produces and is removed by deleting the directory.
