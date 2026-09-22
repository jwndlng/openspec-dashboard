# Spec Delta

## ADDED Requirements

### Requirement: The scanner reports the presence and text of a change's prompt.md
For each change directory the scanner SHALL report whether the change has a top-level `prompt.md` file, and when it does, the file's text (bounded to a reasonable size for a tooltip). `prompt.md` is not a schema artifact and MUST NOT be counted towards artifact status. The field SHALL be reported for changes read from every checkout (main and linked worktrees) and for archived changes alike, on the same rules as other per-change facts. A failure to read the file MUST NOT fail the repository's scan; the change is reported without the prompt text and with a warning.

#### Scenario: Change with a prompt
- **WHEN** a change contains a `prompt.md` with the text "Log every mutation"
- **THEN** the change's snapshot reports the presence of the prompt and includes its text

#### Scenario: Change without a prompt
- **WHEN** a change has no `prompt.md`
- **THEN** the change's snapshot has no prompt text and reports its absence

#### Scenario: Prompt does not affect artifact status
- **WHEN** a change has only `.openspec.yaml` and `prompt.md`
- **THEN** the change's `proposal` artifact is still not done and the change appears in `New`

#### Scenario: Unreadable prompt
- **WHEN** a change's `prompt.md` cannot be read
- **THEN** the repository is reported with `ok: true`, the change carries a warning, and its prompt text is absent
