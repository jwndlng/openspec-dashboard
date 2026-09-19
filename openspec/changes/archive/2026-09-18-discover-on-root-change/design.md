## Context

Today discovery is a three-step, side-effecting flow in [src/ui/settings.tsx](../../../src/ui/settings.tsx): the user edits roots in a draft, clicks **Discover**, the UI first `PUT`s the whole draft (because `POST /api/discover` only reads the *saved* roots), then replaces `draft.repos` with the merged list from `mergeDiscovered()`. Every found repository lands in the draft as `enabled: false` and is written to `~/.openspec-dashboard/config.json` on the next save. The config therefore mirrors "everything under my roots" rather than "what I track".

Constraints carried over from the MVP: local-first single binary, loopback only, no writes outside `~/.openspec-dashboard/`, config format `version: 1`, Settings edits are collected in a draft and persisted by one explicit Save.

## Goals / Non-Goals

**Goals:**
- Editing workspace roots gives immediate feedback about what is underneath them, with no button and no save.
- Discovery is read-only: it never changes the config, neither on the server nor via an implicit UI save.
- The config contains only repositories the user acted on; candidates are transient.
- Repositories are enabled one at a time from the candidate list.

**Non-Goals:**
- Filesystem watching or periodic background discovery (new repos appearing under a root are picked up on the next Settings visit or Rediscover).
- "Enable all" / bulk actions.
- Changing the walk itself (depth, ignore list, worktree handling).
- Migrating existing configs or bumping the config version.
- Changing how enabling/disabling triggers scans (`PUT /api/config` already does this).

## Decisions

### D1: Discovery takes roots in the request body
`POST /api/discover` accepts an optional JSON body `{ scanRoots: string[] }`. When present, the roots are validated with the same absolute-path rule as the config (`~` expanded) and used instead of `state.config.scanRoots`. An empty or missing body keeps today's behaviour.

*Why:* the UI must discover against roots that are still unsaved draft state. *Alternative considered:* persist roots immediately on add/remove and keep the endpoint body-less. Rejected because it splits Settings into "instant" and "needs Save" fields and makes an accidental root removal non-revertable by simply leaving the page.

### D2: The server returns candidates, not a merged list
`DiscoverResult` becomes `{ candidates: RepoConfig[]; errors }`. `candidates` = found paths minus paths already in the saved config, each built with `newRepoConfig(path, false)`, sorted by path. `mergeDiscovered()` is replaced by a pure `toCandidates(known, paths)`.

The UI additionally filters candidates against `draft.repos` when rendering, so a candidate that was just enabled (but not saved) disappears from the Discovered list, and a repo that was just forgotten (but not saved) reappears after the next discovery run.

*Why:* keeps the "what is new" rule in one tested server function while the draft-aware filter stays a one-line derived value in the UI. *Alternative considered:* return raw found paths and let the UI do everything. Rejected: id/name derivation lives in `config.ts` on the server and should not be duplicated in the browser.

### D3: Enabling a candidate edits the draft; Save persists
**Enable** on a candidate appends `{ ...candidate, enabled: true }` to `draft.repos` and marks the draft dirty. Persistence and the follow-up scan happen through the existing Save → `PUT /api/config` path.

*Why:* one persistence model for the whole page; the unsaved-changes indicator stays truthful; rename-before-save works naturally. *Alternative considered:* Enable persists immediately. Rejected for now because it would have to either save unrelated draft edits as a side effect (today's Discover problem again) or perform a partial server-side patch, which needs a new endpoint. Can be revisited if the extra Save click proves annoying.

### D4: When discovery runs
A single `runDiscovery(roots)` in Settings is called:
1. on mount, if the config has at least one root;
2. after every add or remove of a root, with the new draft roots;
3. from a **Rediscover** button.

With zero roots the call is skipped and candidates/errors are cleared locally. Runs are not debounced (root edits are discrete clicks, not keystrokes); instead each run takes a monotonically increasing sequence number and a response is applied only if its number is still the latest. A "Discovering…" indicator is shown while the latest run is in flight.

*Why a sequence guard over `AbortController`:* the walk is server-side and cannot be cancelled anyway; ignoring stale responses is sufficient and simpler.

### D5: Forget vs. disable
Unchanged semantics, now more meaningful: **disable** keeps the entry (and its custom name) in the config but stops scanning; **forget** (×) removes it, after which it shows up again as a candidate if still under a root. No automatic pruning of disabled entries.

## Risks / Trade-offs

- [Walk cost on every root edit — a broad root like `~` at depth 4 can take seconds] → Runs are sequenced so the UI never blocks or shows stale results; the ignore list already skips the heavy directories; no debounce needed because triggers are discrete.
- [Existing configs still contain many `enabled: false` entries from the old flow] → Accepted; they appear under Tracked as disabled and can be forgotten individually. Documented in the README upgrade note rather than auto-pruned, since a disabled entry may carry a deliberate custom name.
- [Breaking response shape of `POST /api/discover`] → UI and server ship in the same binary, there are no external API consumers; tests are updated in the same change.
- [Candidates are lost when leaving Settings] → Intentional (transient by design); discovery re-runs on mount.
- [Request body lets the client make the server walk arbitrary absolute paths] → Same trust level as `PUT /api/config` + discover today; server is loopback-only and the walk is read-only, reporting only directories that contain `openspec/config.yaml`.

## Migration Plan

1. Archive `kanban-dashboard-mvp` so `repo-discovery` and `dashboard-api` exist under `openspec/specs/`.
2. Ship server and UI together (single binary); no config migration, `version` stays `1`.
3. Rollback = previous binary; configs written by the new version are valid for the old one.

## Open Questions

- None blocking. If the explicit Save after Enable feels heavy in practice, follow up with immediate persistence (see D3).
