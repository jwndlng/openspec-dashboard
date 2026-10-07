# Prompt

Two pieces of feedback on the side navigation.

1. Settings: when you scroll down, the left menu (Workspace roots, Scanning, Agent sessions, Shared OpenSpec config, Environment) suddenly jumps to the bottom, which looks like an animation glitch. Cause: `useSectionNav` (src/ui/settingsNav.tsx ~94) treats the last 2px of scroll as `atEnd`, and `currentSection` (src/ui/settingsSections.ts ~49) then makes the short last section current. `navOffset` (~72) places the nav level with that section's top, far down the view, so the nav glides to the bottom. Scrolling up 2px flips it back. Also, `top` is re-set on every scroll frame while `data-glide` is on, so the 220ms transition keeps restarting and lags. Fix: at the end, keep highlighting the last entry but place the nav by the section that is really at the top of the view (or by the view top). Make the nav track scroll without restarting the transition on every frame. Update the settings-page requirements that describe the glide and the last section accordingly.

2. Help: reuse the same side menu as Settings instead of the wrapped chip TOC that scrolls away (src/ui/help.tsx, `.help-toc`). Help already uses `useSectionNav`, so only the rendering differs. Generalise `SettingsNav` and `SettingsSections`: the section id prefix from `page.prefix` instead of the hard-coded `settings-`, the scroller and section selectors, the aria-label, and the base path (`/settings` vs `/help`, where Help keeps the other query params). Give Help the same two-column layout and the same narrow-screen row variant. Update the help-page spec. Deep links (`?section=`) must keep working on both pages.

Note: the in-flight change refactor-settings-ui changes section headings and heights but not the nav. Rebase on it if it lands first.
