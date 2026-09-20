# Design

## Context

See `proposal.md` — Why. What shapes the approach:

- The snapshot (`GET /api/state`) already carries everything the detail header needs (`ChangeSnapshot`: stage, column, tasks, dates, `branchMatch`, warnings). It does **not** carry the change directory or any file content, and per invariant 5 it should not start to: the detail view needs a second, on-demand source for file content.
- `readChangeArtifacts` (`src/server/openspecAdapter.ts`) already computes the artifact graph and calls `resolveArtifactOutputs` internally, but only returns `{ id, status }` per artifact. The resolved output paths — exactly what the file list needs — are thrown away today.
- `LocalRepoSource.listChanges()` is the only thing that knows where a change's directory is, archived or not; `CHANGE_NAME` is the validator for names that reach the file system (invariant 6).
- The UI is one self-contained HTML file with no runtime network access (invariant 4) and runs in two routing modes (`src/ui/url.ts`): path routing on the dashboard server, hash routing for the demo site. Every `Api` operation must exist twice — `httpApi` and the demo's in-memory implementation (`src/ui/demo/demoApi.ts`).
- Three other changes are in flight and also touch `src/ui/kanban.tsx` / `src/ui/app.tsx`; this change is limited there to the card anchor and the route switch.

## Goals / Non-Goals

**Goals:**

- Read artifact content without widening what the server may touch: a bounded, validated read of one file inside one change directory, derived entirely from server-side state.
- Render untrusted repository Markdown with no way for it to become HTML, script, style or a remote request — safe by construction rather than by filtering.
- Keep the snapshot the single source of truth for a change's state; the new endpoint only adds bytes on disk.

**Non-Goals:**

- Caching artifact content on the server. Files are small and the read is on demand.
- A Markdown renderer with full CommonMark coverage. OpenSpec artifacts use a narrow subset.
- Changing how the boards derive columns, group or filter.

## Decisions

### D1 — Two GET endpoints, repo id and change name resolved server-side

`GET /api/repos/<repoId>/changes/<changeName>/artifacts` returns the artifact list with each artifact's existing files (relative paths + byte size); `GET /api/repos/<repoId>/changes/<changeName>/file?path=<rel>` returns one file's text.

Splitting them keeps the first response small and cheap enough to re-fetch on every poll (it is a `readdir` plus `stat`), while content is fetched only for the file actually on screen.

The request never names a directory. `repoId` is looked up in `state.config.repos` among the enabled ones; `changeName` is matched against `source.listChanges()` (active and archived), which yields the absolute `dir`. `CHANGE_NAME` rejects anything with a separator before that lookup. This is the same containment argument the rest of the server uses: the request contributes an identifier, never a path.

*Alternatives considered:* one endpoint returning every file's content — simple, but re-reads the whole change on each poll and makes the size cap awkward. Adding file paths into the snapshot — rejected: the snapshot is polled by every open tab and would grow without bound, and invariant 5 keeps derived facts out of it.

### D2 — Path validation: normalise, then require containment, then `lstat`

`path` is rejected when absent, absolute, or when `normalize()` leaves a leading `..`. The candidate is then resolved against the change directory and must still start with the change directory plus a separator. Finally `realpath` must land inside the change directory too, and the target must be a regular file — this is what catches a symlink inside the change directory that points out of it. Files over 1 MiB answer `413` without reading the content (the size comes from `stat`).

Belt and braces on purpose: the string checks are cheap and readable, the `realpath` check is the one that actually holds under symlinks, and `413` before the read keeps a large file from being pulled into memory.

*Alternative considered:* serving only paths that appeared in the artifact list. Tempting, but it makes the file endpoint depend on a prior request's state, and the containment check is needed anyway.

### D3 — New `src/server/artifacts.ts`, and `openspecAdapter` returns resolved outputs

`readChangeArtifacts` gains the artifact's resolved output paths in its result (`ArtifactStatus` stays the shared wire type; the adapter returns a richer internal shape). That is the only place allowed to know `@fission-ai/openspec` internals (invariant 3), and `resolveArtifactOutputs` is already called there.

`src/server/artifacts.ts` owns the rest: finding the change directory through `RepoSource`, turning resolved outputs into relative paths with sizes, and the validated single-file read. It goes through `RepoSource`, not `node:fs` directly, so a future remote source keeps working; `RepoSource` gains a bounded `readFileInfo(absPath)` (size + regular-file check) alongside the existing `readText`.

### D4 — Markdown: tokenise with a library, render to Preact VNodes ourselves

The renderer (`src/ui/markdown.tsx`) never produces an HTML string and never uses `dangerouslySetInnerHTML`. It walks a token tree and returns Preact VNodes, mapping only the node types the spec lists. Anything else — including an `html` token — is rendered as its literal text.

This is what makes "raw HTML is not interpreted" structural rather than a filter to be audited: there is no code path from artifact text to markup. Images are dropped by not having a case for them, which also satisfies "no remote resources" without a CSP to maintain. Link targets are checked against `http:`/`https:`/`mailto:`/relative before an `<a>` is emitted; everything else becomes text. Emitted links carry `target="_blank" rel="noopener noreferrer"`.

`marked`'s lexer is the tokeniser: it is small, dependency-free, bundles cleanly and covers the GFM subset (tables, task list items) that OpenSpec artifacts use. We use `marked.lexer()` only — never `marked.parse()`, which produces HTML.

*Alternatives considered:* `marked.parse()` + DOMPurify — two dependencies, a much larger bundle, and safety that depends on keeping a sanitiser configured correctly. A hand-written parser — no dependency, but tables, nested lists and fences are exactly the fiddly parts, and a parser bug becomes a rendering bug on every spec file.

### D5 — Route in the path, selection in the query

The route is `/repo/<repoId>/change/<changeName>`, parsed in `src/ui/routes.ts` alongside the existing repo route, with `routeFromPath` returning `{ view: "change", repoId, changeName }`. The selected artifact, the selected file and the raw toggle live in the query string (`?artifact=`, `?file=`, `?raw=1`) and are written with `replaceQuery`, which already keeps hash-mode routing intact and does not add history entries per tab click.

The board a card was clicked on travels in a `from` query parameter holding the board's encoded path and query; the back link uses it when it is a board path of this app, and falls back to `repoPath(repoId)` otherwise. Nothing is read from `document.referrer` and nothing is remembered across reloads.

*Alternative considered:* artifact and file as further path segments. It reads well but multiplies the route grammar (a file path contains slashes) and needs encoding rules the query string gives for free.

### D6 — Two-source refresh, keyed so it does not flicker

The header renders from the snapshot the `App` already polls — no extra state. The artifact list and the selected file are fetched by `changeDetail.tsx` on mount, on selection change, and on the same poll interval as the snapshot. New content replaces old content only when the text differs, so an unchanged poll leaves the DOM (and the scroll position) alone. A failed content fetch is shown in the content area only; the header and tabs stay usable.

### D7 — `dashboard-api` delta is additive

The new endpoints are `GET`-only and add no write path, so the existing "The dashboard never writes to tracked repositories" requirement already covers them; the delta states the read-only guarantee in the new requirement instead of restating that requirement. `run-agent-actions-from-ui` has an unarchived `MODIFIED` delta for exactly that requirement, and a second `MODIFIED` of the same text would silently drop one side's wording at archive time. The `## Requirements` block of `openspec/specs/dashboard-api/spec.md` is unchanged by this change; the new endpoints are enumerated in its "Change artifact endpoints" requirement.

## Risks / Trade-offs

- **A Markdown token type we do not map renders as nothing.** → The renderer falls back to the token's raw text for anything unmapped, so content is never silently lost — only styled plainly. Tests cover one file of each artifact type from the fixtures.
- **`marked` adds to the single-file bundle.** → Lexer-only, tree-shaken; the build is checked once with `bun run build` and the demo bundle test still has to pass. If the growth is unacceptable, D4's fallback is a hand-written subset parser behind the same `renderMarkdown(text)` signature.
- **`realpath` per file read costs a syscall and can fail on a broken link.** → A failure is a `404`, which is the right answer for a link that does not resolve.
- **The poll re-reads the artifact list per open detail view.** → It is one `readdir` plus `stat` per artifact against a directory the scanner already walks; at the default interval this is negligible next to a full scan.
- **Archived changes have the archive date in their directory name, not the change name.** → The change directory always comes from `listChanges()`, which already strips the prefix; the request only ever carries the bare change name, as the boards show it.
- **Card as an anchor can swallow clicks on the controls inside it.** → The copy button and session starters stop propagation and prevent the default; the "copy action does not navigate" scenario is the regression test.
