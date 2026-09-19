# openspec-dashboard — agent guide

Local-first, read-only Kanban across OpenSpec repositories, shipped as a single Bun binary.
See `README.md` for what it does and `CONTRIBUTING.md` for the branch, commit and PR conventions.

## Commands

```sh
bun install
bun run dev        # build the UI, serve http://127.0.0.1:4711 from source
bun run check      # lint + typecheck + tests — run before every push; CI runs exactly this
bun run build      # dist/openspec-dashboard (UI and fonts embedded)
bun test test/scanner.test.ts   # a single test file
```

## Layout

- `src/server/` — config, discovery, scanner, HTTP API, CLI entry. `src/shared/` — types and column derivation used by
  both sides. `src/ui/` — Preact SPA built into one self-contained `dist/ui/index.html` by `scripts/build-ui.ts`.
- `test/fixtures/` — synthetic `openspec/` trees written for the tests (see `test/fixtures/README.md`). Tests assert on
  their structure: change them together with the tests, and never reformat or lint them.
- `openspec/` — this project's own specs (`openspec/specs/`) and changes. Requirements live there; read the relevant
  spec before changing behaviour.

## Invariants — do not break these

1. **Read-only towards tracked repositories.** All writes stay under `~/.openspec-dashboard/` (or
   `OPENSPEC_DASHBOARD_HOME` in tests). Git is invoked only with the read-only subcommands listed in
   `openspec/specs/dashboard-api/spec.md`; adding one means changing that spec.
2. **Loopback only.** The server binds `127.0.0.1`; there is no auth because nothing else can reach it.
3. **`@fission-ai/openspec` internals only through `src/server/openspecAdapter.ts`.** Do not call the library's
   `resolveSchema`/`loadChangeContext`: they locate files via `import.meta.url`, which does not exist inside the
   compiled binary. The adapter embeds the schema at build time. Anything that works under `bun run` but reads files
   relative to a module path must also be verified in `dist/openspec-dashboard`.
4. **No network at runtime.** The UI is one HTML file with inlined JS, CSS and fonts; do not add CDN links, remote
   fonts or fetches to other hosts.
5. **The repository is the source of truth.** The dashboard indexes; it never stores facts about changes that are not
   derivable from the repositories.
6. **Change names reaching git or the file system are validated** (`CHANGE_NAME` in `src/server/source.ts`).
7. **Nothing from a real repository goes into this one.** No copied `openspec/` trees, repo names, paths, hostnames or
   people from other projects — not in fixtures, tests, specs, proposals or commit messages. Use made-up names
   (`demo-ops`, `alpha-infra`, `/w/acme/...`). Fixtures are generated, never copied. This repository may be public.

## Working alongside other sessions

This working tree is often shared by several agent sessions. Stay inside the files listed under **Impact** in your
change's proposal, do not switch branches or rewrite the index of a shared tree, and never commit or revert work that
belongs to another change without the user's confirmation.
