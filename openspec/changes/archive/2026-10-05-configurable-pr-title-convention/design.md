# Design

## Context

Ship is a prompt, never an action of the dashboard's own: `shipPrompt(agent, change)` in
`src/server/sessions/agents.ts` takes the profile's Ship prompt or `DEFAULT_SHIP_PROMPT`, appends the profile's
additional Ship instructions (`compose`) and substitutes `{change}`. `SessionManager.ship()` already resolves the
session's `RepoConfig` through `prepareRestart`, so the repository is at hand where the prompt is built.

Per-project settings live on `RepoConfig` and are changed from the overview through
`POST /api/repos/<id>/(name|agent|labels|forget)` (`src/server/api.ts`), each going through `updateRepo`, which
validates the whole config with the `PUT /api/config` schema and writes it atomically. Settings saves its draft with
the repositories "as the app last received them" (`src/ui/settings.tsx`), so a new repository field survives a
Settings save without extra work.

## Goals / Non-Goals

**Goals:**
- One fixed, testable sentence per convention; the prompt stays one line and stays agent-neutral.
- The setting is shaped so a second convention can be added later without a config migration.

**Non-Goals:**
- Making the convention sentence editable. Users who want different wording already have the profile's additional
  Ship instructions; the setting exists so a *project* can declare its convention independently of the agent.

## Decisions

**D1 — A top-level `prTitleConvention` enum on `RepoConfig`, not a boolean and not under `agent`.**
`prTitleConvention?: "conventional-commits"` (type `PrTitleConvention`), absent meaning none. An enum with one value
leaves room for another convention; absent-for-none keeps existing configs byte-for-byte unchanged and follows how
`labels` and `agent.agentId` treat "default". It is not under `agent` because it describes the project, not the agent
session settings, and `postRepoAgent` defaults `agent` to `{ enabled: true }` on first write — mixing the two would
create agent settings as a side effect. The zod `repoSchema` gets `prTitleConvention: z.literal("conventional-commits").optional()`,
so any other value is refused with the path named, like every other config error.

**D2 — The sentence is inserted between the base prompt and the additional instructions.**
`shipPrompt(agent, change, convention?)` builds `base` (profile prompt or default), appends
`CONVENTIONAL_COMMITS_SHIP_SENTENCE` when `convention === "conventional-commits"`, then runs `compose`. Additional
instructions are defined as an addition to "the prompt it would otherwise have sent", and the user's own text should
win over ours when the two disagree — so it comes last. The constant lives in `src/shared/types.ts` next to
`DEFAULT_SHIP_PROMPT` so the UI can show it in the picker's tooltip. Proposed wording:
`Title the pull request as a Conventional Commit — <type>(<optional scope>): <summary>, for example feat(api): add pagination — and write the commit messages the same way.`
It must contain no `{…}` (it passes through `{change}` substitution) and no line break.

Alternative considered: keeping `compose` unaware and putting the sentence into the suffix. Rejected — the suffix is
the profile's, and making a repository setting look like a profile field would blur which one the user edits.

**D3 — The default Ship prompt becomes convention-neutral.**
`DEFAULT_SHIP_PROMPT` says "with a commit message that follows this repository's conventions" instead of "a
Conventional Commit message". Without this the setting would only ever add, never remove, a convention. It is a
constant, never stored, so no `FORMER_*` migration is needed; a profile with its own Ship prompt is unaffected.

**D4 — A dedicated route `POST /api/repos/<id>/pr-title-convention`.**
Added to the existing per-repository dispatcher regex, implemented like `postRepoName`: validate
`convention` is `"conventional-commits"` or `null` (absent → 400), then `updateRepo` sets or deletes the key. It sits
behind `crossSiteRefusal` like every other non-GET route and triggers no scan. Alternative: folding it into
`/agent` — rejected for the reason in D1.

**D5 — UI: a compact picker in `projectSettings.tsx`, beside Agent and Labels.**
A `<select>` (No convention / Conventional Commits) following the agent picker's saving/failure/revert pattern, shown
when `row.isGit`. Unlike the agent picker it is not hidden when agent sessions are off: it describes the project and
is cheap to set ahead of time. The tooltip quotes the sentence Ship will add. The demo API answers the request by
updating its in-memory config, as it does for labels.

## Risks / Trade-offs

- [Existing users relied on the default prompt asking for Conventional Commits] → The What's new entry says the
  default is now neutral and points to the new PR titles setting; this repository's own entry is switched on by the
  user once.
- [An agent ignores the sentence] → Out of the dashboard's control by design (it titles nothing itself); the
  repository's own CI check, like this one's title workflow, remains the enforcement.
- [`add-validate-phase` also edits `src/shared/types.ts`] → Edits are in different declarations; rebase on whichever
  lands first.

## Migration Plan

None: the field is optional and absent in every existing config. Rollback is dropping the field — an older binary's
zod schema strips unknown keys on load.
