# Tasks

## 1. Heading hierarchy

- [x] 1.1 Add `.settings h2` (headline: ~16px, weight 600, normal case, `--brand-fg`), `.settings h3` (group: 13px, weight 600, `--fg-heading`, normal case) and `.settings h4` (agent field group: 12px, weight 600, upper-case, `--fg-subtle`) to `src/ui/styles.css`, tokens only, global `h2` rule untouched; verify `bun run check` passes and no literal colour was added (`git diff src/ui/styles.css | grep -E '#[0-9a-fA-F]{3,8}'` is empty)
- [x] 1.2 Demote the in-section headings to `h3`: "Ignored paths" in `src/ui/settings.tsx` and "Repositories" in `src/ui/sharedConfig.tsx`, text unchanged; verify each Settings section has exactly one `h2` by rendering Settings with `bun run dev` and checking the five sections
- [x] 1.3 Verify contrast: compute `--brand-fg` and `--fg-heading` against `--bg-section` in both token sets (dark and `[data-theme="light"]`) and record the ratios (all ≥ 4.5:1) in the pull request description

## 2. Agent sessions section structure

- [x] 2.1 In `src/ui/agentSettings.tsx`, render the section as: `h2` Agent sessions, risk statement (all required facts kept), switch; then inside the fieldset `h3` groups Agents, Shortcuts, Console, Projects in that order (`ShortcutEditor` and `PerProjectNote` headings become `h3`); verify with a test in `test/agentSettingsUi.test.ts` that renders `AgentSettings`' groups' headings in that order, or, if `AgentSettings` needs hooks, asserts the `h3` texts of `ShortcutEditor`/`PerProjectNote` and the source order
- [x] 2.2 Remove the "Session worktrees" list, the `sessions` state and the `Session` import; keep `api.sessions()` for `agents` and `presets`; verify a test asserts the source no longer contains `Session worktrees` and `bun run check` passes

## 3. Agent profile card

- [x] 3.1 Replace `<details class="agent-card">` in `AgentEditor` with a header row (toggle `button` with `aria-expanded`/`aria-controls` showing name, command, default/found badges; **Make default** and **Remove agent** beside it) and a body rendered only when `open`; add `open` / `onToggle` props so `AgentEditor` stays hook-free; verify a test renders a collapsed editor whose header offers both actions, calls `onDefault` without `onToggle`, and has no body
- [x] 3.2 Hold expanded profile ids in `AgentSettings` state, seeded with the default agent; verify in the running dashboard (`bun run dev`) that the default profile opens expanded and toggling another expands it without collapsing the first
- [x] 3.3 Add a `PromptField` (label, prompt input or textarea with placeholder, and directly beneath it the "additional instructions" input bound to `promptSuffixes[key]`) and use it for every prompt; group them under `h4` **Change starters** (Draft artifacts, Implement, Validate, Archive) and **Action prompts** (Ship, Resolve conflicts, Integrate), each group with one shared rule line, Integrate keeping its own no-placeholder note; verify the existing tests "the editor offers additional instructions beside every prompt" and "typing stores the text under its own key" still pass, and a new test asserts each prompt's instructions input follows its prompt before the next prompt's input
- [x] 3.4 Put name, command (one-line `{prompt}` note) and resume command under `h4` **Command**, first in the body; verify a test asserts the three `h4` texts appear in the order Command, Change starters, Action prompts
- [x] 3.5 Add the card styles (`.agent-card` header row, toggle button, `.agent-group` spacing, indented additional-instructions field) to `src/ui/styles.css`, tokens only, and check the 720px layout wraps the header actions under the toggle; verify at 400px width in `bun run dev` that nothing overflows horizontally

## 4. Wrap-up

- [x] 4.1 Shorten the remaining agent-section hints without dropping any fact the specs require (risk statement, worktree and in-place exception, every-repository note, console folder rules, shortcut one-line/no-placeholder rule); verify the test "The in-place exception is stated"-equivalent text checks and a read-through against `specs/repo-discovery/spec.md`
- [x] 4.2 Check both themes and the demo build (`bun run build` and the demo's Settings) show the coloured headlines and the grouped agent section; verify by screenshots attached to the pull request
- [x] 4.3 Run `bun run check` and `openspec validate refactor-settings-ui --strict`; verify both pass
