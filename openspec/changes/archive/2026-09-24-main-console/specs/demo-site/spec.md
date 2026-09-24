## ADDED Requirements

### Requirement: The main console is simulated in the demo
While agent sessions are enabled in the demo, the top bar SHALL show the main console control. Opening the console
SHALL create a console session in memory, subject to the same one-at-a-time rule, and its terminal SHALL play a short
hand-written, vendor-neutral transcript under the same rules as every demo transcript: labelled as a recording,
continuing on a line of input, and ending as an exited agent. The console's folder in the demo SHALL be under
`/home/demo/`. The demo MUST NOT start a process, open a network connection or write anywhere for it.

#### Scenario: Opening the demo console
- **WHEN** the visitor activates the main console control in the demo
- **THEN** the console overlay opens and its terminal starts with the line saying it is a demo recording

#### Scenario: Reopening
- **WHEN** the visitor closes the demo console's overlay and opens it again while the transcript is still playing
- **THEN** the same session is shown with its earlier output

#### Scenario: Nothing leaves the page
- **WHEN** the demo console is opened, answered and ended
- **THEN** no process is started and no network request is made
