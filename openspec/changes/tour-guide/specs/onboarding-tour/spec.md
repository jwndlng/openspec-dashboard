# Spec Delta

## Purpose

Introduces a first-time visitor to the dashboard with a short, skippable walkthrough of its main controls and views,
shown once per browser and available again on request from the Help page.

## ADDED Requirements

### Requirement: The tour starts on the first visit in a browser
When the dashboard is loaded in a browser that has no record of the tour having been finished or skipped, the tour
SHALL start by itself once the hero and the main navigation are rendered, on whatever route was opened. It SHALL NOT
start while the change detail view, the main console or an integration terminal is open; it SHALL then start once
none of them is open. It SHALL start at most once per page load by itself. Starting, showing and ending the tour
MUST NOT make any server request, start any process, or write to any repository or to the server configuration.

#### Scenario: First visit
- **WHEN** a user opens the dashboard for the first time in a browser
- **THEN** the tour starts at its first step

#### Scenario: Returning visitor
- **WHEN** a user who finished or skipped the tour reloads the dashboard
- **THEN** the tour does not start

#### Scenario: First visit straight into a change
- **WHEN** a first-time visitor opens a link to a change's detail view
- **THEN** the tour does not start until the detail view is closed

#### Scenario: Tour makes no requests
- **WHEN** the tour is started, stepped through and finished
- **THEN** no API request is made because of it

### Requirement: The tour walks through the main controls one at a time
The tour SHALL be an ordered list of steps. The first step SHALL welcome the user and say what the dashboard is for,
centred on the page; the last step SHALL point to the Help tab and say the tour can be taken again from there. The
steps between SHALL each point to one control that is on screen and explain it in at most two sentences, covering in
this order: the Projects tab, the All changes tab, the Activity tab, the Pull requests tab, the Settings tab, the
Console control, the Refresh and auto-refresh controls, and the theme control. A step whose control is not rendered
when the tour reaches it — for example the Console control while agent sessions are disabled — SHALL be left out and
SHALL NOT be counted. Each step SHALL show its position as "n of m" counting only the steps that are shown. The step
pointed at SHALL be visibly highlighted while the rest of the page is dimmed, and the explanation SHALL be placed
next to it without covering it and within the viewport, scrolling the control into view first if needed. The
highlight and placement SHALL follow window resizes.

#### Scenario: Console step left out
- **WHEN** agent sessions are disabled and the tour reaches the Console step
- **THEN** that step is skipped and the step count does not include it

#### Scenario: Position shown
- **WHEN** the tour shows its third of eight steps
- **THEN** the step reads "3 of 8"

#### Scenario: Narrow window
- **WHEN** the window is 400px wide and a step points at a control in the hero
- **THEN** the explanation is fully inside the viewport and the control stays visible

### Requirement: The tour can be stepped, skipped and finished
Every step SHALL offer **Next** (on the last step **Done**) and, except on the first step, **Back**, and every step
SHALL offer **Skip tour**. Pressing Escape SHALL end the tour as Skip tour does; the arrow keys Right and Left SHALL
act as Next and Back. Finishing or skipping SHALL record in the browser that the tour was seen, so it does not start
by itself again, and SHALL return keyboard focus to the element that had it before the tour started, or to the page
when there was none. While the tour is shown the page behind it SHALL NOT receive clicks or keyboard focus, and the
tour SHALL be exposed to assistive technology as a dialog whose name says it is the tour and whose content is the
current step's text. Navigating to another route while the tour runs SHALL end it as Skip tour does.

#### Scenario: Skip
- **WHEN** the user activates **Skip tour** on the second step
- **THEN** the tour closes and does not start again on reload

#### Scenario: Escape
- **WHEN** the user presses Escape during the tour
- **THEN** the tour closes as if skipped

#### Scenario: Finish
- **WHEN** the user activates **Done** on the last step
- **THEN** the tour closes, focus returns to where it was, and the tour does not start again on reload

#### Scenario: Back
- **WHEN** the user activates **Back** on the third step
- **THEN** the second step is shown

### Requirement: The "tour seen" record lives in the browser only
Whether the tour was seen SHALL be stored in the browser's `localStorage` under a key of the dashboard's own, and
SHALL NOT be written to the server configuration, the URL or any repository. An unrecognised stored value SHALL be
treated as not seen. If `localStorage` is unavailable, the tour SHALL start by itself on every page load, SHALL still
work, and no error SHALL be shown.

#### Scenario: Storage unavailable
- **WHEN** `localStorage` access throws
- **THEN** the tour starts on load, can be finished, and no error is shown

#### Scenario: Corrupt stored value
- **WHEN** the stored tour value is `"maybe"`
- **THEN** the tour starts as on a first visit

### Requirement: The tour can be taken again
The Help page SHALL offer **Take the tour**, which SHALL start the tour from its first step whether or not it was
seen before. Taking the tour again SHALL follow the same rules for steps, skipping and finishing.

#### Scenario: Restart from Help
- **WHEN** a user who finished the tour activates **Take the tour** on the Help page
- **THEN** the tour starts at its first step

### Requirement: The demo does not start the tour by itself
In the demo build the tour SHALL NOT start by itself on load, so that the first view and the screenshots produced
from the demo build show the dashboard without it. **Take the tour** on the demo's Help page SHALL start it as in the
dashboard.

#### Scenario: Demo first load
- **WHEN** a visitor opens the demo for the first time
- **THEN** no tour is shown

#### Scenario: Demo tour on request
- **WHEN** a demo visitor activates **Take the tour** on the Help page
- **THEN** the tour starts at its first step
