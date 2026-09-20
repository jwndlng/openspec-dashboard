# Contributing

Work in this repository is driven by [OpenSpec](https://github.com/Fission-AI/OpenSpec) changes under `openspec/changes/`.
One change = one branch = one pull request.

## Workflow

1. **Propose** — `/opsx:new` or `/opsx:propose` creates `openspec/changes/<change-name>/`. Commit the proposal as
   `docs(openspec): add <change-name>`.
2. **Branch** — name the branch after the change: `feat/<change-name>` (or `fix/<change-name>`, `chore/<change-name>`).
   The dashboard matches branches to changes by name, so this repository shows up correctly on its own board.
3. **Implement** — `/opsx:apply <change-name>`; tick tasks in `tasks.md` as they are done.
4. **Check** — `bun run check` (lint, typecheck, tests) must pass before pushing. CI runs the same command, plus the
   single-binary build, on Linux and macOS.
5. **Pull request** — the title follows [Conventional Commits](https://www.conventionalcommits.org/) and becomes the
   squash-commit subject. Do not push to `main` directly.
6. **Archive** — after merge, `/opsx:archive <change-name>` and commit as `chore(openspec): archive <change-name>`.

## Commit and PR titles

`<type>(<optional scope>): <summary>` with type one of `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`,
`ci`, `build`, `perf`.

```
feat(discovery): ignore paths and canonical repo identity
fix(scanner): read schema from the embedded copy in compiled binaries
docs(openspec): add dedupe-discovery
chore(openspec): archive kanban-dashboard-mvp, discover-on-root-change
```

## Working in parallel: one worktree per change

Several sessions (people or agents) have changes in flight at once, so nobody works in the main checkout. Each change
gets its own `git worktree` and branch:

```sh
git fetch origin
git worktree add .claude/worktrees/<change-name> -b feat/<change-name> origin/main
cd .claude/worktrees/<change-name> && bun install
# … edit, bun run check, commit, push, open the pull request …
git worktree remove .claude/worktrees/<change-name>      # after the merge
```

The main checkout stays on `main` and is only read from (and used to run the dashboard). Stay within the files your
change lists under **Impact** in its proposal; if you need to touch something another in-flight change owns, say so in
the proposal first. Agent sessions follow the same rule — see `CLAUDE.md`.

## Testing agent sessions

Tests must never start a real agent CLI or use the network. `test/fixtures/fake-agent.ts` is a small interactive program
(prints how it was started, echoes what is typed, `exit`/`crash` end it); session tests run it in real pseudo-terminals
against temp git repositories made from the synthetic fixtures, including the WebSocket that carries the terminal. If you
change how agents are started or relayed, also run the compiled binary once (`bun run build`): pseudo-terminals and
WebSockets must work inside the single executable.

## Demo site and screenshots

The [live demo](https://blog.wndlng.ch/openspec-dashboard/) is the real UI built with `bun run build:demo`: the
entry point `src/ui/demo/main.tsx` swaps the HTTP API for an in-memory one and switches to hash routing. It is
published from `main` by `.github/workflows/pages.yml`; nothing generated is committed.

- **Sample data is fiction, always.** `src/ui/demo/sampleData.ts` holds invented repositories under `/home/demo/` and
  invented change names. Never paste names or paths from a real dashboard; tests fail on anything shaped like a real
  home directory, in the sample and in the built demo.
- **A new API operation needs a demo implementation.** Add it to `interface Api` in `src/ui/api.ts` and type checking
  fails until `src/ui/demo/demoApi.ts` has it too. If it makes no sense without a server, reject with a clear message.
- **The URL goes through `src/ui/url.ts`.** Components never touch `location` or `history` directly (a test checks), so
  every view keeps working in both routing modes.
- **Screenshots come from the demo build only:** `bun run build:demo && bun run screenshots`. The script takes no URL
  on purpose. The README embeds the published ones, so they follow `main` on their own.
- A new board feature is worth a sample change that shows it — the demo is the first thing a newcomer sees.

## Toolchain

Bun is pinned in `.bun-version` (and `packageManager`). Upgrading Bun is a deliberate commit of its own — the compiled
binary and text imports are version-sensitive — not something Dependabot does.

Package updates are manual for now (`bun update`, then `bun run check`): Dependabot cannot yet read the `bun.lock` format
Bun 1.4 writes. Dependabot does keep the GitHub Actions pins current.
