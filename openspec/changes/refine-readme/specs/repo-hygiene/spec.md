# Spec Delta

## ADDED Requirements

### Requirement: The README is an overview for people
`README.md` SHALL be written for a person deciding whether to use Spec Control, and SHALL present, in this order: the
product's name with a one- or two-sentence description of what it is; the live-demo link and board screenshot required
by the demo site; a short statement of the problem it solves; a short list of key features, one line each and at most
ten; a section explaining how the dashboard is organised in three levels — global (the projects overview and the
console), project (a repository's board and its project console) and change (a card, its detail view and its agent
session in its own worktree); the **Run** section required for release downloads, followed by first-run steps and
building from source; a brief summary of what the dashboard reads, writes and sends over the network that links to the
dashboard-api spec for the full list; a Contributing section; and the license.

The README SHALL stay an overview: it MUST NOT document individual feature edge cases, file-name lists, badge glyphs or
column rules, which belong to the built-in Help and to `openspec/specs/`, and it SHALL link to both once. Every claim it
makes SHALL be true of the current release, and its examples SHALL use only made-up names and paths.

#### Scenario: Newcomer understands the project quickly
- **WHEN** a person who has never heard of Spec Control opens the repository page
- **THEN** before the first install command they read what it is, the problem it solves, the key features as a short list and how global, project and change relate

#### Scenario: Feature detail is not in the README
- **WHEN** a reader looks for the list of technology-label marker files or the meaning of a work-status chip
- **THEN** the README does not contain it and points to the built-in Help and the specs instead

#### Scenario: Trust summary stays accurate
- **WHEN** the README's summary of what the dashboard touches is compared with the dashboard-api spec's "never writes" requirement
- **THEN** it contradicts nothing there and links to it as the complete list

### Requirement: Outside contributions start as GitHub Issues
The README's Contributing section SHALL ask people outside the project to report bugs and propose ideas as GitHub
Issues on the project's repository rather than opening pull requests, and SHALL point maintainers and agents working
on the project to `CONTRIBUTING.md` and `CLAUDE.md`. `CONTRIBUTING.md` SHALL state at its start that it describes how
the project itself is developed and that outside contributors start with an issue. `CONTRIBUTING.md` SHALL also state
that a change puts feature detail into the built-in Help and its spec, and changes the README only when a key feature,
the three-level structure, the run steps or what the dashboard touches changes.

#### Scenario: Someone wants to report a bug
- **WHEN** a user reads the README's Contributing section to report a bug
- **THEN** it links to the repository's GitHub Issues and asks for an issue rather than a pull request

#### Scenario: A feature change is documented
- **WHEN** a contributor implements a change that adds an option to an existing feature
- **THEN** `CONTRIBUTING.md` directs them to document it in the built-in Help and the spec, and the README is left unchanged
