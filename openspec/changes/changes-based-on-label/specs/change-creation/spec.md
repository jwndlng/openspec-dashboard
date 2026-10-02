## ADDED Requirements

### Requirement: The combined board's form can target repositories by label
The form opened from the combined board SHALL offer two ways to choose where the change is created: **One project**,
the project dropdown specified in "The combined board's form asks for the project", and **By label**. One project SHALL
be the default. In By label mode the form SHALL offer every label displayed on at least one tracked repository, ignoring
case, as the project-labels capability defines displayed labels, and SHALL let the user select one or more of them.
The form SHALL then list every tracked repository that displays all selected labels, ignoring case, in the order the
board lists repositories, each with a checkbox. An eligible repository's checkbox SHALL start checked; a repository that
is not eligible SHALL be listed without a usable checkbox and with the reason it is skipped as text. The form MUST NOT
allow submission while no label is selected or no repository is checked, saying which as text, and SHALL state on the
submit action how many repositories the change will be created in. The change name and prompt fields, their live
validation and the focus rule SHALL be the same as in One project mode. Switching mode, selecting labels or checking
repositories MUST NOT write anything.

#### Scenario: Repositories carrying the label are listed
- **WHEN** `alpha-infra` and `demo-ops` display `terraform`, `beta-soc` does not, and the user selects `terraform` in By label mode
- **THEN** the form lists `alpha-infra` and `demo-ops`, both checked, and not `beta-soc`, and the submit action says `Create in 2 projects`

#### Scenario: Several labels combine with AND
- **WHEN** the user selects `terraform` and `client` and only `alpha-infra` displays both
- **THEN** only `alpha-infra` is listed

#### Scenario: A repository that cannot take the change
- **WHEN** `gamma-web` displays `terraform` and its last scan failed
- **THEN** `gamma-web` is listed unchecked with a reason saying its last scan failed, and it cannot be checked

#### Scenario: Unchecking a repository
- **WHEN** `alpha-infra` and `demo-ops` are listed and the user unchecks `demo-ops`
- **THEN** the submit action says `Create in 1 project`

#### Scenario: Nothing to create into
- **WHEN** the user is in By label mode and has selected no label, or has unchecked every listed repository
- **THEN** the submit action is disabled and a message says what is missing

### Requirement: Creating by label creates the change in every checked repository
On submit in By label mode the form SHALL send `POST /api/repos/<id>/changes` with the same `{ name, prompt? }` once for
each checked repository, one request at a time, in the listed order — exactly the request the One project mode sends,
so everything the server does, stages and refuses for each repository is unchanged. A refusal for one repository MUST
NOT stop the requests for the others, and nothing created SHALL be removed because another repository refused. While
the requests run the form SHALL show which repository is in progress and SHALL NOT close by Escape, a click on the
backdrop, its close control or **Cancel**. When every request has finished the form SHALL stay open and show one result
per repository: created, with whether it was staged, or refused, with the server's reason as text. The board SHALL be
refreshed once all requests have finished, so every created change appears without a page reload. Closing the form
after that SHALL NOT send anything.

#### Scenario: Created in every repository
- **WHEN** `alpha-infra` and `demo-ops` are checked and the user submits `bump-terraform-1-9` with the prompt "Bump the required Terraform version to 1.9"
- **THEN** one `POST /api/repos/<alpha-infra id>/changes` and then one `POST /api/repos/<demo-ops id>/changes` are sent, each with `{ "name": "bump-terraform-1-9", "prompt": "Bump the required Terraform version to 1.9" }`, both results say created, and both changes appear in the `Backlog` column after the refresh

#### Scenario: One repository refuses
- **WHEN** `demo-ops` already has a change `bump-terraform-1-9` and the user creates it by label in `alpha-infra` and `demo-ops`
- **THEN** `alpha-infra`'s result says created, `demo-ops`'s result shows the message naming the clash, and the change in `alpha-infra` is kept

#### Scenario: Not staged
- **WHEN** one of the checked repositories is not a git repository
- **THEN** its result says created and not staged

#### Scenario: Busy while creating
- **WHEN** the requests are still running and the user presses Escape
- **THEN** the form stays open until every request has finished

### Requirement: The projects overview offers a new change for its label filter
While the projects overview's label filter holds at least one label and at least one listed repository is eligible,
the overview SHALL offer **New change in these projects**. Activating it SHALL open the New change dialog in By label
mode with the filter's labels selected, listing the repositories as the "The combined board's form can target
repositories by label" requirement specifies, and MUST NOT write anything. Everything that form does on submit SHALL be
as the "Creating by label creates the change in every checked repository" requirement specifies. The action SHALL NOT
be shown while the label filter is empty.

#### Scenario: Opening from the filter
- **WHEN** the overview is filtered by `terraform` and lists `alpha-infra` and `demo-ops`, and the user activates **New change in these projects**
- **THEN** the New change dialog opens in By label mode with `terraform` selected and `alpha-infra` and `demo-ops` checked, and nothing has been written

#### Scenario: No label filter
- **WHEN** the overview's label filter is empty
- **THEN** the overview does not show **New change in these projects**
