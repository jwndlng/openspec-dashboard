# Tasks

## 1. Loosen the invariant in writing, before any code

- [ ] 1.1 Land the two spec deltas in `specs/` as written — `change-creation` (the staging requirement, the amended
      submit requirement, the removed "never executes anything") and `dashboard-api` (entry (5), the narrowed index
      clause, `add` in the subcommand list, the amended create-change endpoint) — and verify with
      `openspec validate "adding-new-change-must-track-files"` reporting the change valid.
- [ ] 1.2 Update invariant 1 in `CLAUDE.md`: the enumerated exception list goes from four entries to five, naming
      `git add -- openspec/changes/<name>/` as best-effort and scoped, and the "never runs a git command that writes"
      phrasing is corrected. Verify by reading the invariant back against the `dashboard-api` delta — the two must
      enumerate the same writes, with no claim in `CLAUDE.md` the spec does not make.

## 2. Stage the directory in `createChange.ts`

- [ ] 2.1 Add a private `git()` runner to `src/server/createChange.ts` (D2): `Bun.spawn(["git", ...args])` with `cwd`
      the repository, `stdin: "ignore"`, `env` carrying `GIT_TERMINAL_PROMPT=0` and `GIT_OPTIONAL_LOCKS=0`, a timeout
      matching `git.ts`'s 10s, and a boolean result — never a throw. Verify with a unit test that it returns false for
      a directory that is not a git repository and does not reject.
- [ ] 2.2 Call it once after both file writes succeed, as `git add -- openspec/changes/<name>/` (D1, D3), and widen
      `CreateChangeResult` to `{ ok: true; name; dir; wrotePrompt; staged: boolean }`. Verify with a test in
      `test/createChange.test.ts` that a change created in a temp git repository shows `.openspec.yaml` as a staged
      addition in `git status --porcelain` (`A ` and not `??`), and that `staged` is true.
- [ ] 2.3 Make the failure paths return `staged: false` without failing the create (D4, D5): non-git repository,
      git missing, non-zero exit, timeout. Verify with tests that a change created in a non-git temp directory still
      returns `ok: true` with `staged: false` and both files on disk.
- [ ] 2.4 Verify the scoping and the non-escalation in `test/createChange.test.ts`: in a temp git repository that
      already has one modified tracked file and one unrelated untracked file, creating a change leaves both of those
      out of the index, and `HEAD`, the branch and the ref list are identical before and after (no commit).

## 3. Carry `staged` through the API

- [ ] 3.1 Return `{ name: result.name, staged: result.staged }` from the create route in `src/server/api.ts`, and
      widen the response type in `src/shared/types.ts` and `src/ui/api.ts`'s `createChange` signature to match.
      Verify with `bun run check` typechecking clean and the UI form still compiling untouched.
- [ ] 3.2 Extend `test/createChangeApi.test.ts` with a git-backed harness repository (reuse the `git` /
      `tempGitRepo` helpers' approach from `test/sessionHelpers.ts`) and verify a successful create answers
      `201 { name, staged: true }` with the directory staged, while the existing non-git harness still answers
      `201` with `staged: false`.
- [ ] 3.3 Verify every refusal still runs no git at all: extend the existing `treeFingerprint` refusal assertions in
      `test/createChangeApi.test.ts` so that for a `400`, `404` and `409` the repository's `.git/index` is
      byte-for-byte unchanged as well as its tree.

## 4. Whole-system verification

- [ ] 4.1 Run `bun run check` and verify lint, typecheck and the full test suite pass.
- [ ] 4.2 Run `bun run build` and verify `dist/openspec-dashboard` creates a change in a scratch git repository with
      the directory staged — the git invocation must work in the compiled binary, not only under `bun run`.
- [ ] 4.3 Verify by hand in `bun run dev`: create a change on a repository's board, confirm it appears in `New` after
      the rescan, and confirm `git status` in that repository shows the new directory staged and nothing else newly
      staged.
