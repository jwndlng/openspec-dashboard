# Design

## Context

The README is ~200 lines. Two specs already constrain it and stay untouched: `demo-site` (live-demo link and the
colour-scheme board screenshot near the top) and `release-publishing` (a **Run** section linking releases, checksum
and attestation verification, the macOS quarantine prompt). Everything the current Features list explains is also in
the built-in Help (`src/ui/helpContent.tsx`) and in `openspec/specs/`. The README was trimmed once before
(`overhaul-readme`, target under ~90 lines) and regrew because feature changes appended to it — see proposal.md, Why.

Two in-flight changes have README edits on their branches: `add-validate-phase` (a lifecycle note on `- [~]`) and the
rename changes (already merged into `main`, not yet archived).

## Goals / Non-Goals

**Goals:**
- A stranger knows within a minute what it is, who it is for and whether to try it, before reading any command.
- Under ~110 lines of Markdown including the screenshot block; no bullet longer than two lines.
- Plain voice: short sentences, no superlatives, no "seamless", "powerful", "blazing", no emoji, no marketing tagline
  that does not say something concrete.

**Non-Goals:**
- GitHub issue templates, a `docs/` folder or a documentation site.
- Disabling pull requests on GitHub or adding a policy file; the wording asks, the settings stay the maintainer's.
- Rewriting `CONTRIBUTING.md` or `CLAUDE.md` beyond the two additions in the proposal.
- Changing the Help view.

## Decisions

**Outline** (spec: *The README is an overview for people*):

1. `# Spec Control` and one or two sentences: a local Kanban board that shows where every OpenSpec change stands,
   across all your repositories, and lets you run coding agents on them. Drop the current bold tagline ("mission
   control … Never miss a change") — it restates the sentence below it.
2. Live-demo link + screenshot block, unchanged (the `<picture>` markup and alt text are spec-bound).
3. **Why** — one short paragraph: OpenSpec keeps each change as files in its repository; with many repositories and
   agents working in parallel, nothing shows what is proposed, being implemented, done, waiting for you or ready to
   archive. Spec Control reads the repositories and shows it on one board, without a server, account or database.
4. **Features** — six to eight one-line bullets, each an outcome: one board across repositories with lifecycle
   columns; projects overview with work in progress (uncommitted, unpushed, stale checkouts); agent sessions in their
   own worktree with a terminal in the browser (any CLI agent, off per project); new change / dismiss / pull / clean
   up from the UI; pull requests linked to their change via `gh`; activity history; integrate or create OpenSpec
   projects; single offline binary with built-in Help. No spec links per bullet — one link to `openspec/specs/` after
   the list, next to the Help mention.
5. **How it is organised** — three levels, as a small table or three short bullets:
   - *Global*: Projects overview, the combined board, the **console** (an agent outside every repository).
   - *Project*: one repository's board, settings and its **project console** (an agent in the repository's folder).
   - *Change*: a card and its detail view; an **agent session** for that change runs in its own git worktree and branch.
   One sentence on why: the further down, the narrower the agent's reach.
6. **Run** — keep the heading (spec-bound). Download + verify + `chmod +x` + quarantine in a short numbered list;
   pre-rename release note kept as one line (still needed for verifying old binaries). Then *First run* (add a
   workspace root in Settings, enable projects; tour and Help are built in) and *Build from source* (Bun ≥ 1.4, the
   existing code block).
7. **What it touches** — four to five bullets: loopback only; reads with read-only git, scans never write or fetch;
   writes to a repository only on your click (name the actions in one line), never commits or pushes itself; network
   only for **Pull** and the `gh` pull-request query, with the tools' own credentials; own state in `~/.spec-control/`.
   Link the dashboard-api spec for the full list. The `Content-Type: application/json` note and the
   `OPENSPEC_DASHBOARD_HOME` compatibility note move out (the former is an API detail, the latter is in the What's new
   dialog and CLAUDE.md).
8. **Contributing** — "Found a bug or have an idea? Open an issue" linking
   `https://github.com/jwndlng/spec-control/issues`; state that changes are made through OpenSpec changes by the
   maintainer and agents, so pull requests from outside are not the way in. One line pointing maintainers/agents to
   `CONTRIBUTING.md` and `CLAUDE.md`.
9. **License** unchanged.

Alternative considered: keep the long Features list and add a summary on top — rejected; the length is the problem,
and the Help view already is the reference.

**Wording for issues over pull requests.** "Please open an issue rather than a pull request" — a request with a reason,
not a prohibition, matching the user's "prefer".

**Preventing regrowth.** One line in `CONTRIBUTING.md` step 3 (Implement), next to the existing Help rule, plus the
requirement in `repo-hygiene`. Alternative: a test capping README length — rejected, a line count is a poor proxy and
would fail on legitimate edits.

**Verification is by reading.** No test checks README prose. Each claim is checked against the specs and the Help
text while writing; the task list includes a read-through as a stranger and a link check.

## Risks / Trade-offs

- [`add-validate-phase` edits a README section this change removes] → whichever merges second resolves the conflict
  by keeping the new structure; the `- [~]` detail belongs in Help, which that change already updates.
- [Removing detail someone relied on] → every removed item is covered by the Help view or a spec; the README links
  both.
- [A claim goes stale] → the trust summary names actions only, not mechanics, and defers to the dashboard-api spec.
