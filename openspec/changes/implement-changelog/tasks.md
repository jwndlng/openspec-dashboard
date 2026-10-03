# Tasks

## 1. Changelog data and state

- [x] 1.1 Add `src/ui/changelog.ts` with the `ChangelogEntry` type (`id`, `date`, `title`, `summary`) and the exported `CHANGELOG` list, newest first; verify `bun run typecheck` passes
- [x] 1.2 Seed `CHANGELOG` with the user-visible features merged between `v0.2.0` and `v0.3.0` (`git log v0.2.0..v0.3.0`, `feat` commits only), written for users — what they can now do and where — with made-up names only (invariant 7); verify by reading the list against that log
- [x] 1.3 Add `src/ui/whatsNewState.ts`: `loadSeenIds`/`saveSeenIds` (JSON id list under one `localStorage` key, try/catch on every access, malformed → absent, saved list pruned to current ids), `unseenIds(entries, seen)` with the first-visit baseline, and `groupByMonth(entries)` using local calendar dates (design D2, D4); verify with 2.1

## 2. Tests

- [x] 2.1 Add `test/whatsNew.test.ts` covering first-visit baseline, unseen count after new entries, a removed seen entry not changing the count, malformed and refused storage, pruning on save, and month grouping across a year boundary; verify `bun test test/whatsNew.test.ts` passes
- [x] 2.2 In the same file, validate `CHANGELOG`: unique ids, id = `<date>-<kebab-slug>` with the entry's own date, valid calendar dates, newest first, non-empty title and summary, failures naming the offending id; verify by temporarily duplicating an id and seeing the test fail with that id

## 3. UI

- [x] 3.1 Add one icon (gift or sparkles) to `src/ui/icons.tsx` in the existing icon style; verify it renders in the button
- [~] 3.2 Add `src/ui/whatsNew.tsx`: a `WhatsNew` `btn sm ghost` button with the unseen count (styled like `nav-count`, hidden at 0) that opens a `Modal` listing entries grouped by month with date, title, summary rendered through `markdown.tsx`, **New** marks for the ids unseen when it opened, and a link to `https://github.com/jwndlng/openspec-dashboard/releases`; opening saves every id as seen (design D3); verify in `bun run dev` with a cleared marker edited to omit one id
- [~] 3.3 Mount `WhatsNew` in `topbar-end` in `src/ui/app.tsx` before `ConsoleButton`, and add its styles to `src/ui/styles.css` for light and dark themes and narrow widths; verify visually in both themes in `bun run dev`
- [x] 3.4 Verify the demo build (`bun run build:demo`) shows the dialog with the same entries and that `test/demoBundle.test.ts` and `test/demoSynthetic.test.ts` still pass

## 4. Keeping it current

- [x] 4.1 Add a "What's new" paragraph to the Releasing section of `CONTRIBUTING.md`: every `feat` pull request users can see adds an entry to `src/ui/changelog.ts`, how to write one, and that it differs from the generated release notes; verify by reading the section
- [x] 4.2 Add a project-owned (unmarked) `rules.tasks` entry to `openspec/config.yaml` asking for a "add a What's new entry" task in changes with user-visible features; verify `openspec instructions tasks --change implement-changelog --json` shows the rule
- [x] 4.3 Mention the What's new dialog in `README.md` next to the releases link; verify by reading it
- [x] 4.4 Add a What's new entry for this feature itself to `src/ui/changelog.ts`; verify 2.2 still passes

## 5. Verification

- [~] 5.1 Run `bun run check` and `bun run build`; open `dist/openspec-dashboard` with the network off and confirm the dialog lists every entry and the page made no request for it
