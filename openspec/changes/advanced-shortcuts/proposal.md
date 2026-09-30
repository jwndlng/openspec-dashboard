# Proposal

## Why

The console's shortcut buttons paste exactly what they say: the label *is* the text sent, hard-coded as four entries in
`src/ui/quickReplies.ts`. That ties the button's wording to the agent's instruction, so a shortcut can only ever be as
long as a button may be — there is no room for "Ship it" to carry a paragraph about how to ship — and the set is the
same four answers for everyone, in a dashboard where every other thing an agent is told (the starter prompts, Ship,
Integrate) is the user's to edit in Settings. Shortcuts are the one piece of text the dashboard sends into a running
agent that nobody can change.

## What Changes

- A **shortcut becomes a pair**: a short **title** for the button and a **prompt** typed into the agent. They are
  independent, so a one-word button can carry several sentences of instruction.
- Shortcuts move into the configuration (`agentSessions.shortcuts` in `~/.openspec-dashboard/config.json`) and become
  editable in the **Agent sessions** section of Settings: edit a title or a prompt, add a shortcut, remove one, reorder
  them, and restore the shipped defaults. They are saved with everything else on that page, through the existing draft
  and save bar.
- The four shortcuts shipped today (`Yes, go ahead`, `Yes, create a PR`, `Resolve PR conflicts`, `No, stop here`) become
  the **defaults**, unchanged in wording and order, with title and prompt equal. A configuration saved before this
  change, which has no `shortcuts` key, is read as carrying them, so nobody's console loses its buttons.
- The console row keeps behaving exactly as it does now: a shortcut's prompt is sent **verbatim** through the rules for
  text sent on the user's behalf — typed first, Enter only once the agent echoed it — the dashboard adds nothing,
  interprets nothing, and never confirms a menu. Shortcuts stay hidden unless the session runs with its terminal
  connected.
- A shortcut prompt takes **no placeholder**. It is typed into whatever session is open — a change's, the main
  console's, an Integrate session's — so there is nothing the dashboard could substitute for `{change}` in all of them,
  and "sent exactly as written" stays literally true.
- Titles and prompts are validated where the rest of the configuration is: both non-empty after trimming, a title short
  enough for a button, a prompt a **single line** with no control characters (a newline would submit the text before the
  echo check could withhold Enter), and no permission-bypass wording, as for every other prompt.
- The list may be **emptied**: with no shortcuts configured, the console shows no shortcut row at all and typed input is
  the only way in — which is what a terminal was before this row existed.
- Removed: the unused "type but do not submit" variant of a shortcut. No shortcut has ever been offered that way, and a
  configured shortcut is always sent through the safe submit path.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `agent-sessions`: "Default responses can be sent to a running session" becomes a requirement about **configurable
  shortcuts** — a title/prompt pair, the set coming from the configuration rather than from a fixed list, the shipped
  defaults and what happens when the list is empty — while everything it already guarantees about sending (verbatim
  text, the echo rule, one activation, focus, the typed-but-not-sent notice, only while running and connected) is
  carried over unchanged. A new requirement covers **configuring** them: where they live, what a valid title and prompt
  are, migration of a configuration without them, and the editor in the Agent sessions section of Settings.

## Impact

- `src/shared/types.ts` — a `Shortcut` type (`id`, `title`, `prompt`) and `shortcuts` on `AgentSessionsConfig`.
- `src/shared/agentDefaults.ts` — `DEFAULT_SHORTCUTS`, returned by `defaultAgentSessions()`; the defaults move here
  from the UI because the configuration's default has to be the same list the server validates against.
- `src/server/config.ts` — a shortcut schema (title, prompt, unique ids, the single-line and bypass rules) and the
  default applied when `shortcuts` is absent.
- `src/ui/quickReplies.ts` — becomes shortcut helpers: the terminal message and the tooltip built from a `Shortcut`;
  `DEFAULT_QUICK_REPLIES` and `QuickReply.submit` go.
- `src/ui/sessionPanel.tsx` — `TerminalView` reads the shortcuts from the loaded configuration (`useSessionUi().config`)
  instead of the constant, and renders titles with the prompt as the tooltip.
- `src/ui/agentSettings.tsx` — the shortcuts editor inside the existing `agents` section, so the Settings page's section
  list and its deep links are untouched.
- `src/ui/demo/sampleData.ts` — the demo configuration carries the defaults, and the demo's Settings page edits them
  like any other setting.
- `test/` — `quickReplies.test.ts` reworked onto the new shape, shortcut cases in `config.test.ts` (accepted, empty
  list, multi-line prompt rejected, bypass wording rejected, missing key migrated) and a UI test for the editor.
- `openspec/specs/agent-sessions/spec.md` via this change's delta spec.
- No server session, terminal or git behaviour changes: the terminal socket already accepts arbitrary input from the
  browser, so a configured shortcut is nothing new on the wire and `src/server/sessions/` is untouched. No new
  dependency, no new API route, no write to a tracked repository.
- **Ordering:** no in-flight change touches the "Default responses" requirement, `src/ui/quickReplies.ts` or
  `test/quickReplies.test.ts`. `add-validate-phase` and `integrate-repos-without-openspec` also edit
  `src/shared/agentDefaults.ts` and `src/ui/agentSettings.tsx`, but only their prompt fields; this change adds a
  separate constant and a separate block.
