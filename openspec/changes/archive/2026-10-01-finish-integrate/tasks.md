# Tasks

## 1. Default prompt and fallback

- [x] 1.1 Add `DEFAULT_INTEGRATE_PROMPT` to `src/shared/types.ts` beside the Ship and Resolve conflicts defaults, with today's preset text verbatim and no placeholder; verify `bun run typecheck` (via `bun run check`) passes
- [x] 1.2 Make `integratePrompt` in `src/server/sessions/agents.ts` return `string`, composing `agent.prompts.integrate ?? DEFAULT_INTEGRATE_PROMPT` with the Integrate suffix; update `test/agents.test.ts` so a profile without an Integrate prompt yields the default, a suffix-only profile yields default + suffix, and a profile's own prompt still wins
- [x] 1.3 Remove `integrate` from `CLAUDE_PROFILE` in `src/shared/agentDefaults.ts` (drop `INTEGRATE_PROMPT`); verify `integratePrompt(CLAUDE_PROFILE)` equals `DEFAULT_INTEGRATE_PROMPT` in `test/agents.test.ts` and that a loaded config whose Claude profile carries an `integrate` prompt keeps it unchanged

## 2. Availability and refusals

- [x] 2.1 Drop the "has no Integrate prompt configured" reason from `integrateUnavailable` in `src/shared/types.ts`; update `test/agents.test.ts` (the Integrate row test and the "additional instructions make no action available" test) and `test/createProject.test.ts` (`newProjectUnavailable`) so a profile without an Integrate prompt is available
- [x] 2.2 Remove the `400` "no Integrate prompt" branches from `src/server/sessions/manager.ts` (`openIntegration`), `src/server/integration.ts` and `src/server/createProject.ts`, keeping `403`/`503` as they are; verify with `test/integration.test.ts` that `startIntegration` with a profile lacking an Integrate prompt starts a session whose fake agent received the default prompt
- [x] 2.3 In `test/createProject.test.ts`, replace the `400 /no Integrate prompt/` refusal case with a case proving `POST /api/projects` succeeds (`201`) for a profile without an Integrate prompt and the session got the default prompt

## 3. Settings

- [x] 3.1 In `src/ui/agentSettings.tsx`, use `DEFAULT_INTEGRATE_PROMPT` as the Integrate field's placeholder, change its hint to say empty uses the default shown, and change the additional Integrate instructions hint to say they are appended to the prompt or to the default; verify by running `bun run dev`, opening Settings, clearing the Integrate prompt and confirming the hint and placeholder, and that Integrate stays active on an integratable row

## 4. Wrap-up

- [x] 4.1 Search `src/`, `test/`, `README.md` and `CLAUDE.md` for remaining "no Integrate prompt" wording or `prompts.integrate` assumptions and fix any that describe Integrate as needing a configured prompt; verify `grep -rn "no Integrate prompt" src test` returns nothing
- [x] 4.2 Run `bun run check` and confirm lint, typecheck and all tests pass; run `openspec validate finish-integrate --strict`
