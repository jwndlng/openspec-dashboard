# Spec Delta

## ADDED Requirements

### Requirement: Session tabs read as tabs
Every tab in the dock's tab strip SHALL be drawn as a tab of its own — with a background and an outline that set it apart from the strip behind it — whether or not its session is shown, and a tab's repository accent SHALL sit on the tab's own edge. A tab whose session is shown SHALL differ from a tab whose session is not shown by shape as well as by the existing mark and by colour. The focused tab SHALL be marked more strongly than the other shown tabs, in a way that does not rely on colour alone and is distinguishable from every assignable repository colour. The strip SHALL leave enough room that a tab's mark, repository name, change name and badge sit on one line with space around them, and the space the page reserves for a collapsed dock SHALL equal the strip's height. The tabs SHALL keep the content, order, marks, repository colours, legibility and keyboard behaviour the other requirements give them.

#### Scenario: A tab that is not shown
- **WHEN** two sessions are running and only one of them is shown
- **THEN** the other session's tab has its own visible background and outline against the strip, with its repository accent on the tab's edge

#### Scenario: Shown and not shown differ in shape
- **WHEN** one session is shown and another is not
- **THEN** the shown tab is visibly joined to the panes below the strip and the other tab is not, in addition to their ▣ and ▢ marks

#### Scenario: Focused tab among shown tabs
- **WHEN** three sessions are shown and the keyboard focus is in the second pane
- **THEN** the second pane's tab carries a stronger marking than the other two shown tabs — more than a change of colour — and that marking stays visible on a tab with a repository colour

#### Scenario: Collapsed dock
- **WHEN** the dock is collapsed to its tab strip
- **THEN** every tab is fully visible and no part of the board is hidden behind the strip
