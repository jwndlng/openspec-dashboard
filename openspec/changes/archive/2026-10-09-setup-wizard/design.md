# Design

## Context

Everything the wizard configures already has an endpoint: `PUT /api/config` (roots, agent sessions), `POST /api/discover`
with roots in the body (a preview that saves nothing), `POST /api/repos/track`, and `GET /api/environment`. The onboarding
tour already has an auto-start gate (`shouldAutoStart` in `src/ui/tourState.ts`, driven from `app.tsx`) that waits for
other overlays. What is missing is a server-side notion of "this installation has not been set up", concrete install
instructions in the environment report, and the dialog itself. See `proposal.md` for the motivation and the specs for
the behaviour.

## Goals / Non-Goals

**Goals:**
- One wizard per installation, decided on the server, so the desktop app and every browser agree.
- No new write path: the wizard is a client of endpoints that already exist, plus one flag-clearing endpoint.
- Install instructions that are useful outside the wizard too (Settings' Environment section shows them).

**Non-Goals:**
- A native folder picker. The desktop app has no bridge (`desktop-app` spec), and a browser cannot hand the server a
  path; roots are typed, with suggestions.
- Installing anything, or running `gh auth login`, for the user. Commands are shown and copied, never run.
- Integrating repositories without OpenSpec from the wizard; it counts them and points to the overview, where
  **Integrate** already lives.
- Per-project agent settings, shortcuts, prompts, shared config — Settings and the overview stay the place for those.

## Decisions

### `setup: "pending"` in `config.json`, absent means done
Only a configuration created by `loadConfig` because none existed (or because the stored one was reset) carries the
flag; `defaultConfig()` gains a sibling `freshConfig()` used on those two paths, so tests and other callers of
`defaultConfig()` are unaffected. Absent-means-done is what makes upgrades silent: every existing user has a config
without the key. Stored like `updateCheck`: the schema accepts only `"pending"` and drops anything else.
*Alternative:* a `localStorage` key like the tour's — rejected, because the wizard writes server configuration and the
desktop app's web view and a browser would each show it. *Alternative:* infer "fresh" from empty `scanRoots` — rejected,
because a user who deliberately has no roots (tracking by other means, or removed them) would be nagged forever.

### `PUT /api/config` never changes `setup`; a dedicated `POST /api/setup/done` clears it
Settings sends back the whole config it loaded. If `PUT` honoured `setup`, a Settings tab opened before the wizard
finished would re-set `pending` on save, and the wizard's own step saves would end setup mid-way. Making `PUT` carry the
stored value through (in the same serialised write queue as the other config writes) and clearing it only through
`/api/setup/done` removes both races. Nothing ever sets it again; "Run setup again" is purely a UI action.

### Each step saves on Continue; Finish/Skip only clear the flag
The System check must reflect the agent the user just chose, and the environment report is computed from the saved
configuration. Saving per step makes that true without a "preview" variant of the report, and makes Skip simple: what
was continued past is kept. A step's save is built from a fresh `GET /api/config` at the moment of Continue, applying
only additions (roots appended and de-duplicated by the server's canonicalisation; agent sessions `enabled: true`;
preset appended; `defaultAgent` set), so it does not overwrite changes made elsewhere since the wizard opened. Tracking
uses `POST /api/repos/track` per checked candidate after the roots are saved, because that endpoint only accepts
candidates under saved roots. A reload mid-wizard re-opens it at Welcome with saved values prefilled; nothing is lost.

### Suggestions: fixed names, one `stat` each
`src/server/setup.ts` checks a constant list of names directly under `homedir()` with `stat`, canonicalises hits with the
existing `canonicalPath`, and filters configured roots and ignore paths. Not listing the home directory keeps the
endpoint from revealing anything beyond "these well-known folders exist", and makes it cheap. Canonicalisation
collapses `Projects`/`projects` on case-insensitive volumes.

### Instructions live with the checks, presets carry their install command
`EnvironmentCheck` gains `instructions?: { text: string; command?: string }[]`. `environment.ts` picks them by
`process.platform` (`darwin` → Homebrew where it is the usual route, `linux` → the distribution-neutral route the tool
documents, `win32` → `winget`), from one table so each tool's text is in one place. Agent presets in
`src/shared/agentDefaults.ts` gain an `install` entry (steps per platform), which both the environment check and the
wizard's Agents step read; a user-written profile gets the generic "install `<command[0]>` or change the command" step.
The exact commands are checked against each tool's own install documentation when implementing and kept in that table.
*Alternative:* links to install pages — rejected: invariant 4 enumerates where outbound links appear, and a copyable
command is more direct.

### The wizard is an app-level overlay, ordered before the tour
`src/ui/setupWizard.tsx` (view) and `src/ui/setupState.ts` (pure step logic: which agent is preselected, what a step's
save is, whether Escape needs a confirmation, the summary) — the logic is tested without a DOM, like `tourState.ts`.
`app.tsx` loads `GET /api/setup` with the config; the wizard counts as an overlay for the tour, and `shouldAutoStart` gains
a `setupPending` input so the tour waits for the wizard's close on a first start. The wizard is not a route: like the
tour and console it explains or configures without being a place to link to; Help opens it with a callback.
Discovery in the Workspace step reuses the request-sequencing of `discoveryState.ts` so only the latest result shows.

### Demo
`demoApi.ts` answers `GET /api/setup` with `pending: false` and a fixed suggestion, and `POST /api/setup/done` in memory;
`tourAutoStarts()`'s demo check has a sibling for the wizard. Screenshots built from the demo are unaffected.

## Risks / Trade-offs

- [Install commands go stale as tools change their recommended route] → one table in `environment.ts` and one `install`
  entry per preset, covered by a test that every non-ok check on each platform has at least one step; the one-line
  remedy remains as before.
- [A user dismisses the wizard by accident] → Skip asks for confirmation when there are unsaved entries, and Help's
  **Run setup again** is always there.
- [Step saves interleave with another tab's Settings save] → every step's save is computed from a fresh config and only
  adds; the server already serialises configuration writes.
- [`setup` survives a failed `POST /api/setup/done`] → the wizard closes anyway and simply opens again next load, which
  is the safe direction.

## Migration Plan

No migration: existing configurations have no `setup` key and behave as before. Rolling back to an earlier binary drops
the unknown key on its next save (`configSchema` strips unknown keys), which is harmless.
