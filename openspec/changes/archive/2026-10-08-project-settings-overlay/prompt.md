# Prompt

The Projects overview is overloaded: every table row (and every tile, in short form) shows the project settings inline. Those are the Agent sessions toggle, the agent picker, the PR titles picker and the Docs auto-merge toggle (`AgentControls` in src/ui/overview.tsx ~149, `SettingLine` for tiles, src/ui/projectSettings.tsx).

Move them into a project settings dialog. Each table row AND each tile gets a gear (settings) icon button. It opens an overlay (reuse src/ui/modal.tsx) holding exactly those settings, with the same behaviour, wording and switch roles as today, including the off-globally state that links to Settings. The project console button stays in the row/tile: it is an action, not a setting. The gear needs an accessible name that includes the project name. The dialog closes with Escape and returns focus to the gear.

Spec: project-overview's "Each managed project carries its own settings on the overview" currently says a row offers these settings inline. Change it to the dialog, for both layouts. Check the onboarding tour (src/ui/tour.tsx) and the demo for anchors that point at the inline controls. Depends on polish-overview-and-header, which touches the same toggles and CSS.
