## MODIFIED Requirements

### Requirement: Shared OpenSpec config profiles are kept in the dashboard
The dashboard SHALL store an ordered list of shared config profiles. Each profile SHALL have a stable id (a lower-case slug matching `^[a-z0-9][a-z0-9-]{0,62}$`, unique among profiles), a display name, a `context` text and `rules` (a map from artifact id to an ordered list of rule texts). Profiles SHALL be stored in the dashboard's own home directory, written atomically, and MUST NOT be stored in any tracked repository. Saving SHALL validate ids and names, that every artifact id matches `^[A-Za-z0-9._-]+$`, that every rule is a non-empty single-line string, and that no `context` contains either marker string, `spec-control:shared` or the former `openspec-dashboard:shared`; an invalid body SHALL be rejected without changing what is stored. Saving MUST NOT write to any tracked repository and SHALL trigger a rescan. While no profile exists, no shared-config information SHALL be shown anywhere.

#### Scenario: Two profiles
- **WHEN** the user creates profiles `base` (context `We use conventional commits.`) and `security` (rule `State the data classification` for artifact `proposal`) and saves
- **THEN** both are persisted in the dashboard home in that order, no file in any tracked repository changes, and a rescan starts

#### Scenario: Invalid profile
- **WHEN** a save request contains a profile id `Not A Slug`, a duplicate id, an artifact id `../x`, a rule spanning two lines, or a context containing `spec-control:shared` or `openspec-dashboard:shared`
- **THEN** the response is `400` and the stored profiles are unchanged

#### Scenario: Nothing configured yet
- **WHEN** no profile exists
- **THEN** the overview, repository headers and snapshot carry no shared-config information

### Requirement: Shared content lives in managed sections that name their profile
When applied to a repository's `openspec/config.yaml`, a profile's content SHALL be placed in managed sections recognisable in the file itself. Its context SHALL be one block inside the `context` string, delimited by an HTML comment line starting with `<!-- spec-control:shared:begin <profile id>` (which SHALL also state that the block is managed and that edits inside it are overwritten) and the line `<!-- spec-control:shared:end <profile id> -->`. Blocks SHALL come first in the string, in the dashboard's profile order, followed by the project's own context text if any. Each of its rules SHALL be an entry carrying the trailing YAML comment `spec-control:shared:<profile id>`, placed before the project's own entries of the same artifact id, in profile order. Everything outside the managed sections is the project's own content. Sections written by earlier versions with the former prefix `openspec-dashboard:shared` in place of `spec-control:shared` SHALL be recognised as managed sections exactly like current ones, and the prefix SHALL NOT count as content when deciding whether a carried profile is in sync. The dashboard SHALL write only the current prefix: an apply that writes a file SHALL write every managed section it keeps with `spec-control:shared`, and the preview SHALL show that marker change as part of the difference; an apply to a file whose sections are in sync but carry the former prefix is therefore not reported `unchanged`. Nothing else SHALL rewrite a former marker; a repository whose file is not applied to again keeps its former markers. A file with an unmatched or mismatched marker pair (a begin and end marker with different prefixes counting as mismatched), a nested block, a marker without a profile id, or two context blocks for the same profile SHALL be treated as unreadable.

#### Scenario: Two profiles and local content side by side
- **WHEN** profiles `base` and `security` are applied to a config whose `context` is `Tech stack: Go.` and whose `rules.proposal` is `[Mention the on-call impact]`
- **THEN** `context` holds the `base` block, then the `security` block, then `Tech stack: Go.`, and `rules.proposal` lists the `base` rule, then the `security` rule (each marked with its profile id), then `Mention the on-call impact` (unmarked)

#### Scenario: Profile with rules only
- **WHEN** a profile with an empty context and one rule is applied
- **THEN** no context block is written for it and its rule entry carries its marker

#### Scenario: Malformed markers
- **WHEN** a config's `context` contains a begin marker for `base` but no matching end marker
- **THEN** the repository is `unreadable` and apply is refused for it

#### Scenario: Former markers are still recognised
- **WHEN** a repository's config carries `base` in sections marked `openspec-dashboard:shared` whose content equals the stored `base` profile
- **THEN** it reports `base` as `in-sync`, and scanning it writes nothing

#### Scenario: Applying again moves to the current marker
- **WHEN** the user applies `base` to that repository again and confirms
- **THEN** the preview showed the marker lines changing to `spec-control:shared`, and afterwards the file's `base` sections carry `spec-control:shared` and nothing else in the file changed
