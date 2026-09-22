# Design

## Context

`README.md` is the only entry point for GitHub visitors and the target of the live-demo site's links. The
`demo-site` spec requires, near the top, a live-demo link and the board screenshot chosen by colour scheme with
meaningful alt text. Everything else the README currently explains is also specified in `openspec/specs/<capability>/`.

## Goals / Non-Goals

**Goals:**
- Readable top to bottom in about a minute; under ~90 lines.
- Every claim still true; the safety story (loopback, read-only with enumerated writes) stays visible.

**Non-Goals:**
- A `docs/` folder or a documentation site.
- Rewording `CONTRIBUTING.md` or `CLAUDE.md` beyond absorbing a dropped command.

## Decisions

**Outline.** Title + two-sentence pitch → demo link + screenshot → *Run* (prerequisite, `bun install`, `bun run
build`, run the binary with its two flags; `bun run dev` for source) → *First run* (add a workspace root, enable
repos) → *Features* (one line each: Projects, repository board, All changes board, Activity, Settings, Pull,
New change, Shared config, Agent sessions) → *What it writes* → *Contributing* → *License*.
Alternative considered: keep the current sections and trim each — rejected, the length comes from the structure.

**"What it writes" as a short list.** State once that it binds `127.0.0.1`, reads repositories with read-only git,
keeps its own state in `~/.openspec-dashboard/`, and writes to a repository only on an explicit click: Pull
(fast-forward only; the only network access), New change, applying shared config profiles, agent-session worktrees
(off by default). Link to the `dashboard-api` spec's "never writes" requirement as the authoritative list, so the
README cannot drift into contradicting it.

**Link specs instead of copying them.** Each feature line may link its spec (`openspec/specs/kanban-board/spec.md`
etc.) for the details that were removed. Column semantics (New → artifacts → Ready → Implementing → Done → Synced →
Archived) get one line, since they are what users look at most.

**Developer commands.** The README lists only what a user needs (`dev`, `build`, `check`). `build:demo` and
`screenshots` already appear in `CONTRIBUTING.md` → *Demo site and screenshots*; add the two commands there as a code
block if they are only named in prose.

## Risks / Trade-offs

- [Detail removed that someone relied on, e.g. the `curl` content-type note for scripted API calls] → one line under
  *What it writes*; the rest is in the specs.
- [Conflict with `update-detail-view` task 4.1] → the new README mentions card actions in at most one line; the change
  merged second rewrites that line.
