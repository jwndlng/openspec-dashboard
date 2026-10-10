# Spec Delta

## MODIFIED Requirements

### Requirement: Discovery finds OpenSpec-enabled repositories under configured roots

The dashboard SHALL discover repositories by walking each given scan root to a bounded depth (default 4) and reporting directories that contain `openspec/config.yaml`. Scan roots MUST be canonicalised before walking so that every directory is reported at most once under its canonical path, however the roots were spelled or however they overlap. The walk MUST skip `node_modules`, `.git`, `.venv`, `target` and `dist` directories, MUST skip every directory that equals or lies below an ignore path, MUST NOT descend into a directory it reported (nested copies are not projects of their own), and MUST NOT report linked git worktrees (directories whose `.git` is a file). Discovery SHALL run whenever the user adds or removes a workspace root or an ignore path in Settings (against the edited values, without requiring a save), when Settings is opened with at least one root configured, when the projects overview runs it as the `project-overview` capability specifies (against the saved values), and when the user requests it explicitly. Discovery MUST be read-only: it MUST NOT modify the persisted configuration. Alongside those repositories, the same walk SHALL report **integratable** repositories as a separate result: directories with their own `.git` directory and no `openspec/config.yaml`. The walk MUST keep descending into an integratable repository, so which OpenSpec projects it reports is exactly what it was before; an integratable repository that contains a reported OpenSpec project MUST then be dropped from that separate result. A folder into which a clone of the `github-repositories` capability is still running MUST be reported in neither result.

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

#### Scenario: A clone in progress is not reported
- **WHEN** a clone into `/w/acme/beta-soc` is running and its `.git` directory already exists, and discovery runs over `/w/acme`
- **THEN** `/w/acme/beta-soc` is neither a candidate nor integratable until the clone has finished

### Requirement: Tracking is opt-in per repository

Discovered repositories that are not already in the config SHALL be offered as candidates and MUST NOT be added to the config by discovery. A repository SHALL be added to the config only when the user acts for that one repository: by enabling that individual candidate (on the projects overview, where it takes effect at once), by starting an integration for that individual integratable repository after which `openspec/config.yaml` appears in it, or by cloning that repository with **Add from GitHub** (`github-repositories` capability), after which a clone holding `openspec/config.yaml` is added. In each case it is added with `enabled: true` and its default name. Only repositories with `enabled: true` are scanned and shown on the board. Repositories already present in the config MUST keep their `enabled` state, `name` and agent-session settings when discovery runs again and MUST NOT be listed as candidates; this comparison MUST use canonical paths, so a repository tracked under one spelling is never offered again under another. A repository SHALL leave the config only when the user forgets it on the projects overview, which is offered for disabled repositories only. Ignore paths affect discovery only: a repository already in the config stays configured even if it lies below an ignore path.

#### Scenario: Newly discovered repo is only a candidate
- **WHEN** discovery finds a repository that is not yet in the config
- **THEN** it is listed as a candidate, is not added to the config, and does not appear on the board

#### Scenario: Enabling a single candidate
- **WHEN** discovery lists candidates `a`, `b` and `c` and the user enables `b` on the projects overview
- **THEN** the config contains `b` with `enabled: true`, does not contain `a` or `c`, and `b` no longer appears in the candidate list

#### Scenario: Re-running discovery preserves user choices
- **WHEN** a repo was previously enabled, renamed to "Beta SOC" and switched off for agent sessions, and discovery runs again
- **THEN** the repo remains enabled with name "Beta SOC" and agent sessions off, and is not listed as a candidate

#### Scenario: Tracked repo is not offered under another spelling
- **WHEN** a repository is tracked and discovery runs with a root that reaches the same directory through a symlink or different casing
- **THEN** the repository is not listed as a candidate

#### Scenario: Disabled repo stays configured
- **WHEN** the user disables a tracked repo on the projects overview
- **THEN** it remains in the config with `enabled: false`, keeps its name, and is not listed as a candidate

#### Scenario: Forgotten repo becomes a candidate again
- **WHEN** the user forgets a disabled repo on the projects overview that still exists under a workspace root, and discovery runs
- **THEN** the repo is absent from the config and listed as a candidate with its default name

#### Scenario: Ignoring a path keeps tracked repos
- **WHEN** a tracked repository lies below a path the user adds to `ignorePaths`
- **THEN** the repository stays in the config and on the board

#### Scenario: A confirmed integration adds the repository
- **WHEN** the user starts an integration for `/w/acme/chat-groups` and `openspec/config.yaml` appears in it
- **THEN** it is added to the config with `enabled: true` and its default name, without the user pressing Enable for it

#### Scenario: An unconfirmed integration adds nothing
- **WHEN** the user starts an integration and no `openspec/config.yaml` appears
- **THEN** the config is unchanged and the repository is still listed as integratable

#### Scenario: A confirmed clone adds the repository
- **WHEN** the user clones `acme/beta-soc` into `/w/acme` with Add from GitHub and the clone holds `openspec/config.yaml`
- **THEN** `/w/acme/beta-soc` is added to the config with `enabled: true` and its default name, without the user pressing Enable for it

#### Scenario: A clone without OpenSpec adds nothing
- **WHEN** the user clones `acme/chat-groups` into `/w/acme` and it holds no `openspec/config.yaml`
- **THEN** the config is unchanged and `/w/acme/chat-groups` is listed as integratable
