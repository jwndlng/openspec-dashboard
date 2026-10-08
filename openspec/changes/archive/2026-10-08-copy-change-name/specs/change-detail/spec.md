# Spec Delta

## ADDED Requirements

### Requirement: The detail header copies the change's reference
The detail header SHALL offer, directly after the change name, a copy control drawn as a copy icon. Activating it SHALL write the change's reference — the repository's name as the header shows it, a slash, and the change name, e.g. `demo-ops/cloud-deployment` — to the clipboard, and nothing else: no whitespace, no path, no quoting. It SHALL then show for a short while, as a check mark with the text `Copied` as its tooltip and accessible name, that the reference was copied; when the clipboard refuses the write, it SHALL NOT claim success. Because the control is an icon only, its tooltip and accessible name SHALL name what it copies (`Copy demo-ops/cloud-deployment`). The control SHALL be offered for every change the header names, including an archived change and a change gone from the snapshot whose worktree remains. It SHALL NOT shorten or move the change name or the repository link, and it SHALL NOT be mistaken for the change's next step: it is drawn as quietly as the close control. Copying writes nothing to any repository and contacts no other host.

#### Scenario: Copying the reference from the header
- **WHEN** the detail view of `cloud-deployment` in repository `demo-ops` is open and the user activates the copy icon next to the name
- **THEN** the clipboard holds exactly `demo-ops/cloud-deployment` and the icon briefly shows a check mark announced as `Copied`

#### Scenario: Named for assistive technology
- **WHEN** a screen reader reaches the copy icon in the header of `cloud-deployment` in `demo-ops`
- **THEN** it reads `Copy demo-ops/cloud-deployment`

#### Scenario: A change gone from the snapshot
- **WHEN** the header shows only the name, the repository and the close control because the change is gone but its worktree remains
- **THEN** the copy icon is still offered next to the name

#### Scenario: Clipboard refused
- **WHEN** the browser refuses the clipboard write
- **THEN** the icon does not switch to the check mark and does not announce `Copied`
