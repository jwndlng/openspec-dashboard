## Why

Settings has grown from three panels to six — Workspace roots, Tracked repositories, Discovered, Scanning, Agent sessions and Shared OpenSpec config — stacked in one long scrolling column. With 17+ tracked repositories the second panel alone fills the screen, so everything after it (the newly discovered repositories you came to enable, the poll interval, the agent and shared-config panels) is somewhere below the fold with nothing telling you it exists or how to get there. More sections are on the way (`create-change-from-dashboard`, `add-change-detail-view`).

## What Changes

- Add a **section navigation on the left** of the Settings page listing every section in page order. Clicking an entry scrolls that section to the top of the view and moves keyboard focus to it.
- The navigation **stays visible** while the sections scroll, and **highlights the section currently in view**, so it doubles as a "where am I" indicator.
- Settings remains **one page with one draft**: the navigation jumps, it does not switch tabs. The existing save bar, the "unsaved changes" state and the panels that save on their own (Shared OpenSpec config) keep working exactly as today, and browser find-in-page still searches all settings.
- Entries show a **count where it tells you whether a visit is worthwhile**: tracked repositories (enabled of total) and discovered-but-untracked repositories, the latter emphasised when it is not zero.
- The current section is **reflected in the URL** (`?section=discovered`), so a section can be linked to or reloaded into, in both the normal (path) and the demo (hash) routing modes. Opening Settings without a section starts at the top as today.
- On **narrow screens** the navigation becomes a horizontally scrolling row above the sections instead of a left column.
- The page is driven by **one list of sections** (id, label, optional count, content): the navigation and the panels are both rendered from it, so a new settings panel cannot be added without getting its navigation entry.

## Capabilities

### New Capabilities
- `settings-page`: The structure of the Settings page — the list of sections, the section navigation (jumping, current-section highlight, counts, keyboard and screen-reader behaviour), section deep links, the single-page/single-draft rule and the narrow-screen layout. No existing spec owns the page's layout; `repo-discovery`, `shared-config` and the agent-session requirements describe what individual panels do and are not changed.

### Modified Capabilities

_None._ The behaviour of the individual panels, the config format and the API are unchanged.

## Impact

- `src/ui/settings.tsx`: two-column layout; each panel wrapped as a named section; the nav component and the in-view tracking (`IntersectionObserver`, no dependency).
- `src/ui/agentSettings.tsx`, `src/ui/sharedConfig.tsx`: their top-level panels take part as sections (id + label); inner sub-headings are not navigation entries.
- `src/ui/url.ts` users only — the section is read and written through the existing `currentQuery()` / `replaceQuery()` helper, so hash-mode (demo) and path-mode behave the same; a small pure parser/serialiser for the `section` parameter with unit tests.
- `src/ui/styles.css`: nav column, sticky positioning, active/emphasised entry styles from existing tokens (both themes), narrow-screen row.
- `src/ui/demo/`: no change expected; the demo's Settings gets the navigation for free and is a convenient place to verify it. Screenshots are of the board and overview, so they do not change.
- `README.md`: one sentence in the Settings description.
- No server, API, config-file or dependency changes.
