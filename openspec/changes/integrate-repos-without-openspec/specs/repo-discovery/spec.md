# Spec Delta

## MODIFIED Requirements

### Requirement: Discovery finds OpenSpec-enabled repositories under configured roots

The dashboard SHALL discover repositories by walking each given scan root to a bounded depth (default 4) and reporting directories that contain `openspec/config.yaml`. Scan roots MUST be canonicalised before walking so that every directory is reported at most once under its canonical path, however the roots were spelled or however they overlap. The walk MUST skip `node_modules`, `.git`, `.venv`, `target` and `dist` directories, MUST skip every directory that equals or lies below an ignore path, MUST NOT descend into a directory it reported (nested copies are not projects of their own), and MUST NOT report linked git worktrees (directories whose `.git` is a file). Discovery SHALL run whenever the user adds or removes a workspace root or an ignore path in Settings (against the edited values, without requiring a save), when Settings is opened with at least one root configured, and when the user requests it explicitly. Discovery MUST be read-only: it MUST NOT modify the persisted configuration. Alongside those repositories, the same walk SHALL report **integratable** repositories as a separate result: directories with their own `.git` directory and no `openspec/config.yaml`. The walk MUST keep descending into an integratable repository, so which OpenSpec projects it reports is exactly what it was before; an integratable repository that contains a reported OpenSpec project MUST then be dropped from that separate result.

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
- **THEN** discovery runs against the edited roots without further user action and the repositories found under `~/Workspace/alpha` are shown as candidates

#### Scenario: Removing a root triggers discovery immediately
- **WHEN** the user removes a workspace root in Settings
- **THEN** discovery runs against the remaining roots and candidates that were only found under the removed root are no longer shown

#### Scenario: Editing ignore paths triggers discovery immediately
- **WHEN** the user adds an ignore path in Settings and has not saved
- **THEN** discovery runs against the edited values and candidates below that path are no longer shown

#### Scenario: Removing the last root clears candidates
- **WHEN** the user removes the only workspace root
- **THEN** no discovery request is made and the candidate list is empty

#### Scenario: Opening Settings runs discovery
- **WHEN** the user opens Settings and the config contains at least one workspace root
- **THEN** discovery runs and candidates are shown without clicking anything

#### Scenario: Discovery does not change the config
- **WHEN** discovery finds repositories that are not in the config
- **THEN** `~/.openspec-dashboard/config.json` is unchanged

#### Scenario: Only the latest discovery result is shown
- **WHEN** the user edits the roots twice in quick succession and the first discovery finishes after the second
- **THEN** the candidate list reflects the second edit only

#### Scenario: Integratable repositories are reported alongside candidates
- **WHEN** a scan root holds `/w/acme/beta-soc` with `openspec/config.yaml` and `/w/acme/chat-groups`, a git repository without it
- **THEN** discovery reports `beta-soc` as a candidate and `chat-groups` as integratable, in two separate results

#### Scenario: The candidate list is unaffected
- **WHEN** discovery runs over roots that contain both OpenSpec projects and plain git repositories
- **THEN** the candidates are exactly those reported before integratable repositories were added, including projects nested inside a plain git repository

### Requirement: Tracking is opt-in per repository

Discovered repositories that are not already in the config SHALL be offered as candidates and MUST NOT be added to the config by discovery. A repository SHALL be added to the config only when the user acts for that one repository: either by enabling that individual candidate, or by starting an integration for that individual integratable repository after which `openspec/config.yaml` appears in it. In both cases it is added with `enabled: true` and its default name. Only repositories with `enabled: true` are scanned and shown on the board. Repositories already present in the config MUST keep their `enabled` state and `name` when discovery runs again and MUST NOT be listed as candidates; this comparison MUST use canonical paths, so a repository tracked under one spelling is never offered again under another. Ignore paths affect discovery only: a repository already in the config stays configured even if it lies below an ignore path.

#### Scenario: Newly discovered repo is only a candidate
- **WHEN** discovery finds a repository that is not yet in the config
- **THEN** it is listed as a candidate, is not added to the config, and does not appear on the board

#### Scenario: Enabling a single candidate
- **WHEN** discovery lists candidates `a`, `b` and `c`, the user enables `b` and saves
- **THEN** the config contains `b` with `enabled: true`, does not contain `a` or `c`, and `b` no longer appears in the candidate list

#### Scenario: Re-running discovery preserves user choices
- **WHEN** a repo was previously enabled and renamed to "Beta SOC" and discovery runs again
- **THEN** the repo remains enabled with name "Beta SOC" and is not listed as a candidate

#### Scenario: Tracked repo is not offered under another spelling
- **WHEN** a repository is tracked and discovery runs with a root that reaches the same directory through a symlink or different casing
- **THEN** the repository is not listed as a candidate

#### Scenario: Disabled repo stays configured
- **WHEN** the user disables a tracked repo and saves
- **THEN** it remains in the config with `enabled: false`, keeps its name, and is not listed as a candidate

#### Scenario: Forgotten repo becomes a candidate again
- **WHEN** the user forgets a tracked repo that still exists under a workspace root, saves, and discovery runs
- **THEN** the repo is absent from the config and listed as a candidate

#### Scenario: Ignoring a path keeps tracked repos
- **WHEN** a tracked repository lies below a path the user adds to `ignorePaths`
- **THEN** the repository stays in the config and on the board

#### Scenario: A confirmed integration adds the repository
- **WHEN** the user starts an integration for `/w/acme/chat-groups` and `openspec/config.yaml` appears in it
- **THEN** it is added to the config with `enabled: true` and its default name, without the user pressing Enable for it

#### Scenario: An unconfirmed integration adds nothing
- **WHEN** the user starts an integration and no `openspec/config.yaml` appears
- **THEN** the config is unchanged and the repository is still listed as integratable

### Requirement: Settings view exposes discovery and configuration

The Settings view SHALL allow the user to add or remove scan roots, add or remove ignore paths, re-run discovery on demand, and set the poll interval. It SHALL show tracked repositories (those in the config) separately from discovered candidates: tracked repositories can be toggled, renamed and forgotten; each candidate shows its path, an individual Enable action and an Ignore action that adds the candidate's path to the ignore paths. It SHALL list integratable repositories in a third list below the candidates, under a heading that states the difference rather than implying it — candidates already use OpenSpec and are waiting to be tracked, integratable repositories do not use it yet — each showing its path, an **Integrate** action and the same Ignore action. When two or more listed repositories (tracked, candidate or integratable) share a display name, each of them SHALL show a short hint with the part of its parent path that distinguishes it. The view SHALL state that ignore paths only affect discovery. The view SHALL indicate while discovery is in progress and SHALL show per-root discovery errors. Running discovery MUST NOT save the draft configuration. Saving SHALL persist to config and trigger a scan when the set of enabled repositories changed.

#### Scenario: Enabling a repo triggers a scan
- **WHEN** the user enables a candidate and saves
- **THEN** the config is persisted and a scan starts so the repo's changes appear on the board without a manual refresh

#### Scenario: Discovery leaves unsaved edits unsaved
- **WHEN** the user changes the poll interval, then adds a workspace root, and discovery completes
- **THEN** the persisted config still has the old poll interval and old roots, and the unsaved-changes indicator is shown

#### Scenario: Root error is shown
- **WHEN** the user adds a workspace root that does not exist
- **THEN** Settings shows an error for that root next to the roots list and still lists candidates from the other roots

#### Scenario: Manual rediscover
- **WHEN** the user creates a new OpenSpec project under an existing root and clicks Rediscover
- **THEN** the new project appears as a candidate

#### Scenario: Ignoring a candidate
- **WHEN** the user clicks Ignore on a candidate
- **THEN** its path is added to the draft ignore paths, discovery re-runs, the candidate disappears, and nothing is persisted until the user saves

#### Scenario: Same-named repositories are distinguishable
- **WHEN** candidates `acme/chat-groups` and `ops/repo-mirror/repos/chat-groups` are both listed
- **THEN** one shows the hint `acme` and the other `ops/repo-mirror/repos`, and a repository with a unique name shows no hint

#### Scenario: Integratable repositories are listed apart from candidates
- **WHEN** discovery reports both candidates and integratable repositories
- **THEN** Settings shows them in two lists, the integratable one headed so that it says these repositories do not use OpenSpec yet, each row offering **Integrate** and Ignore

#### Scenario: Ignoring an integratable repository
- **WHEN** the user clicks Ignore on an integratable repository
- **THEN** its path is added to the draft ignore paths, discovery re-runs, the row disappears, and nothing is persisted until the user saves

### Requirement: Agent session settings are part of the configuration

The configuration SHALL contain an `agentSessions` object with `enabled` (default `false`), `agents` (at least one profile; default: the Claude Code profile) and `defaultAgent` (the id of one of them), and each repository entry MAY carry `agent: { enabled, agentId }` (default absent, meaning included and using the default agent; `enabled: false` excludes the repository). A profile has `id`, `name`, `command` (a non-empty list of arguments whose first element is the executable and in which `{prompt}` is the only placeholder), `prompts` (optionally one template each for `draft`, `implement`, `archive`, each containing `{change}` as its only placeholder, and optionally `integrate`, which MUST NOT contain any placeholder at all because the repository folder is the agent's working directory), and optionally `resumeCommand` and `unsetEnv`. A configuration without these fields, or carrying settings of an earlier version of this feature, MUST load: missing fields take their defaults and unknown fields are dropped. Validation MUST reject duplicate agent ids, a `defaultAgent` or a repository `agentId` that names no configured agent, an empty command, unknown placeholders, a starter prompt without `{change}`, an `integrate` prompt containing any placeholder, and any command, resume command or prompt containing a permission-bypass mode or flag.

#### Scenario: Older configuration loads
- **WHEN** the stored configuration has no `agentSessions` key, or has one written by the earlier transcript-based version
- **THEN** it loads with the Claude Code profile as the only and default agent, the stored `enabled` value kept (`false` when absent), and no repository excluded

#### Scenario: Unknown placeholder
- **WHEN** a configuration is saved with an agent prompt `/opsx:apply {change} {branch}`
- **THEN** it is rejected naming the unknown placeholder and the stored configuration is unchanged

#### Scenario: Bypass flag rejected
- **WHEN** an agent's command contains a flag that switches off the agent's permission checks
- **THEN** the configuration is rejected

#### Scenario: Repository names a removed agent
- **WHEN** a configuration is saved in which a repository selects an agent id that is not configured
- **THEN** it is rejected

#### Scenario: Integrate prompt with a placeholder
- **WHEN** a configuration is saved with an agent's `integrate` prompt containing `{change}`
- **THEN** it is rejected naming that placeholder and the stored configuration is unchanged

#### Scenario: Configuration without an Integrate prompt
- **WHEN** a configuration written before this change is loaded
- **THEN** it loads unchanged and agents without an `integrate` prompt simply offer no Integrate action

### Requirement: Settings expose agent sessions with their risks stated

The Settings view SHALL provide a section for agent sessions containing the global switch; the list of agent profiles, each editable (name, command with one argument per line, its prompts including the Integrate prompt, resume command), removable while another remains, selectable as default, and marked with whether its executable was found on this machine; a way to add a profile and to restore the Claude Code preset; and for each tracked repository a toggle that is on by default and, when more than one agent is configured, a choice of agent. The section MUST state plainly that enabling it lets the dashboard start that program on this machine, that the agent can change files and run commands as the user allows it to, that each session works in its own worktree under the dashboard home and never in a main checkout, the one exception being an integration session, which runs in the repository folder itself, and that it applies to every tracked repository unless switched off. It SHALL list worktrees created by sessions with their state. The controls below the switch MUST be inactive while it is off.

#### Scenario: Enabling and excluding one repository
- **WHEN** the user turns on the global switch, switches repository `beta-soc` off and saves
- **THEN** cards of every other tracked repository offer session starters and cards of `beta-soc` do not

#### Scenario: Adding an agent
- **WHEN** the user adds an agent, enters its command one argument per line and an Implement prompt, and saves
- **THEN** the agent is stored with that argument list, is offered in each repository's agent choice, and shows whether its executable was found

#### Scenario: Editing the Integrate prompt
- **WHEN** the user edits an agent profile's Integrate prompt and saves
- **THEN** the prompt is stored and used the next time **Integrate** is activated for that agent

#### Scenario: The in-place exception is stated
- **WHEN** the agent sessions section is shown
- **THEN** it says that sessions run in their own worktree and never in a main checkout, except an integration session, which runs in the repository folder itself

