## Why

Discovery can list what looks like the same repository more than once. Probing a workspace with many repositories shows two distinct causes: the same directory reached under a different spelling (macOS is case-insensitive, so `~/Workspace/alpha` and `~/workspace/alpha` — or a symlinked root — yield different path strings and therefore different repo ids), and the same project checked out twice (`acme/access-sync` and `ops/repo-mirror/repos/access-sync`), which are genuinely different directories but show up with identical names and cannot be told apart or kept out of the list.

## What Changes

- **Canonical paths**: scan roots, ignore paths and repository paths are canonicalised (`~` expansion + `realpath`, giving on-disk casing and resolved symlinks) before they are compared, stored or hashed into a repo `id`. One directory therefore always maps to exactly one repository, however it was typed.
- **Existing configs keep working**: on load, stored paths are canonicalised and ids recomputed; entries that collapse onto the same directory are merged (the enabled one wins, otherwise the first; its name is kept).
- **Ignore paths**: new config field `ignorePaths` (absolute path prefixes). Discovery never descends into or reports anything at or below an ignored path. Editable in Settings next to the workspace roots, with an "Ignore" action on each candidate; editing it re-runs discovery like editing roots does.
- **Telling clones apart**: when several tracked or discovered repositories share a display name, Settings shows a short distinguishing parent-path hint on each, and enabling a candidate whose name is already taken defaults its name to `<name> (<parent dir>)` so the board and repo filter stay unambiguous.
- **Same-remote hint**: candidates carry `sameRemoteAs` — the other known repositories (tracked or candidate) with the same normalised `origin` URL — shown as an informational badge. Repositories are never merged or hidden by remote, because distinct projects can share one (`demo-ops` and `demo-agent` both point at `shared-agent`).
- No change to what is already correct: overlapping roots, trailing slashes, nested copies and linked worktrees stay deduplicated, now pinned by tests.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `repo-discovery`: configuration gains `ignorePaths` and canonical path identity with legacy-config merging; discovery canonicalises roots and honours ignore paths; default names avoid collisions; Settings gains the ignore-path editor, per-candidate Ignore, name hints and the same-remote badge.
- `dashboard-api`: `PUT /api/config` validates and canonicalises `ignorePaths` and paths; `POST /api/discover` accepts draft `ignorePaths`, compares canonical paths and returns `sameRemoteAs`; the read-only git allow-list gains `config --get`.

## Impact

- Server: `src/server/paths.ts` (canonicalisation), `config.ts` (schema, `repoId`, load-time migration), `discover.ts` (canonical roots, ignore prefixes, remote lookup), `git.ts` (origin URL), `api.ts` (discover body).
- Shared/UI: `src/shared/types.ts` (`Config.ignorePaths`, `DiscoveredRepo`), `src/ui/settings.tsx`, `src/ui/api.ts`, a small pure helper for name hints. No changes to `app.tsx`, `styles.css` or `scripts/build-ui.ts` (owned by the in-progress `add-light-theme` change).
- Repo ids may change once for entries whose stored path was not canonical; board filters saved in a URL with the old id simply stop matching.
- One extra read-only `git config --get remote.origin.url` per repository per discovery run. Tracked repositories remain untouched.
