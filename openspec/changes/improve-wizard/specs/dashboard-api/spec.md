# Spec Delta

## MODIFIED Requirements

### Requirement: Setup endpoints
`GET /api/setup` SHALL return `{ pending, home, suggestedRoots, platform, folderPicker }`: whether the configuration has
`setup: "pending"`, the user's home directory, the platform the server runs on (`darwin`, `linux` or `win32`, any other
reading as `linux`), which decides the install instructions the wizard shows, whether `POST /api/setup/folder` can open
a folder dialog on this machine, and the canonical paths of the folders from a fixed list of common workspace folder names —
`Workspace`, `workspace`, `Projects`, `projects`, `Developer`, `Code`, `code`, `src`, `dev`, `repos`, `git` and `GitHub`
— that exist as directories directly in the home directory, are not a configured scan root and lie neither at nor below
an ignore path, each at most once, in the list's order. It SHALL establish this with one status lookup per name, and
`folderPicker` by looking the picker's program up on the `PATH` (and, on Linux, whether a graphical session is
announced in the environment), and MUST NOT list the home directory, descend into any folder, read a file or start a
process. `POST /api/setup/done` SHALL remove `setup` from the configuration, persist it atomically under the same
one-write-at-a-time rule as the other configuration writes, and return the saved configuration; when setup is not
pending it SHALL succeed without writing. It is a mutating request under the same-origin protection and changes nothing
else in the configuration.

#### Scenario: Suggestions
- **WHEN** the home directory holds the folders `Workspace` and `Developer` and a file named `code`, and `~/Workspace` is a configured root
- **THEN** `suggestedRoots` is `[<home>/Developer]`

#### Scenario: Case-insensitive file system
- **WHEN** the file system is case-insensitive and the home directory holds `Projects`
- **THEN** `suggestedRoots` lists it once, with its on-disk spelling

#### Scenario: Folder picker available
- **WHEN** the server runs on macOS
- **THEN** `folderPicker` is `true`

#### Scenario: No graphical session
- **WHEN** the server runs on Linux with neither `DISPLAY` nor `WAYLAND_DISPLAY` set, or with neither `zenity` nor `kdialog` on the `PATH`
- **THEN** `folderPicker` is `false`

#### Scenario: Done
- **WHEN** the config has `setup: "pending"` and `POST /api/setup/done` is sent
- **THEN** the response is the config without `setup`, `GET /api/setup` returns `pending: false`, and scan roots, repositories and agent settings are unchanged

#### Scenario: Done twice
- **WHEN** `POST /api/setup/done` is sent while setup is not pending
- **THEN** the response is `200` and `config.json` is not rewritten

#### Scenario: Cross-site
- **WHEN** a page from another origin sends `POST /api/setup/done`
- **THEN** the response is `403` and the config is unchanged

## ADDED Requirements

### Requirement: Setup folder picker endpoint
`POST /api/setup/folder` SHALL open the operating system's own folder dialog on the machine the server runs on and wait
for the user's choice, then answer `{ status: "chosen", path }` with the canonical absolute path of the chosen
directory, `{ status: "cancelled" }` when the user dismissed the dialog, or `{ status: "failed", reason }` when the
dialog could not be shown or answered something that is not an existing directory. The dialog SHALL be opened with one
fixed program per platform — `osascript` on macOS, `zenity` or else `kdialog` on Linux, PowerShell on Windows — started
without a shell, with an argument list that is a constant of the server: nothing from the request SHALL reach the
command line, the environment or the standard input, and the request body SHALL be ignored apart from the same-origin
checks. The dialog SHALL start in the user's home directory. Its program SHALL run with its working directory in the
dashboard home, never inside a tracked repository. While one dialog is open, another request SHALL be answered `409`
without starting a process. A dialog left open for ten minutes SHALL be closed by ending its process and answered
`cancelled`. When no folder picker is available, as `GET /api/setup` reports it, the request SHALL be answered
`{ status: "failed", reason }` without starting a process. The endpoint SHALL write nothing — no file, no configuration —
and contact no network; the chosen path SHALL be saved only when the client later saves it through
`PUT /api/config`. It is a mutating request under the same-origin protection, because it starts a process.

#### Scenario: A folder is chosen
- **WHEN** `POST /api/setup/folder` is sent and the user picks `/w/acme` in the dialog
- **THEN** the response is `{ "status": "chosen", "path": "/w/acme" }` and the configuration is unchanged

#### Scenario: The dialog is cancelled
- **WHEN** the user dismisses the dialog
- **THEN** the response is `{ "status": "cancelled" }`

#### Scenario: One dialog at a time
- **WHEN** a dialog is open and a second `POST /api/setup/folder` is sent
- **THEN** the second response is `409` and no second process is started

#### Scenario: Nothing from the request on the command line
- **WHEN** `POST /api/setup/folder` is sent with a body naming a path and a script
- **THEN** the picker is started with exactly the server's constant arguments, and the body's content appears nowhere in its arguments, environment or input

#### Scenario: No picker available
- **WHEN** the server runs on Linux without a graphical session and `POST /api/setup/folder` is sent
- **THEN** the response is `{ "status": "failed", "reason": … }` and no process is started

#### Scenario: Cross-site
- **WHEN** a page from another origin sends `POST /api/setup/folder`
- **THEN** the response is `403` and no process is started
