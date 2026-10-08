# Spec Delta

## ADDED Requirements

### Requirement: Fast-forward drafts, implements and ships in one session
The dashboard SHALL offer a fifth starter, **Fast-forward**, for a change that should go from its artifacts to a pull
request without the user reviewing anything in between. It SHALL be offered exactly when all of these hold: **Draft
artifacts** is offered for the change (at least one artifact is not done, the change is not archived); the change is
not planned yet — in `Backlog` or `Drafts` (or without artifacts), not in `Ready` or later, where an optional artifact
may still be missing but **Implement** and **Ship** already apply; the change is not **blocked** by its dependencies (change-dependencies), because fast-forwarding implements it; and the repository's
agent has both a **Draft artifacts** and an **Implement** prompt. A request to start or send **Fast-forward** when any of
these does not hold SHALL be refused like any unavailable starter — a refusal because the change is blocked naming each
dependency that is not `met` with its state, as for **Implement** — and SHALL create no worktree and start no process.

A Fast-forward session SHALL run where a **Draft artifacts** session of the same change would run — in a git repository
in the change's worktree on branch `feat/<change>`, in place where a Draft session would be in place — and SHALL count
as that change's one open session. Its action SHALL be recorded as `fastForward` and shown as **Fast-forward** wherever a
session's action is named (the session panel, Open work and the activity log).

Its opening prompt SHALL be composed, as one line, of, in this order: the agent's **Draft artifacts** prompt with that
prompt's additional instructions; a fixed agent-neutral sentence telling the agent not to stop for the user's review once
every artifact is written, because this change is fast-forwarded and the pull request will be its only review, and to go
straight on to implementing it; the agent's **Implement** prompt with its additional instructions; a fixed agent-neutral
sentence telling the agent, once every task is settled, to ship the work without asking; and the **Ship** prompt exactly
as Ship would produce it for the change's repository — the profile's Ship prompt or the agent-neutral default, the
project's pull request title convention and the additional Ship instructions. `{change}` SHALL be replaced in every part
by the validated change name and is the only placeholder; nothing else from the browser SHALL reach the prompt. The
profile SHALL NOT have a Fast-forward prompt of its own, so every profile that has a Draft and an Implement prompt can
fast-forward without being configured for it, and editing those prompts or Ship's changes the Fast-forward prompt with
them. The `- [~]` meaning carried by the Implement prompt therefore holds in a Fast-forward session too.

A Fast-forward prompt MUST NOT carry the docs-only auto-merge instruction of Ship or Archive, whatever the project's
auto-merge setting and whatever its worktree holds, and a Fast-forward session SHALL NOT record that auto-merge was
requested; the pull request it asks for is the change's only review and MUST stay open for it. The dashboard itself
SHALL NOT commit, push, open or merge anything for it: as for Ship, it only hands over the prompt.

While a session of the change runs, **Fast-forward** MAY be sent into it as a next step under the rules for sending a
starter's prompt into a running session, under the same availability conditions.

#### Scenario: Fast-forward on a drafted-nothing change
- **WHEN** change `cache-api-calls` is in `Backlog`, is not blocked, and the repository's agent is the preconfigured Claude Code profile
- **THEN** **Fast-forward** is offered next to **Draft artifacts**, and starting it creates the worktree on `feat/cache-api-calls` and starts `claude` with one prompt that begins with `/opsx:ff cache-api-calls`, then says not to stop for review, then contains `/opsx:apply cache-api-calls` with the `- [~]` instruction, then asks to ship, ending with the Ship prompt

#### Scenario: Project with a pull request title convention
- **WHEN** **Fast-forward** is started for a change of a repository whose `prTitleConvention` is `conventional-commits`
- **THEN** its prompt ends with the Ship prompt including the Conventional Commits sentence, followed by the profile's additional Ship instructions if any

#### Scenario: Never auto-merge
- **WHEN** **Fast-forward** is started for a change of a project with docs-only auto-merge switched on
- **THEN** its prompt contains neither auto-merge instruction and the session records no auto-merge request

#### Scenario: Not offered without an Implement prompt
- **WHEN** the repository's agent has a Draft artifacts prompt but no Implement prompt
- **THEN** **Draft artifacts** is offered and **Fast-forward** is not, and a request for it is refused

#### Scenario: Not offered for a blocked change
- **WHEN** change `cache-api-calls` in `Drafts` depends on `add-billing-api`, which is `waiting`
- **THEN** **Draft artifacts** is offered and **Fast-forward** is not, and a request for it is refused naming `add-billing-api — waiting`

#### Scenario: Not offered once planned
- **WHEN** the change is in `Ready` with its tasks written and its optional design not written
- **THEN** **Fast-forward** is not offered and a request for it is refused

#### Scenario: Shell metacharacters stay inert
- **WHEN** the Draft prompt of the profile contains `$(rm -rf ~)` and **Fast-forward** is started
- **THEN** that text reaches the agent only inside the one prompt argument and no shell is started

### Requirement: Fast-forward asks for confirmation unless switched off
Before a Fast-forward session is started or its prompt is sent into a running session, the dashboard SHALL ask the user
to confirm, unless the configuration's `agentSessions.confirmFastForward` is `false`; absent means `true`. The
confirmation SHALL name the change, SHALL say that the agent will write the change's artifacts, implement it and open a
pull request without stopping for the user's review, and that the pull request will be the only review, and SHALL offer
**Fast-forward**, **Cancel** and an unticked **Don't show this warning again** checkbox. Cancelling — by the control,
Escape or closing the dialog — SHALL start nothing, send nothing and save nothing, whether or not the checkbox was
ticked. Confirming with the checkbox ticked SHALL save `confirmFastForward: false` before the session is started; when
that save fails, the session SHALL still be started and the dialog's failure to save SHALL be reported where the
starter was activated. With `confirmFastForward` `false`, activating **Fast-forward** SHALL start it directly.

The Agent sessions section of Settings SHALL show a **Warn before fast-forwarding** checkbox reflecting
`confirmFastForward` (ticked when absent), saved with the rest of Settings, so a warning switched off can be turned back
on. A configuration without the field SHALL load unchanged, and a value other than a boolean SHALL be rejected when
saved, leaving the stored configuration unchanged.

#### Scenario: First fast-forward warns
- **WHEN** `confirmFastForward` is absent and the user activates **Fast-forward** on `cache-api-calls`
- **THEN** a dialog asks to confirm fast-forwarding `cache-api-calls`, says the pull request will be the only review, and no session is started until the user confirms

#### Scenario: Cancel starts nothing
- **WHEN** the user ticks **Don't show this warning again** and then cancels
- **THEN** no session is started and `confirmFastForward` is unchanged

#### Scenario: Never show again
- **WHEN** the user ticks **Don't show this warning again** and confirms
- **THEN** the session starts, `confirmFastForward` is saved as `false`, and the next **Fast-forward** starts without a dialog

#### Scenario: Turning the warning back on
- **WHEN** `confirmFastForward` is `false` and the user ticks **Warn before fast-forwarding** in Settings and saves
- **THEN** the next **Fast-forward** asks for confirmation again
