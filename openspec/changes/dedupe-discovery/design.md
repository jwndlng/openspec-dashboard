## Context

Discovery (`src/server/discover.ts`) walks the scan roots and returns every directory containing `openspec/config.yaml` that is not already in the config. Identity is `repoId(path) = sha1(path)[:12]` over the `~`-expanded, `normalize`d path string (`src/server/config.ts`). Measured against the real workspace:

| Situation | Result today |
|---|---|
| Overlapping roots (`~/Workspace` + `~/Workspace/alpha`), trailing slash, `.` segments | already deduplicated (paths collected in a `Set`) |
| Same directory, different case (`~/workspace/alpha`) or via a symlinked root | **duplicated**: different strings → different ids, and a tracked repo is offered again as a candidate |
| Same project cloned twice (`acme/x` and `ops/repo-mirror/repos/x`) | two legitimate directories with identical names; indistinguishable, and no way to exclude the bulk-checkout area |
| Same `origin` remote | not a reliable identity: `demo-ops` and `demo-agent` share `shared-agent` but are separate projects |

The walk does not follow symlinked subdirectories (`Dirent.isDirectory()` is false for symlinks), so only the *roots* can introduce alternative spellings.

## Goals / Non-Goals

**Goals:**
- One directory ⇒ one repository id, regardless of how a root or path was typed.
- Legacy configs with non-canonical paths load without a reset and without duplicate entries.
- The user can permanently exclude areas from discovery and can tell same-named repositories apart.
- Surface "probably the same project" as information only.

**Non-Goals:**
- Merging or hiding repositories by git remote.
- Glob/regex ignore patterns (prefixes cover the observed case).
- Changing the board or the `kanban-board` spec; name collisions are solved at the source (default names).
- Following symlinked subdirectories during the walk.

## Decisions

### D1 — Canonicalise with `realpath` at the edges, hash the canonical path
Add `canonicalPath(p)` to `paths.ts`: `expandPath` → `realpathSync.native` → strip trailing separator; if the path does not exist, return the normalised input unchanged. It is applied to: scan roots before walking, ignore paths, repo paths in config validation, and inside `repoId`/`newRepoConfig`. Because the walk never follows symlinks, canonical roots make every found path canonical without a `realpath` per directory.
*Why `realpath.native`*: on macOS it returns the on-disk casing; the JS implementation only resolves symlinks. *Alternative considered*: lower-casing paths on case-insensitive volumes — wrong on case-sensitive volumes and does nothing for symlinks.
A deleted repository keeps its stored (already canonical) path, so its id is stable while the directory is missing.

### D2 — Migrate on load, stay strict on write
`loadConfig` runs `migrateConfig(raw)` before validation: default `ignorePaths` to `[]`, canonicalise roots/ignore paths (dedupe, order kept), canonicalise each repo path and recompute its id, then collapse repos with the same id — keep the enabled entry, else the first, and keep that entry's name. If anything changed, the migrated config is saved back atomically. `PUT /api/config` still rejects an `id` that does not match its (canonical) path: the UI only ever submits ids issued by the server, so a mismatch is a client bug, not something to repair silently. Without the migration, a legacy non-canonical path would fail that same check on load and trigger the "corrupt config → reset to defaults" path, which would be data loss.
`version` stays `1`; `ignorePaths` is optional on input and always present on output.

### D3 — `ignorePaths` are canonical absolute prefixes checked during the walk
`walk` returns immediately when `dir` equals an ignored path or lies below it (`dir.startsWith(p + sep)`), so ignored trees cost nothing. A root that is itself ignored produces no results and no error. Ignore paths affect discovery only; an already tracked repository under an ignored path stays tracked (the user removes it with ×). *Alternative considered*: globs — more power than the observed need, and another dependency or parser in a single-binary tool.
`POST /api/discover` accepts `ignorePaths` in the body next to `scanRoots`, with the same "draft, not saved" semantics introduced by `discover-on-root-change`; absent means "use the saved ones".

### D4 — Disambiguate names where they are created, hint where they are listed
- `nameHints(entries)` (pure, `src/shared/nameHints.ts`): group by case-insensitive name; for groups of two or more, the hint is each entry's parent path relative to the group's deepest common ancestor (`acme` vs `ops/repo-mirror/repos`). Settings renders it as a badge in both the Tracked and Discovered lists.
- When a candidate is enabled and its default name is already used by a repo in the draft, the name defaults to `<name> (<parent dir basename>)`. This keeps board cards and repo filter chips unambiguous without touching the board. Names remain freely editable; collisions the user creates by hand are allowed.

### D5 — `sameRemoteAs` is computed per discovery run, informational only
`git.ts` gains `originUrl(cwd)` (`git config --get remote.origin.url`, read-only). `discoverRepos` looks up the remote for every candidate and every configured repo (bounded concurrency 8, failures → no remote), normalises it (`git@host:org/repo(.git)` and `https://host/org/repo(.git)` → `host/org/repo`, lower-cased host), and sets `sameRemoteAs: { name, path, tracked }[]` on candidates that share a remote with any other known repository, tracked or candidate. Candidates are included because on a fresh setup nothing is tracked yet — exactly when the hint is most useful. The response type becomes `DiscoveredRepo = RepoConfig & { sameRemoteAs?: … }`; the UI strips the extra field when moving a candidate into the draft config.

### D6 — UI stays within existing styles
Settings reuses `.list`, `.row`, `.badge`, `.hint` and `.btn.sm.ghost`; no edits to `styles.css`, `app.tsx` or `build-ui.ts`, which the in-progress `add-light-theme` change is modifying.

## Risks / Trade-offs

- [`realpath.native` casing behaviour under Bun differs from Node] → first task is a test that creates `Foo/`, resolves `foo/` and asserts `Foo` on case-insensitive volumes (skipped otherwise); if Bun does not normalise case, fall back to resolving each segment against `readdir` of its parent.
- [Repo ids change for legacy non-canonical entries] → one-time, only for entries that were ambiguous anyway; saved URL filters with the old id stop matching, nothing else references ids.
- [Migration merges two entries the user renamed differently] → deterministic rule (enabled wins, else first) and the config is saved through the same atomic path; the pre-migration file content is logged as a warning line with the merged names.
- [Extra git call per repo per discovery] → ~10 ms each, run concurrently; discovery already debounces by sequence number in the UI.
- [User ignores a path containing a tracked repo and expects it to disappear] → Settings hint text states that ignore paths only affect discovery.

## Migration Plan

Ship as a normal build. First start migrates `~/.openspec-dashboard/config.json` in place when needed. Rollback: older builds ignore the unknown `ignorePaths` key (zod strips it) and accept canonical paths unchanged.

## Open Questions

- Should the per-candidate "Ignore" action offer the parent directory as well as the repo itself? v1 adds the repo path; the manual input covers parents.
