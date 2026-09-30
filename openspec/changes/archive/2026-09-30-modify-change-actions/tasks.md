# Tasks

## 1. Config shape and validation

- [x] 1.1 Add `promptSuffixes?: Partial<Record<PromptKey, string>>` to `AgentProfile` in `src/shared/types.ts`, documented as additional instructions appended to that prompt and composed as one line; verify `bun run check` typechecks with no other change needed
- [x] 1.2 Add the suffix schema to `agentProfileSchema` in `src/server/config.ts`: `{change}` allowed but not required for `draft`, `implement`, `validate`, `archive` and `ship`, no placeholder at all for `integrate`, trimmed non-empty, `noBypass` on every key; verify with new cases in `test/config.test.ts` that a valid suffix round-trips, and that `{repo}` on a starter, `{change}` on Integrate, a bypass flag and a whitespace-only value are each rejected naming the field
- [x] 1.3 Confirm a config saved without the field still loads and carries no suffixes, and that the prompt upgrade in `config.ts` (`FORMER_PROMPTS`) leaves suffixes untouched; verify with a `test/config.test.ts` case loading a legacy config and one whose Claude profile has a former prompt plus a suffix

## 2. Prompt composition

- [x] 2.1 Add the composing helper to `src/server/sessions/agents.ts` — trim the suffix, collapse each whitespace run to one space, drop an empty result, join to the prompt with a single space — and use it in `openingPrompt` after its existing "no prompt configured" check, keeping the single `{change}` substitution on the composed string; verify with `test/agents.test.ts` cases for a starter with and without a suffix, a multi-line suffix collapsed to one line, and `{change}` used inside the suffix
- [x] 2.2 Apply the helper in `shipPrompt` so a Ship suffix extends the profile's Ship prompt or `DEFAULT_SHIP_PROMPT`; verify with `test/agents.test.ts` cases for both bases and for a profile with a suffix but no Ship prompt of its own
- [x] 2.3 Add `integratePrompt(agent)` to `agents.ts` composing the Integrate prompt with its suffix and no placeholder substitution, and use it in `openIntegration` (`src/server/sessions/manager.ts`) in place of the direct `agent.prompts.integrate` read, keeping the existing "no Integrate prompt configured" refusal; verify with a `test/agents.test.ts` case plus `test/integration.test.ts` asserting the started agent receives the composed prompt
- [x] 2.4 Confirm a suffix alone never makes an action available: an action with a suffix and no prompt stays out of `startersFor`, and opening it is still refused with the "no <action> prompt configured" reason; verify with `test/agents.test.ts` and an API case in `test/sessionPrompt.test.ts`

## 3. Sending a composed prompt

- [x] 3.1 Verify the composed prompt reaches an agent whole on both launch paths — as one argv element where the command has `{prompt}`, and typed where it does not — with a `test/agents.test.ts` case over `launchCommand` for a prompt plus suffix containing quotes and `;`
- [x] 3.2 Verify a starter's prompt sent into a running session carries the suffix, by extending `test/sessionPrompt.test.ts` to configure an Implement suffix and assert the fake agent's terminal shows the composed text and the session's action becomes `implement`
- [x] 3.3 Verify Ship on a running session submits the composed Ship prompt, by extending the existing Ship coverage in `test/sessionPrompt.test.ts` or `test/workStatus.test.ts` with a Ship suffix and asserting the submitted text ends with it

## 4. Settings editor

- [x] 4.1 Render an additional-instructions control under each of the six prompts in `src/ui/agentSettings.tsx` — single-line inputs for the four starters, textareas for Ship and Integrate — storing an empty value as absent and reusing the existing `check grow` / `agent-tools` classes so no new CSS is needed; verify by rendering the section in a test that the six controls exist and that clearing one removes the key from `promptSuffixes`
- [x] 4.2 Write each field's hint: the text is appended to the prompt above it, it becomes one line, `{change}` may be used (not for Integrate), and Ship's applies to the default prompt too; verify the hints read correctly in the browser with agent sessions enabled

## 5. Verification

- [x] 5.1 Run `bun run check` and confirm lint, typecheck and the whole test suite pass
- [x] 5.2 Run `bun run build` and confirm the compiled `dist/openspec-dashboard` serves the Settings section with the new fields and starts a session whose prompt carries the suffix
- [x] 5.3 In the browser, add an additional Ship instruction to the Claude Code profile, save, and confirm Ship on a session with unpushed work submits the default Ship prompt followed by that sentence
- [x] 5.4 In the browser, confirm an action with additional instructions but no prompt is still not offered on a card, and that the prompts of the other actions are unchanged
