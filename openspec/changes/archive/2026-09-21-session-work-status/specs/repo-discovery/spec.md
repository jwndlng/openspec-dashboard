## ADDED Requirements

### Requirement: An agent profile may carry a Ship prompt
An agent profile MAY contain a `ship` prompt next to its starter prompts. It is validated like them except that the `{change}` placeholder is optional. Settings SHALL offer it for editing and show the default that applies when it is empty. Configs without it MUST load unchanged.

#### Scenario: Existing config
- **WHEN** a config written before this change is loaded
- **THEN** it loads without warning and Ship uses the default prompt

#### Scenario: Bypass flag in a Ship prompt
- **WHEN** a config's Ship prompt contains a permission-bypass flag
- **THEN** the config is rejected like any other prompt containing one
