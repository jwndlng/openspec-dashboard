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

## Toolchain

Bun is pinned in `.bun-version` (and `packageManager`). Upgrading Bun is a deliberate commit of its own — the compiled
binary and text imports are version-sensitive — not something Dependabot does.

Package updates are manual for now (`bun update`, then `bun run check`): Dependabot cannot yet read the `bun.lock` format
Bun 1.4 writes. Dependabot does keep the GitHub Actions pins current.
