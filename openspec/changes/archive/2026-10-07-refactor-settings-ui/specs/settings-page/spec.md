# Spec Delta

## ADDED Requirements

### Requirement: Sections open with a coloured headline
Every Settings section SHALL open with exactly one headline naming it, shown in the theme's brand accent colour and set apart from the section's hints and labels by a larger size and a heavier weight as well, so that the colour is never the only difference. A group within a section (for example Ignored paths, Agents, Shortcuts, Console, Projects, Repositories) SHALL have a subordinate heading: visibly smaller than the section's headline, larger or heavier than hint text, and not in the brand accent colour. Headlines and subordinate headings SHALL be exposed to assistive technology as headings of two consecutive levels. In both themes their text SHALL have a contrast ratio of at least 4.5:1 against the panel behind it, and they SHALL be drawn from the theme's tokens. The headings of views other than Settings SHALL NOT change.

#### Scenario: Section starts are recognisable
- **WHEN** the user scrolls through Settings
- **THEN** each of Workspace roots, Scanning, Agent sessions, Shared OpenSpec config and Environment starts with a headline in the accent colour, larger and heavier than the text below it

#### Scenario: Groups are subordinate to their section
- **WHEN** the Agent sessions section is shown
- **THEN** its Agents, Shortcuts, Console and Projects headings are smaller than the Agent sessions headline, not in the accent colour, and exposed as headings one level below it

#### Scenario: Readable in the light theme
- **WHEN** the active theme is `light`
- **THEN** every Settings headline and subordinate heading has a contrast ratio of at least 4.5:1 against its panel

#### Scenario: Other views keep their headings
- **WHEN** the user opens the board, the projects overview or a dialog after this change
- **THEN** their headings look as they did before
