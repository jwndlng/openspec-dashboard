## MODIFIED Requirements

### Requirement: Dashboard configuration is persisted in the user's home directory

The dashboard SHALL store its configuration in `~/.spec-control/config.json` containing `scanRoots`, `ignorePaths`, `repos` (each with `id`, `path`, `name`, `enabled`), `pollIntervalSeconds` and `port`. The dashboard MUST create the directory and a default config on first start and MUST write config atomically (temp file + rename). All stored paths (`scanRoots`, `ignorePaths`, `repos[].path`) MUST be canonical: `~` expanded, symlinks resolved and spelled with their on-disk casing; a path that does not exist is stored normalised as given. When loading a config written by an earlier version, the dashboard MUST default a missing `ignorePaths` to an empty list, canonicalise stored paths, recompute repository ids, and merge repositories that resolve to the same directory — keeping the enabled entry, otherwise the first, together with that entry's name — and MUST NOT reset the config because of such entries.

#### Scenario: First start creates default config
- **WHEN** the dashboard starts and `~/.spec-control/config.json` does not exist
- **THEN** it creates the directory and a config with empty `scanRoots`, empty `ignorePaths`, empty `repos`, `pollIntervalSeconds: 60` and `port: 4711`

#### Scenario: Config survives restart
- **WHEN** a user enables a repo and restarts the dashboard
- **THEN** the repo is still listed as enabled after restart

#### Scenario: Config without ignorePaths loads
- **WHEN** the stored config has no `ignorePaths` key
- **THEN** it loads with `ignorePaths: []` and all other values unchanged

#### Scenario: Legacy duplicate entries are merged
- **WHEN** the stored config contains the same directory twice under different spellings, one disabled and one enabled and renamed to "Beta SOC"
- **THEN** after loading, the config contains that directory once, with its canonical path, `enabled: true` and name "Beta SOC"

### Requirement: Discovery finds OpenSpec-enabled repositories under configured roots

The dashboard SHALL discover repositories by walking each given scan root to a bounded depth (default 4) and reporting directories that contain `openspec/config.yaml`. Scan roots MUST be canonicalised before walking so that every directory is reported at most once under its canonical path, however the roots were spelled or however they overlap. The walk MUST skip `node_modules`, `.git`, `.venv`, `target` and `dist` directories, MUST skip every directory that equals or lies below an ignore path, MUST NOT descend into a directory it reported (nested copies are not projects of their own), and MUST NOT report linked git worktrees (directories whose `.git` is a file). Discovery SHALL run whenever the user adds or removes a workspace root or an ignore path in Settings (against the edited values, without requiring a save), when Settings is opened with at least one root configured, when the projects overview runs it as the `project-overview` capability specifies (against the saved values), and when the user requests it explicitly. Discovery MUST be read-only: it MUST NOT modify the persisted configuration. Alongside those repositories, the same walk SHALL report **integratable** repositories as a separate result: directories with their own `.git` directory and no `openspec/config.yaml`. The walk MUST keep descending into an integratable repository, so which OpenSpec projects it reports is exactly what it was before; an integratable repository that contains a reported OpenSpec project MUST then be dropped from that separate result.

#### Scenario: Repos are found under multiple roots
- **WHEN** scan roots are `~/Workspace/alpha` and `~/Workspace/acme` and both contain projects with `openspec/config.yaml`
- **THEN** discovery returns each project directory exactly once with its absolute path

#### Scenario: Overlapping roots do not duplicate
- **WHEN** scan roots are `~/Workspace` and `~/Workspace/alpha`
- **THEN** each project under `~/Workspace/alpha` is returned exactly once

#### Scenario: Differently spelled roots do not duplicate
- **WHEN** the file system is case-insensitive and scan roots are `~/Workspace/alpha` and `~/workspace/alpha`, or one root is a symlink to the other
- **THEN** each project is returned exactly once, with its on-disk path and a single id

#### Scenario: Ignored directories are skipped
- **WHEN** a scan root contains `node_modules/some-pkg/openspec/config.yaml`
- **THEN** that directory is not reported

#### Scenario: Ignore paths are skipped
- **WHEN** `ignorePaths` contains `~/Workspace/mirror/repos` and that directory holds checkouts with `openspec/config.yaml`
- **THEN** none of those checkouts are reported, while the same projects elsewhere under the roots still are

#### Scenario: Ignore path matches whole segments only
- **WHEN** `ignorePaths` contains `/w/repos` and a project exists at `/w/repos-extra/app`
- **THEN** `/w/repos-extra/app` is reported

#### Scenario: Nested copies and worktrees are not reported
- **WHEN** a repository contains `test/fixtures/other/openspec/config.yaml`, and a sibling directory is a linked worktree of that repository
- **THEN** only the repository itself is reported

#### Scenario: Missing scan root
- **WHEN** a given scan root does not exist
- **THEN** discovery reports an error for that root and still returns results from the other roots

#### Scenario: Adding a root triggers discovery immediately
- **WHEN** the user adds `~/Workspace/alpha` as a workspace root in Settings and has not saved
- **THEN** discovery runs against the edited roots without further user action and Settings states how many untracked repositories were found

#### Scenario: Removing a root triggers discovery immediately
- **WHEN** the user removes a workspace root in Settings
- **THEN** discovery runs against the remaining roots and repositories that were only found under the removed root are no longer counted

#### Scenario: Editing ignore paths triggers discovery immediately
- **WHEN** the user adds an ignore path in Settings and has not saved
- **THEN** discovery runs against the edited values and repositories below that path are no longer counted

#### Scenario: Removing the last root clears candidates
- **WHEN** the user removes the only workspace root
- **THEN** no discovery request is made and Settings counts no candidates

#### Scenario: Opening Settings runs discovery
- **WHEN** the user opens Settings and the config contains at least one workspace root
- **THEN** discovery runs and Settings states how many untracked repositories were found, without clicking anything

#### Scenario: Opening the overview runs discovery
- **WHEN** the user opens the projects overview and the config contains at least one workspace root
- **THEN** discovery runs against the saved roots and ignore paths and its result is listed under the overview's Unmanaged projects

#### Scenario: Discovery does not change the config
- **WHEN** discovery finds repositories that are not in the config
- **THEN** `~/.spec-control/config.json` is unchanged

#### Scenario: Only the latest discovery result is shown
- **WHEN** the user edits the roots twice in quick succession and the first discovery finishes after the second
- **THEN** the result shown reflects the second edit only

#### Scenario: Integratable repositories are reported alongside candidates
- **WHEN** a scan root holds `/w/acme/beta-soc` with `openspec/config.yaml` and `/w/acme/chat-groups`, a git repository without it
- **THEN** discovery reports `beta-soc` as a candidate and `chat-groups` as integratable, in two separate results

#### Scenario: The candidate list is unaffected
- **WHEN** discovery runs over roots that contain both OpenSpec projects and plain git repositories
- **THEN** the candidates are exactly those reported before integratable repositories were added, including projects nested inside a plain git repository
