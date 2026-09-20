# Tasks

## 1. Server: artifact files of a change

- [ ] 1.1 Extend `readChangeArtifacts` in `src/server/openspecAdapter.ts` to return each artifact's resolved output paths alongside `{ id, status }`, leaving the shared `ArtifactStatus` wire type unchanged; verify `bun test test/scanner.test.ts` still passes and a new assertion shows `proposal` resolving to `proposal.md` and `specs` to both fixture spec files
- [ ] 1.2 Add a bounded `readFileInfo(absPath)` to `RepoSource` / `LocalRepoSource` in `src/server/source.ts` returning size, regular-file and resolved-real-path information, or `undefined` when the path does not exist; verify with a unit test covering a regular file, a directory and a missing path
- [ ] 1.3 Create `src/server/artifacts.ts` with `changeDirFor(source, changeName)` resolving a change name against active and archived directories via `listChanges()` after `CHANGE_NAME` validation, and `listArtifactFiles(repoPath, changeDir, …)` returning artifacts in schema order with their existing files as sorted relative paths plus byte sizes; verify with a test over the synthetic fixtures that an artifact with no file has an empty `files` list and an archived change resolves to its `archive/<date>-<name>` directory
- [ ] 1.4 Add `readArtifactFile(changeDir, path)` to `src/server/artifacts.ts` implementing design D2 — reject missing, absolute and `..`-escaping paths, require containment after `realpath`, require a regular file, refuse over 1 MiB — returning a discriminated result the route maps to a status code; verify with unit tests for `../../../../etc/passwd`, `/etc/passwd`, `specs/../../../secrets.md`, a symlink pointing out of the change directory, a directory path and a 2 MiB file

## 2. Server: API routes

- [ ] 2.1 Add `GET /api/repos/<repoId>/changes/<changeName>/artifacts` to `src/server/api.ts`, resolving `repoId` against the enabled repositories in `state.config`; verify a new `test/artifactsApi.test.ts` asserts the `{ change, artifacts }` shape for a fixture change, including schema order and empty `files` for artifacts without a file
- [ ] 2.2 Add `GET /api/repos/<repoId>/changes/<changeName>/file?path=<rel>`; verify the same test file asserts `200` with `{ path, bytes, text }` for `proposal.md`, `400` for a missing/absolute/escaping `path` and an invalid change name, `404` for an unknown or disabled repository, an unknown change, a symlink leaving the change directory and a non-file path, and `413` for an oversize file with no content in the body
- [ ] 2.3 Verify both endpoints answer for an archived change and that calling them across every fixture repository leaves no file under a tracked repository created, modified or deleted — assert with the no-side-effects helper the existing API tests use

## 3. Shared types and client API

- [ ] 3.1 Add the artifact-file wire types (`ChangeArtifactFile`, `ChangeArtifacts`, `ArtifactFileContent`) to `src/shared/types.ts`; verify `bun run typecheck` passes
- [ ] 3.2 Add `changeArtifacts(repoId, change)` and `artifactFile(repoId, change, path)` to the `Api` interface and `httpApi` in `src/ui/api.ts`, and implement both in `src/ui/demo/demoApi.ts` over the demo sample data with the same error shapes; verify `bun test test/demoApi.test.ts` covers the demo implementations including an unknown change

## 4. Markdown renderer

- [ ] 4.1 Add `marked` to `package.json` dependencies and verify `bun install` succeeds and `bun run build:ui` still produces a single self-contained `dist/ui/index.html`
- [ ] 4.2 Implement `renderMarkdown(text)` in `src/ui/markdown.tsx` returning Preact VNodes from `marked.lexer()` tokens (design D4) for headings, paragraphs, lists including nested and task items, tables, fenced and inline code, block quotes, rules, emphasis, strong and links, with unmapped tokens falling back to their raw text; verify a new `test/markdown.test.ts` renders one file of each fixture artifact type and asserts the resulting structure
- [ ] 4.3 Enforce the untrusted-content rules in the renderer — `html` tokens rendered as text, images dropped, link targets limited to `http:`/`https:`/`mailto:`/relative with everything else rendered as plain text, emitted links carrying `target="_blank" rel="noopener noreferrer"`, and no `dangerouslySetInnerHTML` anywhere; verify `test/markdown.test.ts` covers `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>`, `![diagram](https://example.com/a.png)`, `[click](javascript:alert(1))` and `[docs](https://example.com/docs)`

## 5. Routing

- [ ] 5.1 Add `{ view: "change"; repoId; changeName }` to `Route` and parse `/repo/<id>/change/<name>` in `src/ui/routes.ts`, with a `changePath(repoId, changeName, from?)` helper; verify `test/url.test.ts` covers the round trip, URL-encoded names, an undecodable path falling back to the overview, and that the existing `/repo/<id>` route is unaffected
- [ ] 5.2 Add helpers for the `artifact`, `file`, `raw` and `from` query parameters (read, and write through `replaceQuery`), including the rule that `from` is only followed when it is a board path of this app; verify with unit tests covering a foreign `from` value being ignored

## 6. Change detail view

- [ ] 6.1 Create `src/ui/changeDetail.tsx` with the header from the snapshot — change name, repository name linking to its board, column, progress bar, relative last activity, created and archived dates, branch badge, warnings — and the not-found state for an unknown repository or change; verify a new `test/changeDetail.test.ts` renders both against a synthetic snapshot
- [ ] 6.2 Add the artifact tabs in schema order with their `done` / `ready` / `blocked` state, tabs without files not selectable, a file list for multi-file artifacts with the first file selected, and artifact/file selection reflected in the query string with a fallback to the first artifact that has content; verify with tests for a stale `?artifact=`/`?file=` and for the `specs` file list
- [ ] 6.3 Render the selected file with `renderMarkdown`, add the raw toggle that persists across file changes, and render the tasks artifact as a read-only checklist with `done/total`; verify tests assert the checklist state for a fixture tasks file and that the checkboxes are disabled and fire no request
- [ ] 6.4 Add the copy actions — apply command, `cd <repoPath>`, and copy file path for the selected file — reusing the card's copy button; verify a test asserts the exact clipboard text for each
- [ ] 6.5 Fetch the artifact list and the selected file on mount, on selection change and on the snapshot poll interval, replacing content only when the text differs, and render the error, oversize (`413`) and no-artifacts states in the content area while keeping header, tabs and copy actions usable; verify tests cover an unchanged poll leaving the rendered nodes in place and each error state

## 7. Board integration and styling

- [ ] 7.1 Make `ChangeCard` in `src/ui/kanban.tsx` an anchor to `changePath(...)` carrying the current board path and query as `from`, with the copy button and any session starter stopping propagation; verify tests assert the card's `href`, that the copy action does not navigate, and that grouping, counts and card content are unchanged
- [ ] 7.2 Add the `change` route to the view switch in `src/ui/app.tsx`, keyed by repository and change name; verify navigating from a card and back through the back link restores the board with its filters
- [ ] 7.3 Add the detail layout and Markdown typography to `src/ui/styles.css` using colour tokens only — tabs, file list, content column, code blocks, tables, read-only checklist — in both themes; verify `bun run lint` passes and the view renders correctly in dark and light

## 8. Verification

- [ ] 8.1 Run `bun run check` and fix everything it reports
- [ ] 8.2 Run `bun run build`, start `dist/openspec-dashboard` against the fixture repositories, and verify the detail view opens from a card, renders each artifact type, refuses a traversal request and needs no network — the compiled binary is the only place invariant 3 can be confirmed
- [ ] 8.3 Run `openspec validate add-change-detail-view --strict` and verify it reports no issues
