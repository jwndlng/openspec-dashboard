# Design

## Context

See `proposal.md` — Why. The constraints that shape the approach:

- Prompts are produced in exactly two functions today, `openingPrompt` and `shipPrompt` in
  `src/server/sessions/agents.ts`, plus one direct read of `agent.prompts.integrate` in `openIntegration`
  (`src/server/sessions/manager.ts`).
- A prompt reaches the agent either as **one whole argv element** (command containing `{prompt}`) or by being **typed
  into the terminal** and submitted with a separate Enter (`src/server/sessions/submit.ts`). In the typed case a line
  break would act as Enter, which is why `src/shared/agentDefaults.ts` notes that each preconfigured prompt is one
  line.
- `src/server/config.ts` validates every prompt with its own zod schema: starters require `{change}` and allow no other
  placeholder, Ship allows `{change}` without requiring it, Integrate allows no placeholder at all, and all of them
  reject permission-bypass text.
- The agent-sessions spec states that no text from the browser other than the validated change name becomes part of the
  command line. Configured prompts are the established exception: they come from Settings, are validated on save, and
  only ever become one argv element. Additional instructions are the same kind of text, so they inherit that treatment
  and no per-run text is introduced.
- Two in-flight changes touch nearby spec text: `add-validate-phase` owns the starters requirement and
  `integrate-repos-without-openspec` owns the `repo-integration` capability. The delta therefore adds one requirement of
  its own and modifies only the profile requirement, which neither of them touches.

## Goals / Non-Goals

**Goals:**

- One composition point, so every path that sends an action's prompt gets the additional instructions without having to
  remember to.
- A composed prompt that is still safe to type into a terminal: one line, one argv element.
- Validation that mirrors each prompt's own rules, so the new field cannot smuggle in a placeholder or a bypass flag
  that the prompt itself would have been refused for.

**Non-Goals:**

- Per-repository or per-change additional instructions, and text typed when an action is started. The text lives on the
  agent profile only; a later change can add another scope on top of this one.
- Changing the preconfigured prompts, the prompt-upgrade mechanism (`FORMER_PROMPTS`) or the shared config profiles.
- A new API route: the field travels with the config through `PUT /api/config`.

## Decisions

### D1: A sibling field, `promptSuffixes`, not a second prompt map or a marker inside the prompt

`AgentProfile` gains `promptSuffixes?: Partial<Record<PromptKey, string>>` next to `prompts`, keyed the same way.

- *Why not fold the text into `prompts`* (for example a separate `implement+` key): the presence of `prompts[action]`
  is what decides whether a starter is offered at all (`openingPrompt` returning `undefined`), and it is what the
  prompt-upgrade check compares against `FORMER_PROMPTS`. A second kind of value in that map would blur both.
- *Why not a placeholder inside the prompt* (`{extra}`): it would require every user to edit the preconfigured prompt to
  benefit, which is exactly the problem this change solves.
- The field is optional and absent by default, so no config migration is needed and the preconfigured Claude Code
  profile is unchanged.

### D2: Composition lives in `agents.ts`, and the Integrate prompt gets an accessor there

`openingPrompt` and `shipPrompt` append the suffix; a new `integratePrompt(agent)` composes the Integrate prompt so
`openIntegration` stops reading `agent.prompts.integrate` directly. A small shared helper does the composing:

- trim the suffix, replace every whitespace run with a single space, drop it when nothing is left;
- join prompt and suffix with one space;
- substitute `{change}` on the composed string — one pass, so a suffix's placeholder is handled exactly like the
  prompt's, and `integratePrompt` does no substitution at all, as today.

Composing after the join rather than per part keeps a single place where the change name enters the text, which is what
the spec's "no other text from the browser" statement is checked against.

- *Why not compose in `manager.ts`*: three call sites (open, ship, prompt) plus integration, each able to forget it.
  The prompt functions are already the boundary the spec describes.

### D3: The suffix never enables an action, except that Ship already has a default

`openingPrompt` returns `undefined` when `prompts[action]` is missing — checked before any suffix work — so a suffix
alone leaves a starter unavailable and its refusal message unchanged. `shipPrompt` falls back to `DEFAULT_SHIP_PROMPT`,
so a Ship suffix applies on top of the default with no extra case. That asymmetry is not an accident of the code: it is
what makes the example in the proposal ("do A when creating a PR") work without the user having to restate the whole
Ship prompt.

### D4: Validation reuses the prompt schemas, minus the "must contain `{change}`" rule

In `src/server/config.ts` a `suffixSchema` mirrors `shipPromptSchema` (trimmed, non-empty, `{change}` allowed but not
required, no bypass) for `draft`, `implement`, `validate`, `archive` and `ship`, and `integratePromptSchema`'s rule (no
placeholder at all, no bypass) for `integrate`. A suffix that is only whitespace is rejected by the same `min(1)` on the
trimmed value that prompts use; the UI stores an empty field as absent rather than sending `""`, the same way it already
does for prompts.

- *Why not one permissive schema for all six*: the Integrate guarantee ("nothing from this page is substituted into it")
  is only checkable if the placeholder rule is enforced per key, as it already is for the prompts.

### D5: The editor shows a suffix field directly under the prompt it extends

`src/ui/agentSettings.tsx` renders, for each of the six prompts, the existing control plus an additional-instructions
control beneath it, reusing the existing `check grow` / `agent-tools` classes and hint style so the section needs no new
CSS. The four starters keep single-line inputs and get single-line inputs for their suffixes; Ship and Integrate keep
their textareas and get textareas, whose content is collapsed to one line when composed — the hint says so, which is
also the honest way to explain why a line break there is not a paragraph break.

## Risks / Trade-offs

- **A suffix makes a prompt long enough that the echo check has to work on wrapped text** → `submit.ts` already probes
  only a leading portion of the text and disregards wrapping; the spec's long-prompt scenario covers it. No change.
- **Collapsing whitespace surprises a user who typed a list** → the hint next to the field states that the text is
  appended as one line; the scenario in the spec pins the behaviour. The alternative, allowing line breaks, breaks the
  typed path in a way the user cannot see.
- **A suffix contradicts the prompt it extends** (for example telling the agent not to tick tasks the Implement prompt
  asks it to tick) → the dashboard cannot judge prompt text, and does not try to; the text is the user's, as the prompt
  templates already are.
- **Two scopes for the same idea later** (profile and, say, repository) → the composition helper takes the parts it is
  given, so adding another source means extending one function rather than every call site.

## Migration Plan

Additive and optional: an existing config loads unchanged, with no additional instructions anywhere. Nothing is written
to a tracked repository, no route changes, and rollback is removing the field again — a config that carries it would
then simply drop it on the next save, as unknown keys already are.
