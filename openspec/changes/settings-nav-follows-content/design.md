## Context

After `add-settings-nav`, Settings is laid out as a grid inside `.main`: `nav.settings-nav` (left column, not scrolling) and `div.settings` (right column, `overflow: auto`, the only scroll container), with the sticky `.savebar` below. `useSectionNav` listens to `scroll` on `.settings`, measures section tops relative to it, and after each change of the current section calls `scrollIntoView({ block: "nearest", inline: "nearest" })` on the current nav entry so it stays visible in the narrow-screen row.

Measured with real wheel events in Chrome: the nav stays at a fixed position, the document never scrolls, and a wheel gesture over the nav or the page margins does nothing. The maintainer wants the opposite feel: the navigation is part of the page and moves with it.

## Goals / Non-Goals

**Goals:**

- One scroll for the whole Settings page; the navigation scrolls away with the sections on wide and narrow screens alike.
- Wheel/trackpad scrolling works wherever the pointer is below the top bar.
- Jumping, focus handling, the current-section marker, counts and `?section=` deep links keep working unchanged.
- No code path may scroll the page as a side effect of updating the marker.

**Non-Goals:**

- A "back to top" / "back to navigation" control, or a floating mini-navigation once the nav is out of view (can be added later if scrolling back up turns out to be annoying).
- Making the navigation optionally sticky via a setting.
- Changing the save bar, the top bar or any panel.
- Letting the document itself scroll (the app shell stays a fixed-height flex column; other views rely on it).

## Decisions

### D1. A full-width scroll wrapper contains both the nav and the sections

```
.main
├─ .settings-scroll           flex: 1; min-height: 0; overflow: auto   ← the one scroll container, full width
│  └─ .settings-layout        centred grid (nav | sections), max-width 1320px, align-items: start
│     ├─ nav.settings-nav     in flow; no overflow of its own
│     └─ .settings            panel grid; no overflow
└─ .savebar                   unchanged, pinned below
```

Because the wrapper spans the full width, the scrollbar sits at the window edge and the side margins scroll too. `align-items: start` keeps the nav at its natural height at the top of the grid, so it leaves the view with the first screenful.

*Alternative — make `.settings-layout` itself the scroll container*: one element less, but the layout is centred with a max-width, so the scrollbar would float inside the page and the margins would stay dead zones. *Alternative — let the document scroll*: the app shell is a fixed-height column (`.app { height: 100% }`) and the board and overview depend on that; changing it for one view is a much larger change.

### D2. The same rule on narrow screens

Below 720px the nav is a horizontal row above the sections. It also scrolls away rather than staying pinned: one rule for all widths, matching the request, and it gives the full height of a small screen to the settings themselves. Pinning the row on narrow screens only would be a one-line `position: sticky` later if wanted.

### D3. Tracking keeps running while the nav is out of view

`useSectionNav` is pointed at `.settings-scroll` instead of `.settings`; the measurement (section tops relative to the scroll container's top, the 96px line, the end-of-scroll rule, the pin after a jump) is unchanged. The marker is not visible once the nav has scrolled away, but the current section still drives `?section=`, so a reload or a shared link lands in the same place, and the marker is already correct when the user scrolls back up.

With the nav in the flow, the first section no longer starts at the very top on narrow screens (the row is above it). The measurement is relative to the container, and the first section is the default when nothing has reached the line, so "Workspace roots" is still current at the top.

### D4. Keeping the current entry visible must never scroll the page

Today's `entry.scrollIntoView(...)` scrolls every scrollable ancestor that is needed to reveal the entry. While the nav was pinned that could only be the row itself. Once the nav can be out of view, the same call would drag the page back up to the navigation every time the current section changes during scrolling — the page would fight the user. The effect is replaced by a horizontal-only adjustment of the row: a pure helper computes the new `scrollLeft` from the row's and the entry's horizontal extents (no change when the entry is already fully visible; otherwise the smallest shift that reveals it), and the effect assigns `list.scrollLeft`. Nothing else calls `scrollIntoView` on navigation elements. Jumps keep using `scrollIntoView` on the *section*, which is the intended page scroll.

### D5. Focus and scroll margin

Unchanged: a user jump focuses the section wrapper with `preventScroll`; `scroll-margin-top` on the wrappers keeps a little air above a jumped-to section. The nav column gets `padding-top` equal to the sections' so the first entry lines up with the first panel.

## Risks / Trade-offs

- [After a jump the navigation is gone until the user scrolls back up — for hopping between distant sections this is more work than before] → accepted by the maintainer's choice; the pinned behaviour is one `position: sticky` away, and a "back to top" affordance is listed as a non-goal to revisit.
- [A lurking `scrollIntoView` on nav elements would make the page jump while scrolling] → D4 removes the only one; a test asserts `settingsNav.tsx` contains `scrollIntoView` only for the section target.
- [The scroll listener moves to a different element; if the ref is attached to the wrong node the marker silently stops updating] → verified with real wheel events over CDP (the same script used to measure today's behaviour): marker and `?section=` must change while the nav's position changes with the scroll.
- [`settings-page` is not in `openspec/specs/` until `add-settings-nav` is archived] → archive that change first; this change's deltas are MODIFIED-only and would otherwise have nothing to modify.

## Migration Plan

1. Archive `add-settings-nav` (syncs the `settings-page` spec).
2. Land this change. Rollback is reverting the CSS wrapper and the ref move; no data or URLs are affected (`?section=` is unchanged).
