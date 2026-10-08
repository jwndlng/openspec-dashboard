# desktop-app Specification

## Purpose

Defines the macOS desktop app: a thin application shell that runs the same `spec-control` binary as the command line,
shows it in its own window — without changing what the server does or adding network access.

## Requirements

### Requirement: The app is for Apple silicon Macs
The app SHALL be built for macOS on Apple silicon (`darwin-arm64`) and SHALL require the oldest macOS version its framework supports, stated in the README. Intel Macs SHALL keep being served by the `darwin-x64` command-line binary, which the README SHALL name as their way to run Spec Control.

#### Scenario: Intel Mac user
- **WHEN** a user on an Intel Mac reads the README's Run section
- **THEN** it tells them to use the `darwin-x64` binary instead of the app

### Requirement: The app runs the bundled binary and adds no server of its own
The app SHALL bundle the `spec-control` binary built from the same release and SHALL serve the dashboard only by running that binary as a child process with `--no-open`, on the port the binary would use when started from the command line (its configured port, default 4711). The app MUST NOT serve the UI or the API itself, MUST NOT pass the binary any option that changes what the server reads, writes or contacts, and MUST NOT bind any port of its own. Everything the dashboard-api capability guarantees about the server SHALL hold unchanged inside the app.

#### Scenario: First launch
- **WHEN** the user opens the app and nothing listens on port 4711
- **THEN** the bundled binary is started with `--no-open`, and the app window shows the dashboard once `GET /api/version` answers

#### Scenario: Same home as the command line
- **WHEN** the user has tracked repositories with the command-line binary and then opens the app
- **THEN** the app shows the same projects, settings and session history, read from the same `~/.spec-control/`

#### Scenario: The server fails to start
- **WHEN** the bundled binary exits before `GET /api/version` answers
- **THEN** the app shows a window stating that the server could not start, with the binary's last output and a Retry action, and starts nothing else

### Requirement: The app reuses a running Spec Control and never takes over another program's port
Before starting the binary the app SHALL request `GET /api/version` on the configured loopback port. When a Spec Control answers, the app SHALL show that server instead of starting its own, SHALL say in its window that it is attached to a server started elsewhere and which version it runs, and MUST NOT stop that server when it quits. When the port is held by anything else, the app MUST NOT start the binary on another port and MUST NOT stop the other program; it SHALL show which port is taken and how to choose another one. Only one instance of the app SHALL run at a time; opening it again SHALL bring the existing window forward.

#### Scenario: A command-line instance is already running
- **WHEN** `spec-control` was started in a terminal and the user opens the app
- **THEN** the app shows that server, names it as started elsewhere, and quitting the app leaves it running

#### Scenario: Port taken by another program
- **WHEN** another program listens on port 4711 and answers `GET /api/version` with anything but a Spec Control body
- **THEN** the app starts no server and explains that port 4711 is in use and how to set a different port

#### Scenario: Opened twice
- **WHEN** the app is already running and the user opens it again from the Dock or Finder
- **THEN** no second instance or server starts and the existing window comes to the front

### Requirement: The window loads the loopback origin directly
The app window SHALL load `http://127.0.0.1:<port>/` and nothing else as its page, so that every request the page makes carries the server's own origin and passes the server's cross-site and WebSocket guards unchanged. The app MUST NOT serve the page from a custom scheme, a file or a proxy, MUST NOT inject scripts into the page, and MUST NOT expose any bridge from the page to the app's own process. Navigation within the window SHALL be limited to that origin: a link to any other origin, whether it opens a new window or not, SHALL open in the user's default browser and the app window SHALL stay where it is.

#### Scenario: Terminal works inside the app
- **WHEN** the user opens an agent session's terminal in the app window
- **THEN** the terminal WebSocket is accepted, because its `Origin` is `http://127.0.0.1:<port>`

#### Scenario: Pull request link
- **WHEN** the user clicks a pull request link to github.com in the app window
- **THEN** it opens in the default browser and the app window keeps showing the dashboard

#### Scenario: No bridge into the app
- **WHEN** the page's scripts look for any app-provided global or message channel
- **THEN** none exists

### Requirement: Tools are found as in the user's shell
Before starting the binary the app SHALL determine the `PATH` the user's login shell sets, by running the user's shell (`$SHELL`, else `/bin/zsh`) as a non-interactive login shell that prints only its environment's `PATH`, with a time limit of five seconds, and SHALL start the binary with that `PATH`. When the shell fails, times out or prints no `PATH`, the app SHALL start the binary with the standard macOS `PATH` extended by `/opt/homebrew/bin` and `/usr/local/bin`, and the environment report SHALL show which tools are then missing as it does today. The app MUST NOT read, store or pass on any other variable from that shell, and MUST NOT run the shell for anything else.

#### Scenario: Opened from Finder with Homebrew tools
- **WHEN** `gh` and the agent CLI are installed under `/opt/homebrew/bin` and the user opens the app from Finder
- **THEN** the environment report finds both and agent sessions start

#### Scenario: Shell does not answer
- **WHEN** the user's login shell does not finish within five seconds
- **THEN** the binary is started with the fallback `PATH` and the app shows no error beyond what the environment report states

### Requirement: Closing the window keeps the work running; quitting asks while sessions run
Closing the app window SHALL hide it and keep the server and every agent session running; the app SHALL stay reachable from a menu bar item offering **Open Spec Control**, **Releases Page** and **Quit Spec Control**. **Quit** SHALL stop a server the app started the same way `Ctrl+C` stops the command-line binary, so running sessions end as resumable. When the app started the server and at least one agent session is running, Quit SHALL first ask for confirmation, naming how many sessions will stop; cancelling SHALL leave everything running. Quitting MUST NOT kill the server without first giving it the chance to end its sessions.

#### Scenario: Close the window during a session
- **WHEN** an agent session runs and the user closes the app window
- **THEN** the session keeps running, the menu bar item remains, and **Open Spec Control** shows the same session

#### Scenario: Quit with running sessions
- **WHEN** two agent sessions run in a server the app started and the user chooses Quit
- **THEN** the app asks whether to stop 2 running sessions, and only on confirmation stops the server, which ends them as resumable

#### Scenario: Quit with no sessions
- **WHEN** no agent session runs and the user chooses Quit
- **THEN** the app stops the server and exits without asking

### Requirement: Standard editing and view commands work in the window
The app SHALL provide the standard macOS application menu with Undo, Redo, Cut, Copy, Paste, Select All, Reload, the zoom commands, Releases Page and Quit, so that keyboard shortcuts such as ⌘C and ⌘V work in the dashboard's fields and its terminals.

#### Scenario: Paste into a terminal
- **WHEN** the user copies text in another application and presses ⌘V in an agent terminal in the app
- **THEN** the text is pasted into the terminal

### Requirement: The app makes no network request of its own
The app's own process MUST NOT contact any network: it requests only the loopback server it started or attached to. The server's network access stays exactly as the dashboard-api capability defines it. The app SHALL offer a **Releases Page** item in its application menu and its menu bar item that opens this project's GitHub releases page in the default browser, which is how the user finds and installs a newer version.

#### Scenario: Idle app
- **WHEN** the app runs for a day with nobody using the pull action or a pull-request or issue query
- **THEN** no process of the app or its server has made a request to any host other than `127.0.0.1`

#### Scenario: Looking for a new version
- **WHEN** the user chooses Releases Page
- **THEN** the releases page opens in the default browser and the app makes no request itself
