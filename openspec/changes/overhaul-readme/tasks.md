# Tasks

## 1. Rewrite the README

- [x] 1.1 Replace `README.md` with the outline from design.md (pitch, demo link + themed screenshot, Run, First run, Features, What it writes, Contributing, License); verify it is under ~90 lines and keeps the `<picture>` block with both screenshot URLs and the alt text
- [x] 1.2 Write the Features list as one line per feature with a link to its spec under `openspec/specs/`; verify every linked path exists (`ls` each)
- [x] 1.3 Write "What it writes": loopback binding, read-only git, state in `~/.openspec-dashboard/`, the four click-only writes (Pull, New change, shared config, agent-session worktrees), same-origin rule for scripted calls, link to the `dashboard-api` "never writes" requirement; verify each statement against CLAUDE.md invariants 1, 2, 2a and 4
- [x] 1.4 Check commands and flags against the code: `bun run dev|build|check` exist in `package.json`, `--port N` and `--no-open` in `src/server/index.ts`, Bun version matches `.bun-version`
- [x] 1.5 Read the result once for filler: no marketing phrases, emoji, or sentences that restate a heading; no real repository names, paths or hosts

## 2. Contributing and checks

- [x] 2.1 Ensure `CONTRIBUTING.md` names `bun run build:demo` and `bun run screenshots` (add a short code block under "Demo site and screenshots" only if missing); verify with `grep`
- [x] 2.2 Run `bun run check` and `openspec validate overhaul-readme --strict`; both pass
