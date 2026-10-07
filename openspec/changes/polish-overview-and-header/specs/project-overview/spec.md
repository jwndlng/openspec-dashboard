# Spec Delta

## ADDED Requirements

### Requirement: Table rows keep their content inside their own cells

In the table layout every cell's content SHALL stay inside that cell at any browser zoom level and window width: no
part of a row SHALL paint over a neighbouring cell or over the row above or below. The label chips of a row (at most
three and the `+<n>` indicator, as the `project-labels` capability specifies) SHALL stay on one line, and the name
column SHALL be wide enough for the name, its badges and those chips. Each project setting control of a row SHALL keep
its text on one line inside the control, beside its switch, and SHALL keep the bordered look of the overview's other
controls — a toggle shown inactive because agent sessions are off globally with a dashed border. The same controls
SHALL look the same in a tile's **Settings** panel. Styling that belongs to another view, such as an agent profile's
header in Settings, MUST NOT change how these controls look.

#### Scenario: Zoomed table with labels
- **WHEN** a repository displays five labels and the overview is shown in the table layout at 50%, 100%, 150% and 200%
  zoom
- **THEN** at each zoom level its row shows the first three chips and `+2` on one line in the name cell, and none of
  them overlaps another chip, the **Open** column or another row

#### Scenario: Toggle text stays in the toggle
- **WHEN** a git repository with agent sessions enabled is shown as a table row, its **Docs auto-merge** toggle reading
  **Off**
- **THEN** the toggle shows its switch and **Off** on one line within its border, and nothing of it reaches into the row
  below

#### Scenario: Toggles off globally
- **WHEN** agent sessions are switched off globally
- **THEN** each row's **Agent sessions** and **Docs auto-merge** toggles are shown with a dashed border and their text on
  one line beside the switch

#### Scenario: Agent profile header unchanged
- **WHEN** Settings shows an agent profile collapsed
- **THEN** its header toggle keeps its borderless look, its hover background and its focus ring, and the overview's
  toggles are unaffected by it
