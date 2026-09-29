# Spec Delta

## MODIFIED Requirements

### Requirement: Task progress is derived from tasks.md
The scanner SHALL count task checkboxes in the change's tasks artifact, recognising `- `, `* `, `+ ` and ordered-list markers, and three checkbox states: **done** (`[x]`, case-insensitive), **awaiting validation** (`[~]`) and **open** (`[ ]`). Spacing inside the brackets SHALL NOT matter. It SHALL report `done` (the done boxes only), `awaiting` (the `[~]` boxes) and `total` (all three states together), so that `done + awaiting <= total` and a task awaiting validation is never counted as done. A marker the scanner does not recognise SHALL be counted as open, never as done. When the tasks artifact does not exist, `tasks` MUST be `null`.

`- [~]` SHALL mean that the work is finished but a person still has to confirm it. The scanner only reports it; the dashboard MUST NOT write, tick or clear a checkbox in any repository.

#### Scenario: Mixed markers
- **WHEN** `tasks.md` contains `- [x] a`, `* [ ] b`, `1. [X] c`
- **THEN** progress is `done: 2, awaiting: 0, total: 3`

#### Scenario: Tasks awaiting validation
- **WHEN** `tasks.md` contains thirteen `- [x]` tasks and two `- [~]` tasks
- **THEN** progress is `done: 13, awaiting: 2, total: 15`

#### Scenario: Awaiting is not done
- **WHEN** `tasks.md` contains `- [x] a` and `- [~] b`
- **THEN** progress is `done: 1, awaiting: 1, total: 2`, and `done` is not `2`

#### Scenario: Unknown marker
- **WHEN** `tasks.md` contains `- [-] a`
- **THEN** the task is counted as open: `done: 0, awaiting: 0, total: 1`

#### Scenario: Missing tasks file
- **WHEN** the change has no `tasks.md`
- **THEN** `tasks` is `null`

#### Scenario: A repository that never uses the marker is unaffected
- **WHEN** every task in a change is `- [x]` or `- [ ]`
- **THEN** `awaiting` is `0` and `done` and `total` are exactly what they were before this capability knew the marker
