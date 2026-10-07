# Tasks

## 1. Facts to keep

- [x] 1.1 List every claim the current `README.md` makes that the new one keeps (run steps, verification, quarantine, pre-rename note, first run, build from source, trust summary items) and check each against `openspec/specs/dashboard-api/spec.md`, `release-publishing`, `demo-site` and `src/ui/helpContent.tsx`; verify by noting any claim that is no longer true and leaving it out
- [x] 1.2 Confirm every feature detail removed from the README (label marker files, chip glyphs, column rules, flag lists, compatibility env vars, `Content-Type` note) is covered by the Help view or a spec; verify with `grep` in `src/ui/helpContent.tsx` and `openspec/specs/` for each

## 2. Rewrite the README

- [x] 2.1 Write the top: title, one- or two-sentence description without the old tagline, the unchanged demo link and `<picture>` block; verify the screenshot URLs and alt text are byte-identical to before (`git diff` shows no change in that block) — deviation: the alt text said "from New to Archived", but the first column is Backlog, so that one word was corrected; the URLs are unchanged
- [x] 2.2 Write **Why** (one paragraph) and **Features** (six to eight one-line bullets, one link to the Help view and `openspec/specs/` after the list); verify no bullet exceeds two rendered lines and every feature named exists in the current UI
- [x] 2.3 Write **How it is organised** with the global → project → change levels (console, project console, change session in its own worktree); verify each level's wording matches `main-console`, `project-console` and `agent-sessions` specs
- [x] 2.4 Rewrite **Run** (heading kept) with download, `shasum`/`gh attestation verify`, `chmod +x`, quarantine, the pre-rename note, first run and build from source; verify the `release-publishing` scenario "User wants a binary" still holds
- [x] 2.5 Write **What it touches** (four to five bullets) linking the dashboard-api spec; verify nothing in it contradicts that spec's "never writes" requirement
- [x] 2.6 Write **Contributing** (issue-first, link to `https://github.com/jwndlng/spec-control/issues`, pointer to `CONTRIBUTING.md` and `CLAUDE.md`) and keep **License**; verify both links resolve to files or the repository's issues page

## 3. CONTRIBUTING.md

- [x] 3.1 Add the opening paragraph that the file describes how the project is developed and that outside contributors start with a GitHub Issue; verify it is the first paragraph under the title
- [x] 3.2 Add one line to step 3 (Implement): feature detail goes into the built-in Help and the spec, and the README changes only for key features, the three-level structure, run steps or what the dashboard touches; verify the rest of the file is unchanged with `git diff CONTRIBUTING.md`

## 4. Check

- [x] 4.1 Read the README top to bottom as a stranger and cut anything that does not help decide, install or trust; verify it is under ~110 lines (`wc -l README.md`), has no superlatives or emoji, and uses only made-up names in examples
- [x] 4.2 Verify every relative link in `README.md` and `CONTRIBUTING.md` points to an existing file (a short `grep -o '](\([^)]*\))'` check), and that `grep -n "openspec-dashboard" README.md` finds only the pre-rename release note
- [x] 4.3 Run `bun run check` and `openspec validate refine-readme --strict`; verify both pass
