# Spec Delta

## Purpose

Lets users start a new OpenSpec change in a tracked repository from that repository's Kanban board — creating the change directory, its schema marker and an optional free-text prompt — without leaving the dashboard.

## ADDED Requirements

### Requirement: The form takes the keyboard focus once
When the "New change" form opens, the keyboard focus SHALL move to the change name field. From then on, for as long as that form stays open, the form MUST NOT move the keyboard focus: typing in either field, the change name's live validation, a failed submission and any re-render of the board around the open form — a background poll, for example — SHALL leave the focus, the selection and the caret exactly where the user put them. Closing the form and opening it again SHALL focus the change name field again.

#### Scenario: Focus on open
- **WHEN** the user activates the "New change" action
- **THEN** the keyboard focus is in the change name field, so the name can be typed without clicking

#### Scenario: Typing in the prompt field
- **WHEN** the user clicks into the prompt field and types "Log every mutation"
- **THEN** every character reaches the prompt field and the focus stays there

#### Scenario: The board refreshes while the form is open
- **WHEN** the board re-renders while the form is open and the focus is in the prompt field
- **THEN** the focus is still in the prompt field and the caret has not moved

#### Scenario: Reopening the form
- **WHEN** the user closes the form and activates the "New change" action again
- **THEN** the keyboard focus is in the change name field again
