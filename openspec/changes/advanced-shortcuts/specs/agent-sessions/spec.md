# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Default responses can be sent to a running session`
- TO: `### Requirement: Configured shortcuts can be sent to a running session`

## MODIFIED Requirements

### Requirement: Configured shortcuts can be sent to a running session
The session panel SHALL offer the configured shortcuts next to the terminal, in their configured order. A shortcut is a
**title**, shown on its control, and a **prompt**, which is the text sent to the agent; the two are independent and the
title SHALL NOT be sent. The shortcuts SHALL be preceded by the visible label `Shortcuts:`, which is not itself a
control and SHALL serve as the accessible name of the group. Activating a shortcut SHALL send it to the agent with one
activation: exactly its prompt SHALL be submitted to the agent's terminal under the rules for text sent on the user's
behalf, so that it is submitted where the agent shows a text prompt and is only typed, never confirmed, where it does
not. The dashboard MUST NOT add to or alter the prompt, MUST NOT substitute anything into it, and MUST NOT interpret the
agent's output to decide which shortcuts to offer. Shortcuts SHALL be offered only while the session is running and its
terminal is connected, and SHALL be the same for every kind of session and every agent profile. Each shortcut SHALL
state, as its tooltip or accessible description, the prompt that will be sent. When no shortcuts are configured, neither
the label nor any control SHALL be shown. After activation, keyboard focus SHALL return to the terminal, and the same
shortcut MUST NOT be sent a second time while its first activation is still in progress. When a prompt was typed but not
submitted, the panel SHALL say so next to the shortcuts. Typed input SHALL keep working exactly as before.

#### Scenario: One click answers the agent
- **WHEN** a session is running, the agent waits at its text prompt, and the user activates the shortcut titled `Yes, go ahead` whose prompt is `Yes, go ahead`
- **THEN** the agent receives `Yes, go ahead` as a submitted answer without any further key press, and keyboard focus is in the terminal

#### Scenario: The title is not the prompt
- **WHEN** a shortcut titled `Ship it` has the prompt `Commit the work, push the branch and open a pull request; ask me before force-pushing.` and the user activates it
- **THEN** the agent receives exactly that prompt as a submitted answer, the title is sent nowhere, and the control shows `Ship it` with the prompt as its tooltip

#### Scenario: A response never confirms a menu
- **WHEN** the agent shows a selection menu with an option highlighted and the user activates any shortcut
- **THEN** no Enter is sent, the highlighted option is not confirmed, the session keeps running, and the panel says that the text was typed but not sent

#### Scenario: The set and its order
- **WHEN** the configuration lists the shortcuts `Review`, `Yes, go ahead` and `No, stop here` in that order and the panel of a running, connected session is open
- **THEN** it offers exactly those three, in that order, and no others

#### Scenario: Nothing configured
- **WHEN** the configured list of shortcuts is empty and the panel of a running, connected session is open
- **THEN** no shortcut controls and no `Shortcuts:` label are shown, and typing into the terminal still works

#### Scenario: The row is labelled
- **WHEN** the panel of a running, connected session is open and at least one shortcut is configured
- **THEN** the label `Shortcuts:` is shown in front of the first shortcut, activating it sends nothing, and assistive technology announces the group as "Shortcuts"

#### Scenario: Asking the agent to resolve conflicts
- **WHEN** a session is running, the agent waits at its text prompt, and the user activates the shortcut whose prompt is `Resolve PR conflicts`
- **THEN** the agent receives exactly `Resolve PR conflicts` as a submitted answer, and the dashboard runs no git command and contacts no remote because of it

#### Scenario: Not offered when the session is not running
- **WHEN** the agent has exited, or the session failed to start
- **THEN** no shortcuts and no `Shortcuts:` label are shown

#### Scenario: Not offered while disconnected
- **WHEN** the session is running but the panel's terminal connection is not open
- **THEN** no shortcuts are offered until the terminal is connected again

#### Scenario: Double activation
- **WHEN** the user double-clicks a shortcut
- **THEN** the agent receives its prompt once

#### Scenario: Keep typing
- **WHEN** the user has sent a shortcut and then types on the keyboard without clicking anything
- **THEN** the keystrokes go to the terminal

#### Scenario: Any agent
- **WHEN** the session runs an agent from a user-defined profile rather than the preconfigured one, or is the main console or an Integrate session
- **THEN** the same configured shortcuts are offered and sent in the same way

## ADDED Requirements

### Requirement: Shortcuts are configurable, with the shipped set as the default
Shortcuts SHALL be part of the dashboard's own configuration, not built in. Each SHALL have a stable identifier, a
title and a prompt. The configuration SHALL be accepted only when every title is non-empty after trimming and short
enough to read on a control, every prompt is non-empty after trimming and a **single line** without control characters,
every identifier is unique, and no prompt carries permission-bypass wording — the same rule that applies to every other
prompt the dashboard sends to an agent. A prompt SHALL support no placeholder: it is sent exactly as written. An empty
list SHALL be valid. A configuration that does not mention shortcuts at all — every configuration saved before they
became configurable — SHALL be read as carrying the shipped defaults, which SHALL be, in this order, `Yes, go ahead`,
`Yes, create a PR`, `Resolve PR conflicts` and `No, stop here`, each with its title as its prompt. A user's saved list
SHALL never be replaced or extended by the dashboard, not even when the shipped defaults change.

#### Scenario: A configuration from before shortcuts were configurable
- **WHEN** the dashboard loads a saved configuration that has no shortcuts
- **THEN** the loaded configuration carries the four shipped defaults in their order, and the console offers exactly them

#### Scenario: A saved list is left alone
- **WHEN** a saved configuration lists two shortcuts of the user's own and none of the shipped ones
- **THEN** the loaded configuration carries exactly those two, and no default is added back

#### Scenario: An empty list is kept
- **WHEN** the user saves a configuration with no shortcuts
- **THEN** it is accepted and reloading the dashboard still shows no shortcuts

#### Scenario: A prompt spanning several lines is refused
- **WHEN** a configuration is saved with a shortcut whose prompt contains a line break
- **THEN** the save is refused with a message naming that shortcut's prompt, and the stored configuration is unchanged

#### Scenario: An empty title is refused
- **WHEN** a configuration is saved with a shortcut whose title is blank or only spaces
- **THEN** the save is refused and the stored configuration is unchanged

#### Scenario: Bypass wording is refused
- **WHEN** a configuration is saved with a shortcut prompt that tells an agent to skip its permission checks
- **THEN** the save is refused, exactly as for an agent's other prompts

### Requirement: Shortcuts are edited in the Agent sessions settings
The Settings page SHALL let the user manage shortcuts within its **Agent sessions** section, without adding a section of
its own. The section SHALL list the configured shortcuts in their order and allow, for each, editing its title and its
prompt, removing it, and moving it earlier or later in the order; it SHALL allow adding a shortcut and restoring the
shipped defaults. The prompt SHALL be presented as the text that will be sent to the agent and the title as what the
control will read. Edits SHALL take part in the page's single draft and save bar like every other setting: they survive
navigating between sections, count towards "unsaved changes", and reach the configuration only when the page is saved.
A refused save SHALL keep the user's edits in the page and say what is wrong.

#### Scenario: Editing a title and a prompt
- **WHEN** the user renames a shortcut to `Ship it`, replaces its prompt with two sentences on one line, and saves
- **THEN** the configuration carries that title and prompt, and the console's control reads `Ship it` and sends the prompt

#### Scenario: Adding a shortcut
- **WHEN** the user adds a shortcut, gives it a title and a prompt, and saves
- **THEN** it appears last in the console's shortcuts and sends its prompt

#### Scenario: Reordering
- **WHEN** the user moves the last shortcut to the first position and saves
- **THEN** the console offers the shortcuts in the new order

#### Scenario: Removing all of them
- **WHEN** the user removes every shortcut and saves
- **THEN** the save is accepted and the console shows no shortcut row

#### Scenario: Restoring the defaults
- **WHEN** the user has changed the shortcuts, activates the restore control, and saves
- **THEN** the configuration carries exactly the four shipped defaults in their order

#### Scenario: Edits survive navigation
- **WHEN** the user edits a shortcut's prompt, navigates to another section and back
- **THEN** the edited prompt is still in the field and the save bar still shows "unsaved changes"
