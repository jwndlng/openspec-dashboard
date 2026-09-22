## Why

The board shows *that* a change exists and how far along it is, but not *what it says*: to read a proposal, a design or the open tasks you still have to leave the dashboard, find the repository and open the files. With many repositories and agent-written changes, reviewing what was proposed is the most common next step after spotting a card, so the dashboard should let you read a change's artifacts in place.

## What Changes

- **Change detail view**: a new client-side route `/repo/<repoId>/change/<changeName>` (archived changes included) that shows one change with its repository, stage, task progress, dates, branch match and warnings, and lets the user browse its artifacts.
- **Artifact browser**: one tab per artifact in the change's schema order (e.g. Proposal, Specs, Design, Tasks). Artifacts that do not exist yet are shown disabled with their status (`ready` / `blocked`). An artifact that consists of several files (delta specs under `specs/**`) gets a file list; the selected tab and file are part of the URL so a view can be linked and survives reload.
- **Rendered Markdown, safely**: artifact content is rendered as Markdown (headings, lists, tables, code, links) by a renderer bundled into the single-file UI. Content comes from tracked repositories and is treated as untrusted: raw HTML is not interpreted, links open in a new tab without referrer, and no remote resources (images, scripts, styles) are loaded. A "raw" toggle shows the source text.
- **Tasks as a checklist**: the tasks artifact renders its checkboxes read-only together with the same progress the card shows.
- **Navigation**: cards on the boards link to the detail view; the detail view links back to the board it came from and offers the existing copy actions (apply command, `cd` command) plus "copy file path" for the open artifact.
- **Read-only API for artifact content**: a new endpoint returns a change's artifact files (list and content) for a tracked repository. It reads only inside that change's directory, validates the change name and every requested path, caps file size, and never writes. The snapshot and the existing endpoints are unchanged.
- The view refreshes with the regular poll, so ticking a task or adding an artifact on disk shows up without a manual reload.
- Non-goals: editing artifacts, creating or archiving changes, diffing delta specs against main specs, full-text search across changes, browsing `openspec/specs/` outside a change.

## Capabilities

### New Capabilities
- `change-detail`: the per-change detail view — routing, header information, artifact tabs and file list, Markdown rendering rules for untrusted content, the read-only task checklist, copy actions, refresh behaviour and empty/error states.

### Modified Capabilities
- `dashboard-api`: adds the read-only artifact content endpoint with its validation, size limit and error responses; the "never writes to tracked repositories" requirement is extended to cover it.
- `kanban-board`: cards become links to the change detail view, and the view returns to the originating board with its filters intact.

## Impact

- Server: `src/server/api.ts` (new route), a new `src/server/artifacts.ts` (list/read files of a change via `RepoSource`, path containment), `src/server/openspecAdapter.ts` (expose each artifact's resolved output paths — already computed there), `src/server/source.ts` (bounded file read if needed).
- Shared/UI: `src/shared/types.ts` (artifact file types), `src/ui/routes.ts` (new route + path helper), new `src/ui/changeDetail.tsx` and `src/ui/markdown.tsx`, `src/ui/api.ts`, `src/ui/url.ts` (links and navigation that carry a query, in both routing modes), `src/ui/demo/demoApi.ts` and new `src/ui/demo/sampleArtifacts.ts` (demo implementation of the two operations), `src/ui/app.tsx` (route switch), `src/ui/kanban.tsx` (card link), `src/ui/styles.css` (detail layout and Markdown typography, both themes).
- Dependencies: one small Markdown parser bundled into `dist/ui/index.html` (no runtime network access, per project invariant); bundle size grows accordingly.
- Tests: route parsing, endpoint validation (traversal, unknown repo/change, oversize file, archived change), Markdown sanitisation cases, using the synthetic fixtures; `test/helpers.ts` (tree fingerprint for the no-side-effects check) and a new `test/vnode.ts` (VNode inspection for UI tests).
- Overlap: `create-change-from-dashboard` and `collapsible-repo-groups` are in flight and also touch `src/ui/kanban.tsx` / `src/ui/app.tsx`; this change limits itself there to the card link and the route switch.
