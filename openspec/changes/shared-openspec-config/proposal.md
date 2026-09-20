## Why

Every OpenSpec project can give agents extra guidance through `openspec/config.yaml`: a `context:` text injected into every artifact instruction and per-artifact `rules:`. Across the 13 tracked repositories this is almost entirely unused — 12 still carry the untouched scaffold with both keys commented out, one has its own context — because maintaining the same conventions ("conventional commits", "always include Non-goals", "tasks ≤ 2h", house style for specs) by hand in 13 files does not happen, and where it does it drifts. The dashboard already knows every project; it is the natural place to keep that guidance once and push it everywhere, and to show where a project has fallen behind.

## What Changes

- **Shared config profiles, kept in the dashboard.** Settings gains a "Shared OpenSpec config" panel to maintain one or more named **profiles** (e.g. `base`, `security`, `frontend`), each with its own `context` text and `rules` per artifact id. Different repositories can carry different profiles, and a repository can carry several at once (stacked in the dashboard's profile order). Profiles are stored in the dashboard's own home (`~/.openspec-dashboard/`), not in any repository.
- **Sync state per repository, read-only.** Which profiles a repository carries is read from the markers in its `openspec/config.yaml`, not remembered by the dashboard. For each profile found there the scanner reports `in sync`, `outdated` (differs from the profile as it is now) or `orphaned` (the profile no longer exists in the dashboard); a file that is missing, not valid YAML or has malformed markers is `unreadable`. A repository carrying no profile is simply shown as such — the dashboard cannot know which profiles a repository *should* have, so that is not a warning. The Projects overview and the repository board header show this; nothing is written to find it out.
- **BREAKING** (project invariant): **Apply** writes the shared config into repositories' `openspec/config.yaml`. This modifies an existing, usually git-tracked file, so it is bounded tightly:
  - Only on an explicit user action, never on a timer or as a side effect of scanning or saving Settings.
  - The user chooses, per repository, exactly which profiles it should carry (a repositories × profiles grid, pre-filled from what each repository carries now). Applying makes the file carry exactly that set: it adds, updates and **detaches** profiles. Always preceded by a **per-repository preview** (a diff of exactly what would change).
  - Only `openspec/config.yaml`, only the `context` and `rules` keys. `schema` and every other key, all comments and the rest of the formatting are preserved. No git command is run: the result is an ordinary uncommitted modification for the user to review and commit.
  - **Managed sections, not replacement.** Shared content lives in clearly marked managed sections that name their profile — one delimited block per profile inside the `context` text, and marked entries at the head of each `rules` list. Everything outside the markers is the project's own and is never altered, so a project keeps its local context and rules next to the shared ones. Re-applying replaces only the managed sections; applying an empty selection removes them and leaves the local content as it was.
  - Refused, without writing, when the file is not valid YAML, when the keys have an unexpected type, when the repository is not an enabled tracked repository, or when the combined `context` would exceed OpenSpec's 50KB limit (above which OpenSpec silently ignores the context — the opposite of what apply is for).
  - Written atomically (temp file + rename) so an interrupted apply cannot leave a half-written config.
- After an apply the affected repositories are rescanned and their state turns `in sync` without a reload.
- Because markers live in the file itself, the sync state is derived from the repositories alone; the dashboard keeps no per-repository record of what it applied.

## Capabilities

### New Capabilities
- `shared-config`: The shared OpenSpec configuration — editing and storing it, the managed-section format in `openspec/config.yaml`, deriving each repository's sync state, showing it in the overview and repository header, previewing and applying to one/many/all repositories, the refusal cases and the guarantees about what apply never touches.

### Modified Capabilities
- `dashboard-api`: "The dashboard never writes to tracked repositories" is narrowed to allow this explicit, previewed write to `openspec/config.yaml`; adds the endpoints for reading/saving the shared config, previewing and applying. Note: `create-change-from-dashboard` (creates a change directory) and `dedupe-discovery` (adds `config --get` to the git allow-list) modify the same requirement. The two write features should share one boundary — *the dashboard writes to a tracked repository only on an explicit user action, only the enumerated paths, never deletes, and never runs a git command that writes* — and whichever archives later must merge the wording. The cross-site request protection that `create-change-from-dashboard` proposes for mutating endpoints is a prerequisite here as well.
- `change-scanner`: adds that each repository's snapshot reports its shared-config sync state.

## Impact

- `CLAUDE.md` invariant 1 and the README's read-only promise need the same careful rewording as for `create-change-from-dashboard`; ideally both changes land that wording once.
- New direct dependency on `yaml` (already present transitively through `@fission-ai/openspec`, pure JavaScript, comment-preserving document API) for safe round-trip editing. The scanner's existing regex read of `schema:` is unaffected.
- `src/server/`: new `sharedConfig.ts` (storage, managed-section read/merge/remove, state derivation, atomic write), `api.ts` (endpoints, guarded like other mutating routes), `scanner.ts` (state per repo; one small file read it already performs), `src/shared/types.ts` (`RepoSnapshot.sharedConfig` state; shared config shape).
- `src/ui/`: Settings panel (editor, per-repo state list, preview dialog, apply), overview column/badge, repository header badge, `api.ts`, `styles.css`.
- `test/`: round-trip tests on real-world configs (the scaffold with commented examples, a config with local context, block vs. quoted scalars, existing rules), idempotent re-apply, removal, every refusal case, the 50KB guard, atomic write, state derivation, and an extended no-side-effects test (scanning and previewing write nothing; apply changes only `openspec/config.yaml`).
- User-visible consequence: after "apply to all" every repository has an uncommitted change to `openspec/config.yaml` to review and commit.
- Multiple profiles are part of this change rather than a follow-up because the marker format is written into repositories: adding the profile id later would mean migrating every file already applied.
- Open choice carried into the design: managed sections (proposed — keeps local content safe) versus replacing `context`/`rules` wholesale (simpler, but destroys project-specific guidance such as the one repository that already has its own context).
