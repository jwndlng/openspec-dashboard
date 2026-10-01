# Spec Delta

## MODIFIED Requirements

### Requirement: The overview has a header band with its actions
The projects overview SHALL open with a header band like the boards': the title `Projects`, the numbers of tracked repositories, open changes and changes to archive as labelled counts, and **New project** and **Pull all** in the band's action area. Below it, a bar SHALL hold the repository search, the **Work in progress** toggle, the `Table`/`Tiles` layout toggle as one segmented control and, in the tiles layout, the sort. Their behaviour and URL persistence are unchanged.

#### Scenario: Overview band
- **WHEN** six repositories are tracked with 36 open changes, 5 of them to archive
- **THEN** the band reads `Projects` with `Tracked 6`, `Open 36` and `To archive 5`, and **New project** and **Pull all** stand in its action area

