# Spec Delta

## MODIFIED Requirements

### Requirement: Additional instructions extend an action's prompt without replacing it
A profile SHALL be able to carry **additional instructions** for each of its prompts — the session starters, Ship and Integrate — kept separately from the prompt itself. Whenever the dashboard produces the prompt of an action, it SHALL append that action's additional instructions to the prompt it would otherwise have sent, and SHALL send nothing else: the prompt template stays as configured, and additional instructions for one action MUST NOT reach another. This applies wherever that prompt is used — starting a session, sending a starter's prompt into a running session, Ship on a running or an ended session, and Integrate.

The composed text SHALL be one line: additional instructions SHALL be trimmed and any run of whitespace in them, including a line break, SHALL become a single space before they are appended, separated from the prompt by one space. Placeholders SHALL be substituted in the composed text under the rules of the prompt being extended, so additional instructions for a starter or for Ship MAY use `{change}` and MUST use no other placeholder, additional Integrate instructions MUST contain no placeholder at all, and no additional instructions may carry a permission-bypass mode or flag. Additional instructions that break these rules SHALL be refused when the configuration is saved, with a message naming the field, leaving the stored configuration unchanged.

Additional instructions SHALL be an addition, never a prompt of their own: an action whose prompt is not configured SHALL stay unavailable and its additional instructions SHALL NOT be sent anywhere. Ship, Resolve conflicts and Integrate SHALL be the exceptions in effect, because each has an agent-neutral default prompt: their additional instructions SHALL be appended to the profile's own prompt for that action, or to that action's default when the profile has none. Settings SHALL offer the additional instructions of each prompt beside that prompt, saying that the text is appended to it; empty additional instructions SHALL be stored as absent.

#### Scenario: Additional instructions reach a starter's prompt
- **WHEN** the repository's agent has the Implement prompt `/opsx:apply {change}` and additional Implement instructions `Run the linter before you finish.`, and Implement is started for change `cache-api-calls`
- **THEN** the agent receives one prompt reading `/opsx:apply cache-api-calls Run the linter before you finish.`

#### Scenario: Additional instructions extend the default Ship prompt
- **WHEN** a profile has no Ship prompt of its own but additional Ship instructions `Add the checklist from CONTRIBUTING.md to the pull request body.`, and Ship is used on a session whose work is `unpushed`
- **THEN** the text submitted to the agent is the agent-neutral default Ship prompt followed by one space and that sentence

#### Scenario: Additional instructions extend the default Integrate prompt
- **WHEN** the default agent's profile has no Integrate prompt of its own but additional Integrate instructions `Commit nothing.`, and **Integrate** is activated
- **THEN** the agent receives the agent-neutral default Integrate prompt followed by one space and `Commit nothing.`

#### Scenario: Additional instructions are one line
- **WHEN** additional Archive instructions are saved as two lines with trailing blanks
- **THEN** the composed Archive prompt is a single line in which those lines are joined by one space, so that a prompt typed into a terminal is not submitted early

#### Scenario: Additional instructions stay with their own action
- **WHEN** a profile carries additional instructions for Implement only
- **THEN** the Draft, Validate, Archive, Ship and Integrate prompts are sent exactly as they are configured

#### Scenario: Additional instructions do not make an action available
- **WHEN** a profile has no Archive prompt but additional Archive instructions, and a change is in `Done`
- **THEN** Archive is still not offered for that change, an Archive request is still refused with the reason that the agent has no Archive prompt, and the additional instructions are not sent

#### Scenario: Unknown placeholder is refused
- **WHEN** additional Implement instructions containing `{repo}` are saved
- **THEN** the response is `400` naming that field, and the stored configuration is unchanged

#### Scenario: Placeholder in additional Integrate instructions is refused
- **WHEN** additional Integrate instructions containing `{change}` are saved
- **THEN** the response is `400` naming that field, and the stored configuration is unchanged

#### Scenario: Permission bypass is refused
- **WHEN** additional Draft instructions asking the agent to run with `--dangerously-skip-permissions` are saved
- **THEN** the response is `400` naming that field, and the stored configuration is unchanged

#### Scenario: Prompt sent into a running session
- **WHEN** a session for `cache-api-calls` is running and the Implement prompt is sent into it, with additional Implement instructions configured
- **THEN** the composed prompt, including those instructions, is what is typed into the terminal under the rules for text sent on the user's behalf
